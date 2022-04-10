import { Config } from "../config";
import { RuuviTagGateway } from "./ruuvitag/ruuvitag-gateway";
import { Peripheral } from "@abandonware/noble";
import { merge, mergeMap, Observable } from "rxjs";
import { DeviceAvailabilityMessage, DeviceMessage } from "../types";
import { UnknownGateway } from "./unknown-gateway";
import { scan } from "../infra/ble-scanner";
import { filter, mergeWith } from "rxjs/operators";

export interface Gateway {
    handleBleAdvertisement(peripheral: Peripheral): Observable<DeviceMessage | DeviceAvailabilityMessage | null>;
    observeUnavailableDevices(): Observable<DeviceAvailabilityMessage>;
    getManufacturerId(): number;
}

export class BleGateway {
    private configuredGateways: Map<number, Gateway>;
    private defaultGateway: Gateway = new UnknownGateway();

    constructor(config: Config["gateways"]) {
        this.configuredGateways = new Map();
        this.configureGateways(config);
    }

    private configureGateways(config: Config["gateways"]) {
        if (config.ruuvitag !== undefined) {
            const ruuviGateway = new RuuviTagGateway(
                config.ruuvitag.devices,
                config.ruuvitag.timeout,
                config.ruuvitag.allow_unknown
            );
            this.configuredGateways.set(ruuviGateway.getManufacturerId(), ruuviGateway);
        }
    }

    private resolveGateway(peripheral: Peripheral) {
        const manufacturerId = peripheral.advertisement.manufacturerData?.readUInt16LE();
        const gateway = this.configuredGateways.get(manufacturerId);

        if (!gateway) {
            return this.defaultGateway;
        }

        return gateway;
    }

    private scanBleAdvertisements() {
        return scan().pipe(
            mergeMap((peripheral) => {
                const gateway = this.resolveGateway(peripheral);
                return gateway
                    .handleBleAdvertisement(peripheral)
                    .pipe(filter((message): message is DeviceMessage | DeviceAvailabilityMessage => message !== null));
            })
        );
    }

    private observeUnavailableDevices(): Observable<DeviceAvailabilityMessage> {
        const gateways = Array.from(this.configuredGateways.values());
        return merge(
            ...gateways.map((gateway) => {
                return gateway.observeUnavailableDevices();
            })
        );
    }

    public observeEvents(): Observable<DeviceMessage | DeviceAvailabilityMessage> {
        return this.scanBleAdvertisements().pipe(mergeWith(this.observeUnavailableDevices()));
    }
}
