import { GatewayError } from "../ble-gateway";
import { Peripheral } from "@abandonware/noble";
import { DeviceMessage, DeviceType } from "../../types";
import { Config } from "../../config";
import { DeviceRegistryService, handleBleAdvertisement } from "../abstract-gateway";
import { DeviceRegistry, DeviceRegistryEntry } from "../device-registry";
import { MiFloraEventBuffer } from "./miflora-event-buffer";
import { parseMiFloraPeripheralAdvertisement } from "./miflora-parser";
import { transformMiFloraMeasurementsToDeviceMessage } from "./miflora-measurement-transformer";
import { Effect, Option, pipe } from "effect";

export type ConfiguredMiFloraSensors = Required<Config["gateways"]>["miflora"]["devices"];
export const mifloraGatewayId = 0x95fe;

export const isMiFloraPeripheral = (peripheral: Peripheral): boolean => {
    const knownMiFloraDeviceNames = ["flower care", "flower mate"];
    const MiFloraMacPrefix = "c4:7c:8d";
    const deviceLocalName = peripheral.advertisement.localName ?? "";

    return (
        knownMiFloraDeviceNames.includes(deviceLocalName.toLowerCase()) ||
        peripheral.address.startsWith(MiFloraMacPrefix)
    );
};

export const makeMiFloraDeviceRegistry = (miFloraSettings: Required<Config["gateways"]>["miflora"]): DeviceRegistry => {
    const deviceSettings = miFloraSettings.devices.map((sensor) => ({
        device: {
            id: sensor.id,
            type: DeviceType.MiFlora,
            friendlyName: sensor.name,
        },
        timeout: sensor.timeout,
    }));

    return new DeviceRegistry(deviceSettings, miFloraSettings.timeout);
};

const handleMifloraBleAdvertisement = (miFloraEventBuffer: MiFloraEventBuffer) =>
    pipe((peripheral: Peripheral, deviceRegistryEntry: DeviceRegistryEntry) =>
        Effect.gen(function* () {
            const id = peripheral.uuid;
            const miFloraMeasurementEvent = yield* parseMiFloraPeripheralAdvertisement(peripheral);

            const buffer = miFloraEventBuffer.bufferMeasurementEvent(id, miFloraMeasurementEvent);

            if (miFloraEventBuffer.isBufferReady(buffer)) {
                miFloraEventBuffer.clearBuffer(id);
                return Option.some(
                    transformMiFloraMeasurementsToDeviceMessage(peripheral, deviceRegistryEntry, buffer)
                );
            }

            return Option.none();
        })
    );

export const makeMiFloraGateway =
    (miFloraSettings: Required<Config["gateways"]>["miflora"]) =>
    (peripheral: Peripheral): Effect.Effect<Iterable<DeviceMessage>, GatewayError, DeviceRegistryService> => {
        const sensorEventBuffer = new MiFloraEventBuffer(miFloraSettings.devices);

        return handleBleAdvertisement(
            peripheral,
            DeviceType.MiFlora,
            false,
            handleMifloraBleAdvertisement(sensorEventBuffer)
        ).pipe(
            Effect.catchTags({
                InvalidMiFloraAdvertisementError: (error) =>
                    new GatewayError({
                        peripheral,
                        message: `Invalid MiFlora advertisement: ${error.message}`,
                    }),
                DeviceNotFoundError: (error) =>
                    new GatewayError({
                        peripheral,
                        message: `Device not found: ${error.id}`,
                    }),
                UnsupportedMiFloraEventError: (error) =>
                    new GatewayError({
                        peripheral,
                        message: `Unsupported MiFlora event: ${error.eventType}`,
                    }),
            })
        );
    };

// export class MiFloraGateway extends AbstractGateway implements Gateway {
//     private readonly sensorEventBuffer: MiFloraEventBuffer;

//     constructor(miFloraSettings: ConfiguredMiFloraSensors, defaultTimeout: number) {
//         const deviceSettings = miFloraSettings.map((sensor) => ({
//             device: {
//                 id: sensor.id,
//                 type: DeviceType.MiFlora,
//                 friendlyName: sensor.name,
//             },
//             timeout: sensor.timeout,
//         }));
//         super(new DeviceRegistry(deviceSettings, defaultTimeout), false, DeviceType.MiFlora);

//         this.sensorEventBuffer = new MiFloraEventBuffer(miFloraSettings);
//     }

//     public static isMiFloraPeripheral = (peripheral: Peripheral): boolean => {
//         const knownMiFloraDeviceNames = ["flower care", "flower mate"];
//         const MiFloraMacPrefix = "c4:7c:8d";
//         const deviceLocalName = peripheral.advertisement.localName ?? "";

//         return (
//             knownMiFloraDeviceNames.includes(deviceLocalName.toLowerCase()) ||
//             peripheral.address.startsWith(MiFloraMacPrefix)
//         );
//     };

//     public getGatewayId(): number {
//         return mifloraGatewayId;
//     }

//     protected handleDeviceSensorData(peripheral: Peripheral): Observable<MifloraSensorMessage> {
//         const id = peripheral.uuid;

//         return new Observable<MifloraSensorMessage>((subscriber) => {
//             const miFloraMeasurementEvent = parseMiFloraPeripheralAdvertisement(peripheral);
//             const buffer = this.sensorEventBuffer.bufferMeasurementEvent(id, miFloraMeasurementEvent);

//             if (this.sensorEventBuffer.isBufferReady(buffer)) {
//                 const deviceRegistryEntry = this.getDeviceRegistryEntry(id);
//                 subscriber.next(transformMiFloraMeasurementsToDeviceMessage(peripheral, deviceRegistryEntry, buffer));
//                 this.sensorEventBuffer.clearBuffer(id);
//             }

//             subscriber.complete();
//         });
//     }
// }
