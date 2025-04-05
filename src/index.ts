import { makeHomeAssistantMqttMessageProducer } from "./mqtt/home-assistant/home-assistant-mqtt-message-producer";
import { Config } from "./config";
import { makeBleGateway } from "./gateways/ble-gateway";
import { publish, MqttClient } from "./infra/mqtt-client";
import { Logger } from "./infra/logger";
import { Effect, Stream, Layer } from "effect";
import { scan, stopScanning } from "./infra/ble-scanner";
import { NodeRuntime } from "@effect/platform-node";
process.stdin.resume();

const GatewayLive = Layer.mergeAll(Config.Default, Logger.Default, MqttClient.Default);

const program = Effect.gen(function* () {
    const logger = yield* Logger;

    const bleGateway = yield* makeBleGateway();
    const homeAssistantMqttMessageProducer = yield* makeHomeAssistantMqttMessageProducer();

    yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
            stopScanning();
        })
    );

    return yield* scan().pipe(
        bleGateway,
        Stream.flatMap((message) => homeAssistantMqttMessageProducer(message)),
        Stream.tap((message) => publish(message)),
        Stream.runDrain,
        Effect.catchTags({
            MqttClientError: (error) =>
                Effect.sync(() => logger.error("Error publishing MQTT message", { message: error.mqttMessage })),
            GatewayError: (error) => Effect.sync(() => logger.error("Error from gateway", { error })),
        })
    );
});

const configuredProgram = Effect.provide(Effect.scoped(program), GatewayLive);
NodeRuntime.runMain(configuredProgram);
