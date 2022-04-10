import { DeviceRegistry, DeviceRegistryEntry } from "../device-registry";
import { Peripheral } from "@abandonware/noble";
import { Device, DeviceAvailabilityMessage, DeviceMessage, DeviceMessageType, DeviceType } from "../../types";
import { transformPeripheralAdvertisementToSensorDataDeviceMessage } from "./ruuvitag-measurement-transformer";
import { map, Observable } from "rxjs";
import { v4 as uuid } from "uuid";
import { Config } from "../../config";
import { DateTime } from "luxon";
import { Gateway } from "../ble-gateway";
import { ruuviTagManufacturerId } from "./ruuvitag-parser/ruuvitag-validator";

type ConfiguredRuuviTags = Required<Config["gateways"]>["ruuvitag"]["devices"];

const shouldRuuviTagStatusBeBroadcast = (ruuviTag: DeviceRegistryEntry) =>
    ruuviTag.availability !== ruuviTag.lastPublishedAvailability;

export class RuuviTagGateway implements Gateway {
    private readonly deviceRegistry: DeviceRegistry;
    private readonly unknownRuuvitagsAllowed: boolean;

    constructor(ruuviTagSettings: ConfiguredRuuviTags, defaultTimeout: number, unknownRuuviTagsAllowed: boolean) {
        this.unknownRuuvitagsAllowed = unknownRuuviTagsAllowed;

        const deviceSettings = ruuviTagSettings.map((tag) => ({
            device: {
                id: tag.id,
                type: DeviceType.Ruuvitag,
                friendlyName: tag.name,
            },
            timeout: tag.timeout,
        }));

        this.deviceRegistry = new DeviceRegistry(deviceSettings, defaultTimeout);
    }

    private getDeviceRegistryEntry(id: string) {
        const device = this.deviceRegistry.get(id);

        if (!device) {
            throw new Error(`Could not find RuuviTag from registry with id: "${id}"`);
        }

        return device;
    }

    public handleBleAdvertisement(
        peripheral: Peripheral
    ): Observable<DeviceMessage | DeviceAvailabilityMessage | null> {
        const id = peripheral.uuid;
        return new Observable((subscriber) => {
            if (!this.deviceRegistry.has(id)) {
                if (!this.unknownRuuvitagsAllowed) {
                    subscriber.next(null);
                    subscriber.complete();
                    return;
                }

                this.deviceRegistry.registerUnknownDevice(peripheral, DeviceType.Ruuvitag);
            }

            this.deviceRegistry.registerFoundAdvertisement(id);
            const device = this.getDeviceRegistryEntry(id);

            if (shouldRuuviTagStatusBeBroadcast(device)) {
                subscriber.next(generateAvailabilityMessage(device.device, "online"));
                this.deviceRegistry.registerDeviceStatusPublished(id);
            }

            subscriber.next(transformPeripheralAdvertisementToSensorDataDeviceMessage(peripheral, device.device));
            subscriber.complete();
        });
    }

    public observeUnavailableDevices(): Observable<DeviceAvailabilityMessage> {
        return this.deviceRegistry.observeUnavailableDevices().pipe(
            map((ruuviTag) => {
                this.deviceRegistry.registerDeviceStatusPublished(ruuviTag.device.id);
                return generateAvailabilityMessage(ruuviTag.device, "offline");
            })
        );
    }

    public getManufacturerId(): number {
        return ruuviTagManufacturerId;
    }
}

const generateAvailabilityMessage = (
    device: Device,
    state: "online" | "offline",
    peripheral?: Peripheral
): DeviceAvailabilityMessage => {
    return {
        id: uuid(),
        type: DeviceMessageType.Availability,
        device: {
            macAddress: device.id,
            id: device.id,
            friendlyName: device.friendlyName,
            type: DeviceType.Ruuvitag,
            rssi: peripheral?.rssi || null,
        },
        time: DateTime.now(),
        payload: {
            state,
        },
    };
};
