import { Config } from "../config";
import { RuuviTagGateway } from "./ruuvitag/ruuvitag-gateway";
import { Peripheral } from "@abandonware/noble";
import { merge, mergeMap, Observable } from "rxjs";
import { DeviceAvailabilityMessage, DeviceMessage } from "../types";
import { UnknownGateway } from "./unknown-gateway";
import { scan } from "../infra/ble-scanner";
import { filter, mergeWith } from "rxjs/operators";
import { MiFloraGateway } from "./miflora/miflora-gateway";

export interface Gateway {
    handleBleAdvertisement(peripheral: Peripheral): Observable<DeviceMessage | DeviceAvailabilityMessage | null>;
    observeUnavailableDevices(): Observable<DeviceAvailabilityMessage>;
    getManufacturerId(): number;
}

export class BleGateway {
    private readonly configuredGateways: Map<number, Gateway>;
    private readonly defaultGateway: Gateway = new UnknownGateway();

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

        if (config.miflora !== undefined) {
            const miFloraGateway = new MiFloraGateway(config.miflora.devices, config.miflora.timeout);
            this.configuredGateways.set(miFloraGateway.getManufacturerId(), miFloraGateway);
        }
    }

    private getManufacturerId(peripheral: Peripheral) {
        const manufacturerId = peripheral.advertisement.manufacturerData?.readUInt16LE();

        if (!manufacturerId && MiFloraGateway.isMiFloraPeripheral(peripheral)) {
            return MiFloraGateway.manufacturerId;
        }

        return manufacturerId;
    }

    private resolveGateway(peripheral: Peripheral) {
        const manufacturerId = this.getManufacturerId(peripheral);

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
