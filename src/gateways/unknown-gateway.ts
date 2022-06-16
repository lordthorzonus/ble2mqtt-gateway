import { Gateway } from "./ble-gateway";
import { DeviceAvailabilityMessage, DeviceSensorMessage } from "../types";
import { EMPTY, from, Observable } from "rxjs";

export class UnknownGateway implements Gateway {
    public handleBleAdvertisement(): Observable<DeviceSensorMessage | DeviceAvailabilityMessage | null> {
        return from([null]);
    }

    public observeUnavailableDevices(): Observable<DeviceAvailabilityMessage> {
        return EMPTY;
    }

    public getGatewayId(): number {
        return 0;
    }
}
