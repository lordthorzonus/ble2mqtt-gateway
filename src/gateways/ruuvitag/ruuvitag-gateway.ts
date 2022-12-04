import { DeviceRegistry } from "../device-registry";
import { Peripheral, PeripheralWithManufacturerData } from "@abandonware/noble";
import { DeviceSensorMessage, DeviceType } from "../../types";
import { transformPeripheralAdvertisementToSensorDataDeviceMessage } from "./ruuvitag-measurement-transformer";
import { Observable } from "rxjs";
import { Config } from "../../config";
import { Gateway } from "../ble-gateway";
import { ruuviTagManufacturerId } from "./ruuvitag-parser/ruuvitag-validator";
import { AbstractGateway } from "../abstract-gateway";

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

    public getGatewayId(): number {
        return ruuviTagManufacturerId;
    }

    private validatePeripheral(peripheral: Peripheral): asserts peripheral is PeripheralWithManufacturerData {
        if (peripheral.advertisement.manufacturerData === undefined) {
            throw new Error(
                `Somehow a peripheral without manufacturingData got into RuuviTagGateway: ${JSON.stringify(peripheral)}`
            );
        }
    }

    protected handleDeviceSensorData(peripheral: Peripheral): Observable<DeviceSensorMessage> {
        const id = peripheral.uuid;
        this.validatePeripheral(peripheral);
        return new Observable((subscriber) => {
            const device = this.getDeviceRegistryEntry(id);
            subscriber.next(transformPeripheralAdvertisementToSensorDataDeviceMessage(peripheral, device));
            subscriber.complete();
        });
    }
}
