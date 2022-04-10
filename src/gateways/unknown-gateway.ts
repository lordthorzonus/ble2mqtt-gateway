import { Gateway } from "./ble-gateway";
import { DeviceAvailabilityMessage, DeviceMessage } from "../types";
import { EMPTY, from, Observable } from "rxjs";

export class UnknownGateway implements Gateway {
    public handleBleAdvertisement(): Observable<DeviceMessage | DeviceAvailabilityMessage | null> {
        return from([null]);
    }

    public observeUnavailableDevices(): Observable<DeviceAvailabilityMessage> {
        return EMPTY;
    }

    public getManufacturerId(): number {
        return 0;
    }
}
