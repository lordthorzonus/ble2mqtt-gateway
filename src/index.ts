import { makeHomeAssistantMqttMessageProducer } from "./mqtt/home-assistant/home-assistant-mqtt-message-producer";
import { ConfigLive } from "./config";
import { makeBleGateway } from "./gateways/ble-gateway";
import { publish } from "./infra/mqtt-client";
import { Logger, LoggerLive } from "./infra/logger";
import { Effect, Layer, Stream } from "effect";
import { scan, stopScanning } from "./infra/ble-scanner";
import { MqttClient } from "./infra/mqtt-client";

process.stdin.resume();

const program = Effect.gen(function* () {
    const { logger } = yield* Logger;

    const bleGateway = yield* makeBleGateway();
    const homeAssistantMqttMessageProducer = yield* makeHomeAssistantMqttMessageProducer();

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

const MainLayer = MqttClient.Default.pipe(
    Layer.provide(LoggerLive),
    Layer.provideMerge(LoggerLive),
    Layer.provide(ConfigLive),
    Layer.provideMerge(ConfigLive)
);

const configuredProgram = Effect.provide(program, MainLayer);
void Effect.runPromise(configuredProgram).then((_exit) => {
    stopScanning();
    process.exit(0);
});

process.on("SIGINT", () => {
    stopScanning();
    process.exit(0);
});

process.on("SIGTERM", () => {
    stopScanning();
    process.exit(0);
});
