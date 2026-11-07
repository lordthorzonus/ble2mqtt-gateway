import * as mqtt from "mqtt";

import { MqttMessage } from "../types.js";
import { Data, Duration, Effect, Schedule } from "effect";
import { Logger } from "./logger.js";
import { Config } from "../config.js";

const mqttClient = Effect.gen(function* () {
    const config = yield* Config;
    const logger = yield* Logger;

    const client = mqtt.connect({
        clientId: config.mqtt.client_id,
        username: config.mqtt.username,
        password: config.mqtt.password,
        port: config.mqtt.port,
        protocol: config.mqtt.protocol,
        rejectUnauthorized: true,
        hostname: config.mqtt.host,
        protocolVersion: 5,
        connectTimeout: 30_000,
        // Fail QoS 0 publishes while disconnected instead of queueing them until reconnect.
        // Queued sensor state would be stale, and the queue grows without bound during outages.
        // Retained availability and discovery messages are re-sent by the availability heartbeat.
        queueQoSZero: false,
    });
    client.on("connect", () => {
        logger.info("MQTT client connected");
    });

    client.on("disconnect", () => {
        logger.info("MQTT client disconnected");
    });

    client.on("reconnect", () => {
        logger.info("MQTT client reconnecting");
    });

    client.on("offline", () => {
        logger.warn("MQTT client offline");
    });

    client.on("close", () => {
        logger.info("MQTT client connection closed");
    });

    client.on("error", (error) => {
        logger.error("MQTT client error", { error });
    });

    yield* Effect.addFinalizer(() =>
        Effect.gen(function* () {
            yield* Effect.promise(() => client.endAsync());
            logger.info("MQTT client connection closed");
        })
    );

    return client;
});

export class MqttClient extends Effect.Service<MqttClient>()("MqttClient", {
    scoped: mqttClient,
    dependencies: [Config.Default, Logger.Default],
}) {}

export class MqttClientError extends Data.TaggedError("MqttClientError")<{
    message: string;
    mqttMessage: MqttMessage;
    cause?: Error;
}> {}

/**
 * Retained messages (availability and discovery) are retried briefly. State messages are not retried,
 * because a retried state message is stale and the next advertisement replaces it anyway.
 */
const RETAINED_PUBLISH_RETRY_POLICY = Schedule.exponential(Duration.millis(500)).pipe(
    Schedule.intersect(Schedule.recurs(3))
);

const publishOnce = (message: MqttMessage): Effect.Effect<void, MqttClientError, MqttClient | Logger> =>
    Effect.gen(function* () {
        const client = yield* MqttClient;
        const logger = yield* Logger;

        logger.debug("Publishing MQTT Message", { message });
        return yield* Effect.async<undefined, MqttClientError>((resume) => {
            client.publish(
                message.topic,
                message.payload,
                {
                    retain: message.retain,
                },
                (error) => {
                    if (error) {
                        resume(
                            Effect.fail(
                                new MqttClientError({
                                    message: "Failed to publish MQTT message",
                                    mqttMessage: message,
                                    cause: error,
                                })
                            )
                        );
                    } else {
                        resume(Effect.succeed(undefined));
                    }
                }
            );
        });
    });

/**
 * Publishes one message. Callers that need ordering per topic must not publish to the same topic concurrently,
 * because a retried message would otherwise overwrite a newer one.
 */
export const publish = (message: MqttMessage): Effect.Effect<void, MqttClientError, MqttClient | Logger> =>
    message.retain ? Effect.retry(publishOnce(message), RETAINED_PUBLISH_RETRY_POLICY) : publishOnce(message);
