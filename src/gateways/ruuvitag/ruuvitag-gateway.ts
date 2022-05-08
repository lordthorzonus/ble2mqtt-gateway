import { DeviceRegistry } from "../device-registry";
import { Peripheral } from "@abandonware/noble";
import { DeviceMessage, DeviceType } from "../../types";
import { transformPeripheralAdvertisementToSensorDataDeviceMessage } from "./ruuvitag-measurement-transformer";
import { Observable } from "rxjs";
import { Config } from "../../config";
import { Gateway } from "../ble-gateway";
import { ruuviTagManufacturerId } from "./ruuvitag-parser/ruuvitag-validator";
import { AbstractGateway } from "./abstract-gateway";

type ConfiguredRuuviTags = Required<Config["gateways"]>["ruuvitag"]["devices"];

export class RuuviTagGateway extends AbstractGateway implements Gateway {
    constructor(ruuviTagSettings: ConfiguredRuuviTags, defaultTimeout: number, unknownRuuviTagsAllowed: boolean) {
        const deviceSettings = ruuviTagSettings.map((tag) => ({
            device: {
                id: tag.id,
                type: DeviceType.Ruuvitag,
                friendlyName: tag.name,
            },
            timeout: tag.timeout,
        }));

        super(new DeviceRegistry(deviceSettings, defaultTimeout), unknownRuuviTagsAllowed, DeviceType.Ruuvitag);
    }

    public getManufacturerId(): number {
        return ruuviTagManufacturerId;
    }

    protected handleDeviceSensorData(peripheral: Peripheral): Observable<DeviceMessage> {
        const id = peripheral.uuid;
        return new Observable((subscriber) => {
            const device = this.getDeviceRegistryEntry(id);
            subscriber.next(transformPeripheralAdvertisementToSensorDataDeviceMessage(peripheral, device));
            subscriber.complete();
        });
    }
}
