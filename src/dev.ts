import * as _zodPlugin from "@zod-plugin/effect";
import { ConfigLive } from "./config";
import { makeBleGateway } from "./gateways/ble-gateway";
import { scan } from "./infra/ble-scanner";
import { Logger, LoggerLive } from "./infra/logger";
import { DeviceType } from "./types";
import { makeHomeAssistantMqttMessageProducer } from "./mqtt/home-assistant/home-assistant-mqtt-message-producer";
import { Stream, Effect, pipe, Match, Layer, Console } from "effect";

const bleMode = Effect.gen(function* () {
    const { logger } = yield* Logger;

    const filterManufacturerId = Number(process.argv[3]);

    if (filterManufacturerId) {
        logger.info("Filtering manufacturer id %s", filterManufacturerId);
    }

    return yield* scan().pipe(
        Stream.tap((peripheral) =>
            Effect.sync(() => {
                const manufacturerId = peripheral.advertisement.manufacturerData?.readUInt16LE();

                if (filterManufacturerId && filterManufacturerId !== manufacturerId) {
                    return;
                }

                logger.info("Received BLE advertisement %s", peripheral);
            })
        ),
        Stream.runDrain
    );
});

const gatewayMode = Effect.gen(function* () {
    const { logger } = yield* Logger;

    const filterDeviceType: DeviceType | undefined = process.argv[3] as DeviceType | undefined;

    if (filterDeviceType) {
        logger.info("Filtering device type %s", filterDeviceType);
    }

    const bleGateway = yield* makeBleGateway();

    return yield* scan().pipe(
        bleGateway,
        Stream.filter((message) => !filterDeviceType || message.device.type === filterDeviceType),
        Stream.tap((message) =>
            Effect.sync(() => {
                logger.info("Received Device message %s", JSON.stringify(message));
            })
        ),
        Stream.runDrain
    );
});

const mqttMode = Effect.gen(function* () {
    const { logger } = yield* Logger;
    const bleGateway = yield* makeBleGateway();
    const homeAssistantMqttMessageProducer = yield* makeHomeAssistantMqttMessageProducer();

    const filterDeviceType: DeviceType | undefined = process.argv[3] as DeviceType | undefined;

    if (filterDeviceType) {
        logger.info("Filtering device type %s", filterDeviceType);
    }

    return yield* scan().pipe(
        bleGateway,
        Stream.filter((message) => !filterDeviceType || message.device.type === filterDeviceType),
        Stream.flatMap((message) => homeAssistantMqttMessageProducer(message)),
        Stream.tap((message) => Effect.sync(() => logger.info("Received MQTT message %s", JSON.stringify(message)))),
        Stream.runDrain
    );
});

const DevLayer = LoggerLive.pipe(Layer.provide(ConfigLive), Layer.provideMerge(ConfigLive));

const devProgram = Effect.gen(function* () {
    const { logger } = yield* Logger;
    const mode: string | undefined = process.argv[2];

    logger.info("Dev mode: %s", mode);

    const selectedMode = yield* Match.value(mode).pipe(
        Match.when("ble", () => Effect.succeed(bleMode)),
        Match.when("gateway", () => Effect.succeed(gatewayMode)),
        Match.when("mqtt", () => Effect.succeed(mqttMode)),
        Match.orElse((m) => Effect.fail(`Unknown mode ${m}`))
    );

    return yield* selectedMode;
});

const configuredDevProgram = Effect.provide(devProgram, DevLayer);
void Effect.runPromise(configuredDevProgram);
