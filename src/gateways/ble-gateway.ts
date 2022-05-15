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
    getGatewayId(): number;
}

export class BleGateway {
    private readonly configuredGateways: Map<number, Gateway>;
    private readonly defaultGateway: Gateway = new UnknownGateway();
    private miFloraGatewayId?: number;

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
            this.configuredGateways.set(ruuviGateway.getGatewayId(), ruuviGateway);
        }

        if (config.miflora !== undefined) {
            const miFloraGateway = new MiFloraGateway(config.miflora.devices, config.miflora.timeout);
            this.miFloraGatewayId = miFloraGateway.getGatewayId();
            this.configuredGateways.set(miFloraGateway.getGatewayId(), miFloraGateway);
        }
    }

    private getGatewayId(peripheral: Peripheral) {
        const manufacturerId = peripheral.advertisement.manufacturerData?.readUInt16LE();

        if (!manufacturerId && MiFloraGateway.isMiFloraPeripheral(peripheral)) {
            return this.miFloraGatewayId;
        }

        return manufacturerId;
    }

    private resolveGateway(peripheral: Peripheral) {
        const gatewayId = this.getGatewayId(peripheral);

        if (!gatewayId) {
            return this.defaultGateway;
        }

        const gateway = this.configuredGateways.get(gatewayId);

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
