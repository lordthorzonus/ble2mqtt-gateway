import { DeviceAvailabilityMessage, DeviceMessage, DeviceSensorMessage, DeviceType } from "../types.js";
import { generateAvailabilityMessage } from "./message-generators.js";
import { DeviceRegistry, DeviceRegistryEntry } from "./device-registry.js";
import { Data, Duration, Effect, Stream, Context, Option, pipe, Schedule } from "effect";
import { Config } from "../config.js";
import { Peripheral } from "../infra/ble-scanner.js";

export class DeviceNotFoundError extends Data.TaggedError("DeviceNotFoundError")<{
    id: string;
}> {}

/** The device registry of the gateway that is handling the current advertisement. */
export class DeviceRegistryService extends Context.Service<DeviceRegistryService, DeviceRegistry>()(
    "DeviceRegistryService"
) {}

export interface PeripheralWithManufacturerData extends Peripheral {
    advertisement: Omit<Peripheral["advertisement"], "manufacturerData"> & {
        manufacturerData: Buffer;
    };
}

export class PeripheralWithoutManufacturerDataError extends Data.TaggedError("PeripheralWithoutManufacturerDataError")<{
    peripheral: Peripheral;
}> {}

const hasManufacturerData = (peripheral: Peripheral): peripheral is PeripheralWithManufacturerData =>
    peripheral.advertisement.manufacturerData !== undefined;

export const requireManufacturerData = (
    peripheral: Peripheral
): Effect.Effect<PeripheralWithManufacturerData, PeripheralWithoutManufacturerDataError> =>
    hasManufacturerData(peripheral)
        ? Effect.succeed(peripheral)
        : new PeripheralWithoutManufacturerDataError({ peripheral });

const shouldDeviceAvailabilityBeBroadcast = (deviceRegistryEntry: DeviceRegistryEntry) =>
    deviceRegistryEntry.availability !== deviceRegistryEntry.lastPublishedAvailability;

/**
 * Builds the online availability message when the device's availability changed, and marks it published.
 * Call only after the advertisement has been handled, so a failure can't leave availability marked
 * published without a message.
 */
const takeAvailabilityMessage = (
    deviceRegistry: DeviceRegistry,
    device: DeviceRegistryEntry,
    peripheral: Peripheral
): Option.Option<DeviceAvailabilityMessage> => {
    if (!shouldDeviceAvailabilityBeBroadcast(device)) {
        return Option.none();
    }

    deviceRegistry.registerDeviceStatusPublished(device.device.id);

    return Option.some(generateAvailabilityMessage(device, "online", peripheral));
};

export interface HandleBleAdvertisementOptions<TError, TPeripheral extends Peripheral, TAdvertisement> {
    readonly deviceType: DeviceType;
    readonly unknownDevices: "allow" | "ignore";
    readonly parseAdvertisement: (peripheral: TPeripheral) => Effect.Effect<TAdvertisement, TError>;
    /** Model to register an unknown device with. */
    readonly resolveDeviceModel: (peripheral: TPeripheral, advertisement: TAdvertisement) => string;
    readonly handleDeviceSensorData: (
        peripheral: TPeripheral,
        deviceRegistryEntry: DeviceRegistryEntry,
        advertisement: TAdvertisement
    ) => Effect.Effect<Option.Option<DeviceSensorMessage>, TError, DeviceRegistryService>;
}

/**
 * Parses the advertisement once. When parsing or sensor handling fails, availability is not marked
 * published, so the next advertisement sends it again.
 */
export const handleBleAdvertisement = <TError, TPeripheral extends Peripheral, TAdvertisement>(
    peripheral: TPeripheral,
    {
        deviceType,
        unknownDevices,
        parseAdvertisement,
        resolveDeviceModel,
        handleDeviceSensorData,
    }: HandleBleAdvertisementOptions<TError, TPeripheral, TAdvertisement>
): Effect.Effect<Iterable<DeviceMessage>, DeviceNotFoundError | TError, DeviceRegistryService> =>
    Effect.gen(function* () {
        const id = peripheral.uuid;
        const deviceRegistry = yield* DeviceRegistryService;

        if (!deviceRegistry.has(id) && unknownDevices === "ignore") {
            return [];
        }

        const advertisement = yield* parseAdvertisement(peripheral);

        if (!deviceRegistry.has(id)) {
            deviceRegistry.registerUnknownDevice(peripheral, deviceType, resolveDeviceModel(peripheral, advertisement));
        }

        deviceRegistry.registerFoundAdvertisement(id, peripheral.address);
        const deviceRegistryEntry = deviceRegistry.get(id);

        if (deviceRegistryEntry === null) {
            return yield* new DeviceNotFoundError({ id });
        }

        const sensorDataMessage = yield* handleDeviceSensorData(peripheral, deviceRegistryEntry, advertisement);
        const availabilityMessage = takeAvailabilityMessage(deviceRegistry, deviceRegistryEntry, peripheral);

        return [...Option.toArray(availabilityMessage), ...Option.toArray(sensorDataMessage)];
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

/**
 * Re-sends online availability for devices whose online state has already been published.
 * Recovers availability (and Home Assistant discovery) messages that were dropped after
 * publish retries ran out or lost by the broker.
 */
export const streamAvailabilityHeartbeat = (
    interval: Duration.Input
): Stream.Stream<DeviceAvailabilityMessage, never, DeviceRegistryService> =>
    pipe(
        DeviceRegistryService,
        Effect.map((deviceRegistry) =>
            pipe(
                Stream.fromSchedule(Schedule.spaced(interval)),
                Stream.flatMap(() => Stream.fromIterable(deviceRegistry.getPublishedOnlineDevices())),
                Stream.map((device) => generateAvailabilityMessage(device, "online"))
            )
        ),
        Stream.unwrap
    );
