import { Device, DeviceType } from "../types";
import { from, interval, map, mergeMap, Observable } from "rxjs";
import { filter } from "rxjs/operators";
import { Peripheral } from "@abandonware/noble";
import { DateTime } from "luxon";

export interface DeviceSettings {
    device: Device;
    timeout?: number;
}

export interface DeviceRegistryEntry extends DeviceSettings {
    lastSeen: DateTime | null;
    availability: "online" | "offline";
    lastPublishedAvailability: "online" | "offline";
    timeout: number;
}

export class DeviceRegistry {
    private readonly devices = new Map<string, DeviceRegistryEntry>();
    private readonly defaultTimeout: number;

    public constructor(settings: DeviceSettings[], defaultTimeout: number) {
        settings.forEach((setting) =>
            this.devices.set(setting.device.id, {
                ...setting,
                lastSeen: null,
                availability: "offline",
                lastPublishedAvailability: "offline",
                timeout: setting.timeout ?? defaultTimeout,
            })
        );

        this.defaultTimeout = defaultTimeout;
    }

    public get(id: string): DeviceRegistryEntry | null {
        return this.devices.get(id) || null;
    }

    public has(id: string): boolean {
        return this.devices.has(id);
    }

    public registerUnknownDevice(peripheral: Peripheral, deviceType: DeviceType): void {
        const deviceRegistryEntry: DeviceRegistryEntry = {
            device: {
                id: peripheral.uuid,
                type: deviceType,
                friendlyName: peripheral.uuid,
            },
            availability: "offline",
            lastSeen: null,
            timeout: this.defaultTimeout,
            lastPublishedAvailability: "offline",
        };
        this.devices.set(peripheral.uuid, deviceRegistryEntry);
    }

    public registerFoundAdvertisement(deviceId: string): void {
        const device = this.devices.get(deviceId);

        if (!device) {
            return;
        }

        const updatedDeviceEntry = DeviceRegistry.markDeviceAvailable(device);
        this.devices.set(deviceId, updatedDeviceEntry);

        return;
    }

    public registerDeviceStatusPublished(deviceId: string): void {
        const device = this.devices.get(deviceId);

        if (!device) {
            return;
        }

        const updatedDeviceEntry = {
            ...device,
            lastPublishedAvailability: device.availability,
        };

        this.devices.set(deviceId, updatedDeviceEntry);

        return;
    }

    private registerDeviceAsUnavailable(device: DeviceRegistryEntry): DeviceRegistryEntry {
        const updatedDeviceEntry = DeviceRegistry.markDeviceUnavailable(device);
        this.devices.set(device.device.id, updatedDeviceEntry);

        return updatedDeviceEntry;
    }

    private static markDeviceAvailable(device: DeviceRegistryEntry): DeviceRegistryEntry {
        return {
            ...device,
            lastSeen: DateTime.now(),
            availability: "online",
        };
    }

    private static markDeviceUnavailable(device: DeviceRegistryEntry): DeviceRegistryEntry {
        return {
            ...device,
            availability: "offline",
        };
    }

    private static isDeviceUnavailable(device: DeviceRegistryEntry): boolean {
        if (device.lastSeen === null) {
            return true;
        }

        const difference = -device.lastSeen.diffNow().toMillis();

        return difference > device.timeout;
    }

    public observeUnavailableDevices(): Observable<DeviceRegistryEntry> {
        return interval(10000).pipe(
            mergeMap(() => {
                return from(this.devices.values()).pipe(
                    filter((device) => DeviceRegistry.isDeviceUnavailable(device)),
                    filter((device) => device.availability === "online"),
                    map((device) => {
                        return this.registerDeviceAsUnavailable(device);
                    })
                );
            })
        );
    }
}
