import { Config } from "../config";
import { makeRuuvitagDeviceRegistry, makeRuuvitagGateway } from "./ruuvitag/ruuvitag-gateway";
import { DeviceAvailabilityMessage, DeviceMessage } from "../types";
import {
    isMiFloraPeripheral,
    makeMiFloraDeviceRegistry,
    mifloraGatewayId,
    makeMiFloraGateway,
} from "./miflora/miflora-gateway";
import { Effect, Stream, Option, Data } from "effect";
import { DeviceRegistry } from "./device-registry";
import { DeviceRegistryService, streamUnavailableDevices } from "./gateway-helpers";
import { Logger } from "../infra/logger";
import { ruuviTagManufacturerId } from "./ruuvitag/ruuvitag-parser";
import { BleScannerError, Peripheral } from "../infra/ble-scanner";

export interface Gateway {
    mapMessage: MapMessage;
    deviceRegistry: DeviceRegistry;
}

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
) => Effect.Effect<Iterable<DeviceMessage>, GatewayError, DeviceRegistryService | Logger>;

const makeUnavailableDevicesStream = (
    gateways: Map<number, Gateway>
): Stream.Stream<DeviceAvailabilityMessage, never, Config> => {
    const gatewaysArray = Array.from(gateways.values());
    const streams = gatewaysArray.map((gateway) =>
        Stream.provideService(streamUnavailableDevices, DeviceRegistryService, gateway.deviceRegistry)
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

export const makeBleGateway = () =>
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

        return (
            peripheralMessage: Stream.Stream<Peripheral, BleScannerError, Logger>
        ): Stream.Stream<DeviceMessage, GatewayError | BleScannerError, Logger | Config> =>
            peripheralMessage.pipe(
                Stream.filterMap((p) => resolveGatewayForPeripheral(p, configuredGateways)),
                Stream.flatMap(
                    ({ peripheral, gateway }) =>
                        Stream.fromIterableEffect(
                            Effect.provideService(
                                gateway.mapMessage(peripheral),
                                DeviceRegistryService,
                                gateway.deviceRegistry
                            )
                        ),
                    { concurrency: config.concurrency.ble_gateway_processing }
                ),
                Stream.merge(makeUnavailableDevicesStream(configuredGateways))
            );
    });
