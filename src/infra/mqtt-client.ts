import * as mqtt from "mqtt";

import { MqttMessage } from "../types";
import { Data, Effect } from "effect";
import { Logger } from "./logger";
import { Config } from "../config";

const mqttClient = Effect.gen(function* () {
    const { config } = yield* Config;
    const { logger } = yield* Logger;

    const client = mqtt.connect({
        clientId: config.mqtt.client_id,
        username: config.mqtt.username,
        password: config.mqtt.password,
        port: config.mqtt.port,
        protocol: config.mqtt.protocol,
        rejectUnauthorized: true,
        hostname: config.mqtt.host,
        protocolVersion: 5,
        connectTimeout: 50,
    });
    client.on("connect", () => {
        logger.info("MQTT client connected");
    });

    client.on("disconnect", () => {
        logger.info("MQTT client disconnected");
    });

    client.on("error", (error) => {
        logger.error("MQTT client error", { error });
    });

    return client;
});

export class MqttClient extends Effect.Service<MqttClient>()("MqttClient", {
    effect: Effect.gen(function* () {
        const client = yield* mqttClient;
        return client;
    }),
}) {}

export class MqttClientError extends Data.TaggedError("MqttClientError")<{
    message: string;
    mqttMessage: MqttMessage;
    cause?: Error;
}> {}

export const publish = (message: MqttMessage): Effect.Effect<void, MqttClientError, MqttClient | Logger> =>
    Effect.gen(function* () {
        const client = yield* MqttClient;
        const { logger } = yield* Logger;

        logger.debug("Publishing MQTT Message", { message });
        return yield* Effect.async<unknown, MqttClientError, MqttClient>((resume) => {
            client.publish(
                message.topic,
                message.payload,
                {
                    retain: message.retain,
                },
                (error) => {
                    if (error) {
                        resume(
                            new MqttClientError({
                                message: "Failed to publish MQTT message",
                                mqttMessage: message,
                                cause: error,
                            })
                        );
                    }
                    resume(Effect.succeed(undefined));
                }
            );
        });
    });
