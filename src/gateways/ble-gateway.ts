import { Config } from "../config";
import { RuuviTagGateway } from "./ruuvitag/ruuvitag-gateway";
import { Peripheral } from "@abandonware/noble";
import { map, merge, mergeMap, Observable, tap } from "rxjs";
import { AnalyticsMessage, BleGatewayMessage, DeviceAvailabilityMessage, DeviceSensorMessage } from "../types";
import { UnknownGateway } from "./unknown-gateway";
import { scan } from "../infra/ble-scanner";
import { filter, mergeWith } from "rxjs/operators";
import { MiFloraGateway } from "./miflora/miflora-gateway";
import { GatewayAnalytics } from "./analytics/gateway-analytics";
import { generateAnalyticsMessage } from "./message-generators";

export interface Gateway {
    handleBleAdvertisement(peripheral: Peripheral): Observable<DeviceSensorMessage | DeviceAvailabilityMessage | null>;
    observeUnavailableDevices(): Observable<DeviceAvailabilityMessage>;
    getGatewayId(): number;
}

export class BleGateway {
    private readonly configuredGateways: Map<number, Gateway>;
    private readonly defaultGateway: Gateway = new UnknownGateway();
    private miFloraGatewayId?: number;
    private analytics: GatewayAnalytics;

    constructor(config: Config["gateways"]) {
        this.configuredGateways = new Map();
        this.configureGateways(config);
        this.analytics = new GatewayAnalytics();
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

    private scanBleAdvertisements(): Observable<DeviceSensorMessage | DeviceAvailabilityMessage> {
        return scan().pipe(
            tap(() => this.analytics.recordBluetoothAdvertisement()),
            mergeMap((peripheral) => {
                const gateway = this.resolveGateway(peripheral);
                return gateway.handleBleAdvertisement(peripheral).pipe(
                    filter((message): message is DeviceSensorMessage | DeviceAvailabilityMessage => message !== null),
                    tap((message) => {
                        this.analytics.recordDeviceMessage(message.device.type);
                    })
                );
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

    private observeAnalytics(): Observable<AnalyticsMessage> {
        return this.analytics.observeAnalytics().pipe(map(generateAnalyticsMessage));
    }

    public observeEvents(): Observable<BleGatewayMessage> {
        return this.scanBleAdvertisements().pipe(mergeWith(this.observeUnavailableDevices(), this.observeAnalytics()));
    }
}
