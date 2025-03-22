import { Config } from "../config";
import { makeRuuvitagDeviceRegistry, makeRuuvitagGateway } from "./ruuvitag/ruuvitag-gateway";
import { Peripheral } from "@abandonware/noble";
import { DeviceAvailabilityMessage, DeviceMessage } from "../types";
import {
    isMiFloraPeripheral,
    makeMiFloraDeviceRegistry,
    mifloraGatewayId,
    makeMiFloraGateway

} from "./miflora/miflora-gateway";
import { Effect, Stream, Option, pipe, Data } from "effect";
import { DeviceRegistry } from "./device-registry";
import { ruuviTagManufacturerId } from "./ruuvitag/ruuvitag-parser/ruuvitag-validator";
import { DeviceRegistryService, streamUnavailableDevices } from "./abstract-gateway";

export interface Gateway {
    mapMessage: MapMessage;
    deviceRegistry: DeviceRegistry;
}

const resolveGatewayId = (peripheral: Peripheral): Option.Option<number> => {
    const manufacturerId = peripheral.advertisement.manufacturerData?.readUInt16LE();

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

type MapMessage = (
    peripheral: Peripheral
) => Effect.Effect<Iterable<DeviceMessage>, GatewayError, DeviceRegistryService>;

const makeUnavailableDevicesStream = (gateways: Map<number, Gateway>): Stream.Stream<DeviceAvailabilityMessage> => {
    const gatewaysArray = Array.from(gateways.values());
    const streams = gatewaysArray.map((gateway) =>
        Stream.unwrap(Effect.provideService(streamUnavailableDevices, DeviceRegistryService, gateway.deviceRegistry))
    );

    return Stream.mergeAll(streams, {
        concurrency: "unbounded",
    });
};

const handleBlePeripheralMessage = (
    peripheral: Peripheral,
    configuredGateways: Map<number, Gateway>
): Stream.Stream<DeviceMessage, GatewayError> =>
    pipe(
        peripheral,
        resolveGatewayId,
        Option.flatMap((gatewayId) => Option.fromNullable(configuredGateways.get(gatewayId))),
        Option.match({
            onNone: () => Stream.make(),
            onSome: (gateway) =>
                Stream.fromIterableEffect(
                    Effect.provideService(gateway.mapMessage(peripheral), DeviceRegistryService, gateway.deviceRegistry)
                ),
        })
    );

export const makeGateway = (
    config: Config["gateways"]
): ((peripheralStream: Stream.Stream<Peripheral>) => Stream.Stream<DeviceMessage, GatewayError>) => {
    const configuredGateways = new Map<number, { mapMessage: MapMessage; deviceRegistry: DeviceRegistry }>();

    if (config.ruuvitag !== undefined) {
        const ruuviGateway = makeRuuvitagGateway(config.ruuvitag);
        configuredGateways.set(ruuviTagManufacturerId, {
            mapMessage: ruuviGateway,
            deviceRegistry: makeRuuvitagDeviceRegistry(config.ruuvitag),
        });
    }

    if (config.miflora !== undefined) {
        const miFloraGateway = makeMiFloraGateway(config.miflora);
        configuredGateways.set(mifloraGatewayId, {
            mapMessage: miFloraGateway,
            deviceRegistry: makeMiFloraDeviceRegistry(config.miflora),
        });
    }

    return (peripheralStream: Stream.Stream<Peripheral>) =>
        peripheralStream.pipe(
            Stream.flatMap((peripheral) => handleBlePeripheralMessage(peripheral, configuredGateways)),
            Stream.merge(makeUnavailableDevicesStream(configuredGateways))
        );
};

// export class BleGateway {
//     private readonly configuredGateways: Map<number, Gateway>;
//     private readonly defaultGateway: Gateway = new UnknownGateway();
//     private miFloraGatewayId?: number;

//     constructor(config: Config["gateways"]) {
//         this.configuredGateways = new Map();
//         this.configureGateways(config);
//     }

//     public observeEvents(): Observable<BleGatewayMessage> {
//         return this.scanBleAdvertisements().pipe(mergeWith(this.observeUnavailableDevices()));
//     }

//     private configureGateways(config: Config["gateways"]) {
//         if (config.ruuvitag !== undefined) {
//             const ruuviGateway = new RuuviTagGateway(
//                 config.ruuvitag.devices,
//                 config.ruuvitag.timeout,
//                 config.ruuvitag.allow_unknown
//             );
//             this.configuredGateways.set(ruuviGateway.getGatewayId(), ruuviGateway);
//         }

//         if (config.miflora !== undefined) {
//             const miFloraGateway = new MiFloraGateway(config.miflora.devices, config.miflora.timeout);
//             this.miFloraGatewayId = miFloraGateway.getGatewayId();
//             this.configuredGateways.set(miFloraGateway.getGatewayId(), miFloraGateway);
//         }
//     }

//     private getGatewayId(peripheral: Peripheral) {
//         const manufacturerId = peripheral.advertisement.manufacturerData?.readUInt16LE();

//         if (!manufacturerId && MiFloraGateway.isMiFloraPeripheral(peripheral)) {
//             return this.miFloraGatewayId;
//         }

//         return manufacturerId;
//     }

//     private resolveGateway(peripheral: Peripheral) {
//         const gatewayId = this.getGatewayId(peripheral);

//         if (!gatewayId) {
//             return this.defaultGateway;
//         }

//         const gateway = this.configuredGateways.get(gatewayId);

//         if (!gateway) {
//             return this.defaultGateway;
//         }

//         return gateway;
//     }

//     private scanBleAdvertisements(): Observable<DeviceSensorMessage | DeviceAvailabilityMessage> {
//         return scan().pipe(
//             mergeMap((peripheral) => {
//                 const gateway = this.resolveGateway(peripheral);
//                 return gateway
//                     .handleBleAdvertisement(peripheral)
//                     .pipe(
//                         filter(
//                             (message): message is DeviceSensorMessage | DeviceAvailabilityMessage => message !== null
//                         )
//                     );
//             })
//         );
//     }

//     private observeUnavailableDevices(): Observable<DeviceAvailabilityMessage> {
//         const gateways = Array.from(this.configuredGateways.values());
//         return merge(
//             ...gateways.map((gateway) => {
//                 return gateway.observeUnavailableDevices();
//             })
//         );
//     }
// }
