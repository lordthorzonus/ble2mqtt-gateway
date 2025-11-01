import { makeHomeAssistantMqttMessageProducer } from "./mqtt/home-assistant/home-assistant-mqtt-message-producer";
import { Config } from "./config";
import { makeBleGateway } from "./gateways/ble-gateway";
import { publish, MqttClient } from "./infra/mqtt-client";
import { Logger } from "./infra/logger";
import { Effect, Stream, Layer } from "effect";
import { scan } from "./infra/ble-scanner";
import { NodeRuntime } from "@effect/platform-node";
process.stdin.resume();

const GatewayLive = Layer.mergeAll(Config.Default, Logger.Default, MqttClient.Default);

const program = Effect.gen(function* () {
    const logger = yield* Logger;

    logger.info("Starting BLE2MQTT Gateway");

    yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
            logger.info("Shutting down BLE2MQTT Gateway");
        })
    );

    const bleGateway = yield* makeBleGateway();
    const homeAssistantMqttMessageProducer = yield* makeHomeAssistantMqttMessageProducer();

    return yield* scan().pipe(
        bleGateway,
        Stream.flatMap((message) => homeAssistantMqttMessageProducer(message)),
        Stream.mapEffect((message) => publish(message), { concurrency: "unbounded" }),
        Stream.runDrain,
        Effect.catchTags({
            SensorConfigurationMissingError: (error) =>
                Effect.sync(() =>
                    logger.error(
                        "Encountered a device message that does not have corresponding Home Assistant configuration",
                        { message: error.message }
                    )
                ),
            MqttClientError: (error) =>
                Effect.sync(() => logger.error("Error publishing MQTT message", { message: error.mqttMessage })),
            GatewayError: (error) => Effect.sync(() => logger.error("Error from gateway", { error })),
            BleScannerError: (error) => Effect.sync(() => logger.error("Error during BLE scanning", { error })),
        })
    );
});

const configuredProgram = Effect.provide(Effect.scoped(program), GatewayLive);
NodeRuntime.runMain(configuredProgram);
