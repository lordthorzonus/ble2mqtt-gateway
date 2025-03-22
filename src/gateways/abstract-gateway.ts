import { Peripheral, PeripheralWithManufacturerData } from "@abandonware/noble";
import { DeviceAvailabilityMessage, DeviceMessage, DeviceSensorMessage, DeviceType } from "../types";
import { generateAvailabilityMessage } from "./message-generators";
import { DeviceRegistry, DeviceRegistryEntry } from "./device-registry";
import { Data, Effect, Stream, Context, Option } from "effect";

export class DeviceNotFoundError extends Data.TaggedError("DeviceNotFoundError")<{
    id: string;
}> {}

export class DeviceRegistryService extends Context.Tag("DeviceRegistryService")<
    DeviceRegistryService,
    DeviceRegistry
>() {}

const shouldDeviceAvailabilityBeBroadcast = (deviceRegistryEntry: DeviceRegistryEntry) =>
    deviceRegistryEntry.availability !== deviceRegistryEntry.lastPublishedAvailability;

const handleDeviceAvailability = (
    peripheral: Peripheral,
    deviceType: DeviceType
): Effect.Effect<Option.Option<DeviceAvailabilityMessage>, DeviceNotFoundError, DeviceRegistryService> =>
    Effect.gen(function* () {
        const id = peripheral.uuid;
        const deviceRegistry = yield* DeviceRegistryService;

        if (!deviceRegistry.has(id)) {
            deviceRegistry.registerUnknownDevice(peripheral, deviceType);
        }

        deviceRegistry.registerFoundAdvertisement(id);
        const device = deviceRegistry.get(id);

        if (device === null) {
            return yield* Effect.fail(new DeviceNotFoundError({ id }));
        }

        if (shouldDeviceAvailabilityBeBroadcast(device)) {
            deviceRegistry.registerDeviceStatusPublished(id);
            return Option.some(generateAvailabilityMessage(device, "online", peripheral));
        }

        return Option.none();
    });

export const handleBleAdvertisement = <TError, TPeripheral extends Peripheral>(
    peripheral: TPeripheral,
    deviceType: DeviceType,
    unknownDevicesAllowed: boolean,
    handleDeviceSensorData: (
        peripheral: TPeripheral,
        deviceRegistryEntry: DeviceRegistryEntry
    ) => Effect.Effect<Option.Option<DeviceSensorMessage>, TError, DeviceRegistryService>
): Effect.Effect<Iterable<DeviceMessage>, DeviceNotFoundError | TError, DeviceRegistryService> =>
    Effect.gen(function* () {
        const id = peripheral.uuid;
        const deviceRegistry = yield* DeviceRegistryService;

        if (deviceRegistry.has(id) || unknownDevicesAllowed) {
            const deviceRegistryEntry = deviceRegistry.get(id);

            if (deviceRegistryEntry === null) {
                return yield* new DeviceNotFoundError({ id });
            }

            const availabilityMessage = yield* handleDeviceAvailability(peripheral, deviceType);
            const sensorDataMessage = yield* handleDeviceSensorData(peripheral, deviceRegistryEntry);
            const messages: DeviceMessage[] = [];

            if (Option.isSome(availabilityMessage)) {
                messages.push(availabilityMessage.value);
            }

            if (Option.isSome(sensorDataMessage)) {
                messages.push(sensorDataMessage.value);
            }

            return messages;
        }
        return [];
    });

export const streamUnavailableDevices: Effect.Effect<
    Stream.Stream<DeviceAvailabilityMessage>,
    never,
    DeviceRegistryService
> = Effect.gen(function* () {
    const deviceRegistry = yield* DeviceRegistryService;
    return deviceRegistry
        .streamUnavailableDevices()
        .pipe(Stream.map((device) => generateAvailabilityMessage(device, "offline")));
});

// export abstract class AbstractGateway implements Gateway {
//     protected readonly deviceRegistry: DeviceRegistry;
//     protected readonly unknownDevicesAllowed: boolean;
//     protected readonly deviceType: DeviceType;

//     protected constructor(deviceRegistry: DeviceRegistry, unknownDevicesAllowed: boolean, deviceType: DeviceType) {
//         this.deviceRegistry = deviceRegistry;
//         this.unknownDevicesAllowed = unknownDevicesAllowed;
//         this.deviceType = deviceType;
//     }

//     protected handleDeviceAvailability(peripheral: Peripheral): Observable<DeviceAvailabilityMessage> {
//         const id = peripheral.uuid;
//         return new Observable((subscriber) => {
//             if (!this.deviceRegistry.has(id)) {
//                 this.deviceRegistry.registerUnknownDevice(peripheral, this.deviceType);
//             }

//             this.deviceRegistry.registerFoundAdvertisement(id);
//             const device = this.getDeviceRegistryEntry(id);

//             if (AbstractGateway.shouldDeviceAvailabilityBeBroadcast(device)) {
//                 subscriber.next(generateAvailabilityMessage(device, "online", peripheral));
//                 this.deviceRegistry.registerDeviceStatusPublished(id);
//             }

//             subscriber.complete();
//         });
//     }

//     protected getDeviceRegistryEntry(id: string): DeviceRegistryEntry {
//         const device = this.deviceRegistry.get(id);

//         if (!device) {
//             throw new Error(`Could not find ${this.deviceType} from registry with id: "${id}"`);
//         }

//         return device;
//     }

//     private static shouldDeviceAvailabilityBeBroadcast(deviceRegistryEntry: DeviceRegistryEntry) {
//         return deviceRegistryEntry.availability !== deviceRegistryEntry.lastPublishedAvailability;
//     }

//     abstract getGatewayId(): number;

//     public handleBleAdvertisement(peripheral: Peripheral): Observable<DeviceSensorMessage | DeviceAvailabilityMessage> {
//         const id = peripheral.uuid;

//         if (this.deviceRegistry.has(id) || this.unknownDevicesAllowed) {
//             return concat(this.handleDeviceAvailability(peripheral), this.handleDeviceSensorData(peripheral));
//         }

//         return EMPTY;
//     }

//     protected abstract handleDeviceSensorData(peripheral: Peripheral): Observable<DeviceSensorMessage>;

//     public observeUnavailableDevices(): Observable<DeviceAvailabilityMessage> {
//         return this.deviceRegistry.observeUnavailableDevices().pipe(
//             map((device) => {
//                 this.deviceRegistry.registerDeviceStatusPublished(device.device.id);
//                 return generateAvailabilityMessage(device, "offline");
//             })
//         );
//     }
// }
