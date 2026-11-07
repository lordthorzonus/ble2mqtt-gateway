import { getManufacturerId, makeBleGateway } from "./gateways/ble-gateway.js";
import { scan } from "./infra/ble-scanner.js";
import { Logger } from "./infra/logger.js";
import { DeviceType } from "./types.js";
import { makeHomeAssistantMqttMessageProducer } from "./mqtt/home-assistant/home-assistant-mqtt-message-producer.js";
import { Stream, Effect, Match, Layer } from "effect";
import { Config } from "./config.js";
import { NodeRuntime } from "@effect/platform-node";

const DEVICE_TYPES: readonly string[] = Object.values(DeviceType);

const isDeviceType = (value: string | undefined): value is DeviceType =>
    value !== undefined && DEVICE_TYPES.includes(value);

const bleMode = Effect.gen(function* () {
    const logger = yield* Logger;

    const filterManufacturerId = Number(process.argv[3]);

    if (filterManufacturerId) {
        logger.info("Filtering manufacturer id %s", filterManufacturerId);
    }

    yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
            logger.info("BLE mode finalizer called");
        })
    );

    return yield* scan().pipe(
        Stream.tap((peripheral) =>
            Effect.sync(() => {
                const manufacturerId = getManufacturerId(peripheral);

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
    const logger = yield* Logger;

    const filterDeviceType = isDeviceType(process.argv[3]) ? process.argv[3] : undefined;

    if (filterDeviceType) {
        logger.info("Filtering device type %s", filterDeviceType);
    }

    yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
            logger.info("Gateway mode finalizer called");
        })
    );

    const bleGateway = yield* makeBleGateway();

    const eventStream = bleGateway
        .deviceMessages(scan())
        .pipe(Stream.filter((message) => !filterDeviceType || message.device.type === filterDeviceType));

    return yield* eventStream.pipe(
        Stream.tap((message) =>
            Effect.sync(() => {
                logger.info("Received Device message %s", JSON.stringify(message));
            })
        ),
        Stream.runDrain
    );
});

const mqttMode = Effect.gen(function* () {
    const logger = yield* Logger;

    yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
            logger.info("MQTT mode finalizer called");
        })
    );

    const bleGateway = yield* makeBleGateway();
    const homeAssistantMqttMessageProducer = yield* makeHomeAssistantMqttMessageProducer();

    const filterDeviceType = isDeviceType(process.argv[3]) ? process.argv[3] : undefined;

    if (filterDeviceType) {
        logger.info("Filtering device type %s", filterDeviceType);
    }

    const eventStream = bleGateway
        .deviceMessages(scan())
        .pipe(Stream.filter((message) => !filterDeviceType || message.device.type === filterDeviceType));

    return yield* eventStream.pipe(
        Stream.flatMap((message) => homeAssistantMqttMessageProducer(message), { concurrency: "unbounded" }),
        Stream.tap((message) => Effect.sync(() => logger.info("Received MQTT message %s", JSON.stringify(message)))),
        Stream.runDrain
    );
});

const DevLive = Layer.mergeAll(Config.Default, Logger.Default);

const devProgram = Effect.gen(function* () {
    const logger = yield* Logger;
    const mode: string | undefined = process.argv[2];

    logger.info("Dev mode: %s", mode);

    yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
            logger.info("Dev program finalizer called - shutting down");
        })
    );

    const selectedMode = yield* Match.value(mode).pipe(
        Match.when("ble", () => Effect.succeed(bleMode)),
        Match.when("gateway", () => Effect.succeed(gatewayMode)),
        Match.when("mqtt", () => Effect.succeed(mqttMode)),
        Match.orElse((m) => Effect.fail(`Unknown mode ${m}`))
    );

    return yield* selectedMode;
});

const configuredDevProgram = Effect.provide(Effect.scoped(devProgram), DevLive);
NodeRuntime.runMain(configuredDevProgram);
