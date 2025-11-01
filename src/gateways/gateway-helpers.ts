import { DeviceAvailabilityMessage, DeviceMessage, DeviceSensorMessage, DeviceType } from "../types";
import { generateAvailabilityMessage } from "./message-generators";
import { DeviceRegistry, DeviceRegistryEntry } from "./device-registry";
import { Data, Effect, Stream, Context, Option, pipe, Schedule } from "effect";
import { Logger } from "../infra/logger";
import { Config } from "../config";
import { Peripheral } from "../infra/ble-scanner";

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
    deviceType: DeviceType,
    deviceModel: string
): Effect.Effect<Option.Option<DeviceAvailabilityMessage>, DeviceNotFoundError, DeviceRegistryService> =>
    Effect.gen(function* () {
        const id = peripheral.uuid;
        const deviceRegistry = yield* DeviceRegistryService;

        if (!deviceRegistry.has(id)) {
            deviceRegistry.registerUnknownDevice(peripheral, deviceType, deviceModel);
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

export const handleBleAdvertisement = <TError, TPeripheral extends Peripheral, TDeviceModel extends string>(
    peripheral: TPeripheral,
    deviceType: DeviceType,
    unknownDevicesAllowed: boolean,
    resolveDeviceModel: (peripheral: TPeripheral) => Effect.Effect<TDeviceModel, TError>,
    handleDeviceSensorData: (
        peripheral: TPeripheral,
        deviceRegistryEntry: DeviceRegistryEntry
    ) => Effect.Effect<Option.Option<DeviceSensorMessage>, TError, DeviceRegistryService | Logger>
): Effect.Effect<Iterable<DeviceMessage>, DeviceNotFoundError | TError, DeviceRegistryService | Logger> =>
    Effect.gen(function* () {
        const id = peripheral.uuid;
        const deviceRegistry = yield* DeviceRegistryService;

        if (deviceRegistry.has(id) || unknownDevicesAllowed) {
            const deviceModel = yield* resolveDeviceModel(peripheral);
            const availabilityMessage = yield* handleDeviceAvailability(peripheral, deviceType, deviceModel);
            const deviceRegistryEntry = deviceRegistry.get(id);

            if (deviceRegistryEntry === null) {
                return yield* new DeviceNotFoundError({ id });
            }

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

export const streamUnavailableDevices: Stream.Stream<DeviceAvailabilityMessage, never, DeviceRegistryService | Config> =
    pipe(
        Effect.gen(function* () {
            const deviceRegistry = yield* DeviceRegistryService;
            const config = yield* Config;

            return pipe(
                Stream.fromSchedule(Schedule.spaced(config.unavailable_devices_check_interval_ms)),
                Stream.flatMap(() => {
                    return Stream.fromIterable(deviceRegistry.getUnavailableDevices());
                }),
                Stream.tap((device) =>
                    Effect.sync(() => {
                        deviceRegistry.registerDeviceStatusPublished(device.device.id);
                    })
                ),
                Stream.map((device) => generateAvailabilityMessage(device, "offline"))
            );
        }),
        Stream.fromEffect,
        Stream.flatten()
    );
