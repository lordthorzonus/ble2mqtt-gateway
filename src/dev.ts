import { Config, ConfigLive, ConfigurationError } from "./config";
import { GatewayError, makeBleGateway } from "./gateways/ble-gateway";
import { scan } from "./infra/ble-scanner";
import { Logger, LoggerLive } from "./infra/logger";
import { DeviceType } from "./types";
import { homeAssistantMqttMessageProducer } from "./mqtt/home-assistant/home-assistant-mqtt-message-producer";
import { Stream, Effect, pipe, Match, Layer } from "effect";

const bleMode = Effect.gen(function* () {
    const { logger } = yield* Logger;

    const filterManufacturerId = Number(process.argv[3]);

    if (filterManufacturerId) {
        logger.info("Filtering manufacturer id %s", filterManufacturerId);
    }

    return yield* scan().pipe(
        Stream.runForEach((peripheral) =>
            Effect.sync(() => {
                const manufacturerId = peripheral.advertisement.manufacturerData?.readUInt16LE();

                if (filterManufacturerId && filterManufacturerId !== manufacturerId) {
                    return;
                }

                logger.info("Received BLE advertisement %s", peripheral);
            })
        )
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
        Stream.flatMap((peripheral) => bleGateway(peripheral)),
        Stream.runForEach((message) =>
            Effect.sync(() => {
                if (filterDeviceType && filterDeviceType !== message.device.type) {
                    return;
                }

                logger.info("Received Device message %s", JSON.stringify(message));
            })
        )
    );
});

const mqttMode = Effect.gen(function* () {
    const { logger } = yield* Logger;

    const filterDeviceType: DeviceType | undefined = process.argv[3] as DeviceType | undefined;

    if (filterDeviceType) {
        logger.info("Filtering device type %s", filterDeviceType);
    }

    return yield* Effect.gen(function* () {
        const bleGateway = yield* makeBleGateway();

        return yield* scan().pipe(
            Stream.flatMap((peripheral) => bleGateway(peripheral)),
            Stream.flatMap((message) => Stream.fromIterable(homeAssistantMqttMessageProducer(message))),
            Stream.runForEach((message) =>
                Effect.sync(() => logger.info("Received MQTT message %s", JSON.stringify(message)))
            )
        );
    });
});

const DevLayer = LoggerLive.pipe(Layer.provide(ConfigLive), Layer.provideMerge(ConfigLive));

const devProgram = Effect.gen(function* () {
    const { logger } = yield* Logger;
    const mode: string | undefined = process.argv[2];

    logger.info("Dev mode: %s", mode);

    return yield* Match.value(mode).pipe(
        Match.when("ble", () => bleMode),
        Match.when("gateway", () => gatewayMode),
        Match.when("mqtt", () => mqttMode),
        Match.orElse((m) => Effect.fail(`Unknown mode ${m}`))
    );
});

const configuredDevProgram = Effect.provide(devProgram, DevLayer);
void Effect.runPromise(configuredDevProgram);
