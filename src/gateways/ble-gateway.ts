import { Config } from "../config.js";
import { makeRuuvitagDeviceRegistry, makeRuuvitagGateway } from "./ruuvitag/ruuvitag-gateway.js";
import { DeviceAvailabilityMessage, DeviceMessage } from "../types.js";
import {
    isMiFloraPeripheral,
    makeMiFloraDeviceRegistry,
    mifloraGatewayId,
    makeMiFloraGateway,
} from "./miflora/miflora-gateway.js";
import { makeOralbDeviceRegistry, makeOralbGateway } from "./oralb/oralb-gateway.js";
import { Effect, Stream, Option, Data, Duration } from "effect";
import { DeviceRegistry } from "./device-registry.js";
import { DeviceRegistryService, streamAvailabilityHeartbeat, streamUnavailableDevices } from "./gateway-helpers.js";
import { Logger } from "../infra/logger.js";
import { ruuviTagManufacturerId } from "./ruuvitag/ruuvitag-parser/index.js";
import { oralbManufacturerId } from "./oralb/oralb-parser.js";
import { Peripheral } from "../infra/ble-scanner.js";

export interface Gateway {
    mapMessage: MapMessage;
    deviceRegistry: DeviceRegistry;
}

/** Routes BLE advertisements to the configured device gateways. */
export interface BleGateway {
    /**
     * Maps advertisements to device messages one at a time, because gateways mutate their device registries.
     * Merges in offline transitions and the availability heartbeat. Gateway errors are logged and the
     * advertisement is dropped, so the stream only fails when `peripherals` fails.
     */
    deviceMessages: <E, R>(peripherals: Stream.Stream<Peripheral, E, R>) => Stream.Stream<DeviceMessage, E, R>;
}

const AVAILABILITY_HEARTBEAT_INTERVAL = Duration.minutes(5);

export const getManufacturerId = (peripheral: Peripheral): number | undefined => {
    const manufacturerData = peripheral.advertisement.manufacturerData;
    return manufacturerData && manufacturerData.length >= 2 ? manufacturerData.readUInt16LE(0) : undefined;
};

const resolveGatewayId = (peripheral: Peripheral): Option.Option<number> => {
    const manufacturerId = getManufacturerId(peripheral);

    if (!manufacturerId && isMiFloraPeripheral(peripheral)) {
        return Option.some(mifloraGatewayId);
    }

    if (manufacturerId) {
        return Option.some(manufacturerId);
    }

    return Option.none();
};

export class GatewayError extends Data.TaggedError("GatewayError")<{
    peripheral: Peripheral;
    message: string;
}> {}

export type MapMessage = (
    peripheral: Peripheral
) => Effect.Effect<Iterable<DeviceMessage>, GatewayError, DeviceRegistryService>;

const makeAvailabilityStream = (
    gateways: Map<number, Gateway>
): Stream.Stream<DeviceAvailabilityMessage, never, Config> => {
    const streams = Array.from(gateways.values()).map((gateway) =>
        Stream.provideService(
            Stream.merge(streamUnavailableDevices, streamAvailabilityHeartbeat(AVAILABILITY_HEARTBEAT_INTERVAL)),
            DeviceRegistryService,
            gateway.deviceRegistry
        )
    );

    return Stream.mergeAll(streams, {
        concurrency: "unbounded",
    });
};

const resolveGatewayForPeripheral = (
    peripheral: Peripheral,
    configuredGateways: Map<number, Gateway>
): Option.Option<{
    peripheral: Peripheral;
    gateway: Gateway;
}> =>
    Option.gen(function* () {
        const gatewayId = yield* resolveGatewayId(peripheral);
        const gateway = yield* Option.fromNullable(configuredGateways.get(gatewayId));

        return {
            gateway,
            peripheral,
        };
    });

/** Builds the BLE gateway from the configured device gateways (RuuviTag, MiFlora, Oral-B). */
export const makeBleGateway = (): Effect.Effect<BleGateway, never, Config | Logger> =>
    Effect.gen(function* () {
        const configuredGateways = new Map<number, Gateway>();
        const config = yield* Config;
        const logger = yield* Logger;

        const globalDefaults = {
            defaultDecimalPrecision: config.decimal_precision,
        };

        if (config.gateways.ruuvitag !== undefined) {
            const ruuviGateway = makeRuuvitagGateway(config.gateways.ruuvitag);
            configuredGateways.set(ruuviTagManufacturerId, {
                mapMessage: ruuviGateway,
                deviceRegistry: makeRuuvitagDeviceRegistry(config.gateways.ruuvitag, globalDefaults),
            });
            logger.info("configured gateway to work with RuuviTags");
        }

        if (config.gateways.miflora !== undefined) {
            const miFloraGateway = makeMiFloraGateway(config.gateways.miflora);
            configuredGateways.set(mifloraGatewayId, {
                mapMessage: miFloraGateway,
                deviceRegistry: makeMiFloraDeviceRegistry(config.gateways.miflora, globalDefaults),
            });

            logger.info("configured gateway to work with MiFlora");
        }

        if (config.gateways.oralb !== undefined) {
            const oralbGateway = makeOralbGateway(config.gateways.oralb);
            configuredGateways.set(oralbManufacturerId, {
                mapMessage: oralbGateway,
                deviceRegistry: makeOralbDeviceRegistry(config.gateways.oralb, globalDefaults),
            });

            logger.info("configured gateway to work with Oral-B toothbrushes");
        }

        const routePeripheral = (peripheral: Peripheral): Effect.Effect<Iterable<DeviceMessage>, GatewayError> =>
            Option.match(resolveGatewayForPeripheral(peripheral, configuredGateways), {
                onNone: () => Effect.succeed([]),
                onSome: ({ gateway }) =>
                    Effect.provideService(
                        gateway.mapMessage(peripheral),
                        DeviceRegistryService,
                        gateway.deviceRegistry
                    ),
            });

        const mapPeripheral = (peripheral: Peripheral): Effect.Effect<Iterable<DeviceMessage>> =>
            Effect.catchTag(routePeripheral(peripheral), "GatewayError", (error) =>
                Effect.sync(() => {
                    logger.error("BLE Gateway error", { peripheral: error.peripheral, message: error.message });
                    return [];
                })
            );

        const availabilityMessages = Stream.provideService(makeAvailabilityStream(configuredGateways), Config, config);

        return {
            deviceMessages: (peripherals) =>
                peripherals.pipe(
                    Stream.mapEffect(mapPeripheral),
                    Stream.flattenIterables,
                    Stream.merge(availabilityMessages)
                ),
        };
    });
