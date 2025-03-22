import { Config } from "../config";
import {
    makeRuuvitagDeviceRegistry,
    makeRuuvitagGateway,
    PeripheralWithoutManufacturerDataError,
} from "./ruuvitag/ruuvitag-gateway";
import { Peripheral } from "@abandonware/noble";
import { merge, mergeMap, Observable } from "rxjs";
import { BleGatewayMessage, DeviceAvailabilityMessage, DeviceMessage, DeviceSensorMessage } from "../types";
import { UnknownGateway } from "./unknown-gateway";
import { scan } from "../infra/ble-scanner";
import { filter, mergeWith } from "rxjs/operators";
import { isMiFloraPeripheral, MiFloraGateway, mifloraGatewayId } from "./miflora/miflora-gateway";
import { Effect, Stream, Option, pipe, Data } from "effect";
import { DeviceRegistry } from "./device-registry";
import { ruuviTagManufacturerId } from "./ruuvitag/ruuvitag-parser/ruuvitag-validator";
import { DeviceNotFoundError, DeviceRegistryService, streamUnavailableDevices } from "./abstract-gateway";
import { RuuviParsingError } from "./ruuvitag/ruuvitag-parser";

export interface Gateway {
    mapMessage: MapMessage;
    deviceRegistry: DeviceRegistry;
}

const resolveGatewayId = (peripheral: Peripheral): number | undefined => {
    const manufacturerId = peripheral.advertisement.manufacturerData?.readUInt16LE();

    if (!manufacturerId && isMiFloraPeripheral(peripheral)) {
        return mifloraGatewayId;
    }

    return manufacturerId;
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

const makeGateway = (
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

    // if (config.miflora !== undefined) {
    //     const miFloraGateway = new MiFloraGateway(config.miflora.devices, config.miflora.timeout);
    //     configuredGateways.set(miFloraGateway.getGatewayId(), miFloraGateway);
    // }

    return (peripheralStream: Stream.Stream<Peripheral>) => {
        return Stream.merge(
            peripheralStream.pipe(
                Stream.flatMap((peripheral) => {
                    const gatewayId = resolveGatewayId(peripheral);

                    if (!gatewayId) {
                        return Stream.make(Option.none());
                    }

                    const gateway = configuredGateways.get(gatewayId);

                    if (!gateway) {
                        return Stream.make(Option.none());
                    }

                    return pipe(
                        Stream.fromIterableEffect(
                            Effect.provideService(
                                gateway.mapMessage(peripheral),
                                DeviceRegistryService,
                                gateway.deviceRegistry
                            )
                        ),
                        Stream.map((message) => Option.some(message))
                    );
                }),
                Stream.filter(Option.isSome),
                Stream.map((option) => option.value)
            ),
            makeUnavailableDevicesStream(configuredGateways)
        );
    };
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
