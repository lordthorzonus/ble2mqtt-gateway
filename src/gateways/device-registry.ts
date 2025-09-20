import { Device, DeviceType } from "../types";
import { Peripheral } from "@abandonware/noble";
import { DateTime } from "luxon";

export interface DeviceSettings {
    device: Device;
    timeout?: number;
    decimalPrecision?: number;
}

export interface DeviceRegistryEntry extends DeviceSettings {
    lastSeen: DateTime | null;
    availability: "online" | "offline";
    lastPublishedAvailability: "online" | "offline";
    timeout: number;
    decimalPrecision: number;
}

export class DeviceRegistry {
    private readonly devices = new Map<string, DeviceRegistryEntry>();
    private readonly defaultTimeout: number;
    private readonly defaultDecimalPrecision: number;

    public constructor(settings: DeviceSettings[], defaultTimeout: number, defaultDecimalPrecision: number) {
        settings.forEach((setting) =>
            this.devices.set(setting.device.id, {
                ...setting,
                lastSeen: null,
                availability: "offline",
                lastPublishedAvailability: "offline",
                timeout: setting.timeout ?? defaultTimeout,
                decimalPrecision: setting.decimalPrecision ?? defaultDecimalPrecision,
            })
        );

        this.defaultTimeout = defaultTimeout;
        this.defaultDecimalPrecision = defaultDecimalPrecision;
    }

    public get(id: string): DeviceRegistryEntry | null {
        return this.devices.get(id) ?? null;
    }

    public has(id: string): boolean {
        return this.devices.has(id);
    }

    public registerUnknownDevice(peripheral: Peripheral, deviceType: DeviceType, deviceModel: string): void {
        const deviceRegistryEntry: DeviceRegistryEntry = {
            device: {
                id: peripheral.uuid,
                type: deviceType,
                friendlyName: peripheral.uuid,
                model: deviceModel,
            },
            availability: "offline",
            lastSeen: null,
            timeout: this.defaultTimeout,
            decimalPrecision: this.defaultDecimalPrecision,
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

    public getUnavailableDevices(): DeviceRegistryEntry[] {
        return Array.from(this.devices.values())
            .filter((device) => DeviceRegistry.isDeviceUnavailable(device))
            .filter((device) => device.availability === "online")
            .map((device) => this.registerDeviceAsUnavailable(device));
    }
}
