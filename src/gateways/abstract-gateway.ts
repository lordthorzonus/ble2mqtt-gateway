import { Peripheral } from "@abandonware/noble";
import { concat, EMPTY, map, Observable } from "rxjs";
import { DeviceAvailabilityMessage, DeviceMessage, DeviceType } from "../types";
import { generateAvailabilityMessage } from "./availability-message-generator";
import { DeviceRegistry, DeviceRegistryEntry } from "./device-registry";
import { Gateway } from "./ble-gateway";

export abstract class AbstractGateway implements Gateway {
    protected readonly deviceRegistry: DeviceRegistry;
    protected readonly unknownDevicesAllowed: boolean;
    protected readonly deviceType: DeviceType;

    protected constructor(deviceRegistry: DeviceRegistry, unknownDevicesAllowed: boolean, deviceType: DeviceType) {
        this.deviceRegistry = deviceRegistry;
        this.unknownDevicesAllowed = unknownDevicesAllowed;
        this.deviceType = deviceType;
    }

    protected handleDeviceAvailability(peripheral: Peripheral): Observable<DeviceAvailabilityMessage> {
        const id = peripheral.uuid;
        return new Observable((subscriber) => {
            if (!this.deviceRegistry.has(id)) {
                this.deviceRegistry.registerUnknownDevice(peripheral, this.deviceType);
            }

            this.deviceRegistry.registerFoundAdvertisement(id);
            const device = this.getDeviceRegistryEntry(id);

            if (AbstractGateway.shouldDeviceAvailabilityBeBroadcast(device)) {
                subscriber.next(generateAvailabilityMessage(device, "online", peripheral));
                this.deviceRegistry.registerDeviceStatusPublished(id);
            }

            subscriber.complete();
        });
    }

    protected getDeviceRegistryEntry(id: string): DeviceRegistryEntry {
        const device = this.deviceRegistry.get(id);

        if (!device) {
            throw new Error(`Could not find ${this.deviceType} from registry with id: "${id}"`);
        }

        return device;
    }

    private static shouldDeviceAvailabilityBeBroadcast(deviceRegistryEntry: DeviceRegistryEntry) {
        return deviceRegistryEntry.availability !== deviceRegistryEntry.lastPublishedAvailability;
    }

    abstract getGatewayId(): number;

    public handleBleAdvertisement(peripheral: Peripheral): Observable<DeviceMessage | DeviceAvailabilityMessage> {
        const id = peripheral.uuid;

        if (this.deviceRegistry.has(id) || this.unknownDevicesAllowed) {
            return concat(this.handleDeviceAvailability(peripheral), this.handleDeviceSensorData(peripheral));
        }

        return EMPTY;
    }

    protected abstract handleDeviceSensorData(peripheral: Peripheral): Observable<DeviceMessage>;

    public observeUnavailableDevices(): Observable<DeviceAvailabilityMessage> {
        return this.deviceRegistry.observeUnavailableDevices().pipe(
            map((device) => {
                this.deviceRegistry.registerDeviceStatusPublished(device.device.id);
                return generateAvailabilityMessage(device, "offline");
            })
        );
    }
}
