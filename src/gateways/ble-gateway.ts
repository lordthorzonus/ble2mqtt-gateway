import { Config, GlobalConfiguration } from "../config.js";
import { makeRuuvitagDeviceRegistry, makeRuuvitagGateway } from "./ruuvitag/ruuvitag-gateway.js";
import { DeviceAvailabilityMessage, DeviceMessage } from "../types.js";
import { isMiFloraPeripheral, makeMiFloraDeviceRegistry, makeMiFloraGateway } from "./miflora/miflora-gateway.js";
import { makeOralbDeviceRegistry, makeOralbGateway } from "./oralb/oralb-gateway.js";
import { Effect, Stream, Option, Data, Duration } from "effect";
import { DeviceRegistry } from "./device-registry.js";
import { DeviceRegistryService, streamAvailabilityHeartbeat, streamUnavailableDevices } from "./gateway-helpers.js";
import { Logger } from "../infra/logger.js";
import { ruuviTagManufacturerId } from "./ruuvitag/ruuvitag-parser/index.js";
import { oralbManufacturerId } from "./oralb/oralb-parser.js";
import { Peripheral } from "../infra/ble-scanner.js";

interface Gateway {
    readonly name: string;
    /** Whether this gateway handles the peripheral. The first matching gateway wins. */
    readonly matches: (peripheral: Peripheral) => boolean;
    readonly mapMessage: MapMessage;
    readonly deviceRegistry: DeviceRegistry;
}

export interface BleGateway {
    /**
     * Maps advertisements to device messages one at a time and merges in offline transitions and the
     * availability heartbeat. Gateway errors are logged and the advertisement is dropped, so the stream
     * only fails when `peripherals` fails, and it ends when `peripherals` ends.
     */
    deviceMessages: <E, R>(peripherals: Stream.Stream<Peripheral, E, R>) => Stream.Stream<DeviceMessage, E, R>;
}

const AVAILABILITY_HEARTBEAT_INTERVAL = Duration.minutes(5);

export const getManufacturerId = (peripheral: Peripheral): number | undefined => {
    const manufacturerData = peripheral.advertisement.manufacturerData;

    return manufacturerData && manufacturerData.length >= 2 ? manufacturerData.readUInt16LE(0) : undefined;
};

const hasManufacturerId =
    (manufacturerId: number) =>
    (peripheral: Peripheral): boolean =>
        getManufacturerId(peripheral) === manufacturerId;

export class GatewayError extends Data.TaggedError("GatewayError")<{
    peripheral: Peripheral;
    message: string;
}> {}

export type MapMessage = (
    peripheral: Peripheral
) => Effect.Effect<Iterable<DeviceMessage>, GatewayError, DeviceRegistryService>;

const configureGateways = (config: GlobalConfiguration): readonly Gateway[] => {
    const globalDefaults = {
        defaultDecimalPrecision: config.decimal_precision,
    };

    const configured = <C>(gatewayConfig: C | undefined, makeGateway: (gatewayConfig: C) => Gateway): Gateway[] =>
        gatewayConfig === undefined ? [] : [makeGateway(gatewayConfig)];

    const { ruuvitag, miflora, oralb } = config.gateways;

    return [
        ...configured(ruuvitag, (ruuvitagConfig) => ({
            name: "RuuviTags",
            matches: hasManufacturerId(ruuviTagManufacturerId),
            mapMessage: makeRuuvitagGateway(ruuvitagConfig),
            deviceRegistry: makeRuuvitagDeviceRegistry(ruuvitagConfig, globalDefaults),
        })),
        ...configured(miflora, (mifloraConfig) => ({
            name: "MiFlora",
            matches: isMiFloraPeripheral,
            mapMessage: makeMiFloraGateway(mifloraConfig),
            deviceRegistry: makeMiFloraDeviceRegistry(mifloraConfig, globalDefaults),
        })),
        ...configured(oralb, (oralbConfig) => ({
            name: "Oral-B toothbrushes",
            matches: hasManufacturerId(oralbManufacturerId),
            mapMessage: makeOralbGateway(oralbConfig),
            deviceRegistry: makeOralbDeviceRegistry(oralbConfig, globalDefaults),
        })),
    ];
};

const makeAvailabilityStream = (
    gateways: readonly Gateway[]
): Stream.Stream<DeviceAvailabilityMessage, never, Config> => {
    const streams = gateways.map((gateway) =>
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

export const makeBleGateway: Effect.Effect<BleGateway, never, Config | Logger> = Effect.gen(function* () {
    const config = yield* Config;
    const logger = yield* Logger;
    const configuredGateways = configureGateways(config);

    configuredGateways.forEach((gateway) => logger.info(`configured gateway to work with ${gateway.name}`));

    const routePeripheral = (peripheral: Peripheral): Effect.Effect<Iterable<DeviceMessage>, GatewayError> =>
        Option.match(Option.fromNullishOr(configuredGateways.find((gateway) => gateway.matches(peripheral))), {
            onNone: () => Effect.succeed([]),
            onSome: (gateway) =>
                Effect.provideService(gateway.mapMessage(peripheral), DeviceRegistryService, gateway.deviceRegistry),
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
                Stream.flattenIterable,
                // Availability streams never end, so the merged stream follows the peripherals stream.
                Stream.merge(availabilityMessages, { haltStrategy: "left" })
            ),
    };
});
