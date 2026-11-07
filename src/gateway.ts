import { Config, GlobalConfiguration } from "./config.js";
import { makeBleGateway } from "./gateways/ble-gateway.js";
import { MqttClient, publish } from "./infra/mqtt-client.js";
import { Logger, LoggerInterface } from "./infra/logger.js";
import { Duration, Effect, pipe, Schedule, Semaphore, Stream } from "effect";
import { scan } from "./infra/ble-scanner.js";
import { makeHomeAssistantMqttMessageProducer } from "./mqtt/home-assistant/home-assistant-mqtt-message-producer.js";
import { DeviceMessage, MqttMessage } from "./types.js";

const SCANNER_RETRY_POLICY = Schedule.min([
    Schedule.exponential(Duration.seconds(1)),
    Schedule.spaced(Duration.seconds(30)),
]);

const scanWithRetry = (logger: LoggerInterface) =>
    pipe(
        scan(),
        Stream.retry(
            SCANNER_RETRY_POLICY.pipe(
                Schedule.tap(({ input: error }) =>
                    Effect.sync(() => logger.error("BLE scanner failed, restarting scanner", { error }))
                )
            )
        )
    );

const makePublishConcurrencyLimit = (
    concurrency: GlobalConfiguration["concurrency"]["mqtt_publishing"]
): Effect.Effect<<A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>> =>
    concurrency === "unbounded"
        ? Effect.succeed((effect) => effect)
        : Effect.map(Semaphore.make(concurrency), (semaphore) => semaphore.withPermits(1));

/**
 * The BLE-to-MQTT pipeline: scans advertisements, maps them to device messages, produces Home Assistant
 * MQTT messages and publishes them in order per topic. Runs until interrupted; scanner failures restart the
 * scanner and per-message failures are logged and dropped.
 */
export const gateway = Effect.gen(function* () {
    const logger = yield* Logger;
    const config = yield* Config;

    logger.info("Starting BLE2MQTT Gateway");

    yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
            logger.info("Shutting down BLE2MQTT Gateway");
        })
    );

    const bleGateway = yield* makeBleGateway();
    const homeAssistantMqttMessageProducer = yield* makeHomeAssistantMqttMessageProducer();
    const limitPublishConcurrency = yield* makePublishConcurrencyLimit(config.concurrency.mqtt_publishing);

    const produceMqttMessages = (message: DeviceMessage): Effect.Effect<readonly MqttMessage[]> =>
        pipe(
            homeAssistantMqttMessageProducer(message),
            Stream.runCollect,
            Effect.catchTag("SensorConfigurationMissingError", (error) =>
                Effect.sync(() => {
                    logger.error(
                        "Encountered a device message that does not have corresponding Home Assistant configuration",
                        { message: error.message }
                    );

                    return [];
                })
            )
        );

    const publishMessage = (message: MqttMessage): Effect.Effect<void, never, MqttClient | Logger> =>
        pipe(
            publish(message),
            limitPublishConcurrency,
            Effect.catchTag("MqttClientError", (error) =>
                Effect.sync(() => {
                    logger.error("Error publishing MQTT message", {
                        topic: error.mqttMessage.topic,
                        retain: error.mqttMessage.retain,
                        message: error.mqttMessage,
                        cause: error.cause,
                    });
                })
            )
        );

    return yield* pipe(
        bleGateway.deviceMessages(scanWithRetry(logger)),
        Stream.mapEffect(produceMqttMessages, { concurrency: config.concurrency.mqtt_message_production }),
        Stream.flattenIterable,
        Stream.groupByKey((message) => message.topic),
        // Topics publish concurrently; messages within one topic stay in order.
        Stream.flatMap(([_topic, messages]) => Stream.mapEffect(messages, publishMessage), {
            concurrency: "unbounded",
        }),
        Stream.runDrain
    );
});
