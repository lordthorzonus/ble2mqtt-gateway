import { Gateway } from "../ble-gateway";
import { Peripheral } from "@abandonware/noble";
import { DeviceMessage, DeviceType } from "../../types";
import { Observable } from "rxjs";
import { Config } from "../../config";
import { AbstractGateway } from "../ruuvitag/abstract-gateway";
import { DeviceRegistry } from "../device-registry";
import { MiFloraEventBuffer } from "./miflora-event-buffer";
import { parseMiFloraPeripheralAdvertisement } from "./miflora-parser";
import { transformMiFloraMeasurementsToDeviceMessage } from "./miflora-measurement-transformer";

export type ConfiguredMiFloraSensors = Required<Config["gateways"]>["miflora"]["devices"];

export class MiFloraGateway extends AbstractGateway implements Gateway {
    private readonly sensorEventBuffer: MiFloraEventBuffer;
    public static readonly manufacturerId: number = 0x95fe;

    constructor(miFloraSettings: ConfiguredMiFloraSensors, defaultTimeout: number) {
        const deviceSettings = miFloraSettings.map((sensor) => ({
            device: {
                id: sensor.id,
                type: DeviceType.MiFlora,
                friendlyName: sensor.name,
            },
            timeout: sensor.timeout,
        }));
        super(new DeviceRegistry(deviceSettings, defaultTimeout), false, DeviceType.MiFlora);

        this.sensorEventBuffer = new MiFloraEventBuffer(miFloraSettings);
    }

    public static isMiFloraPeripheral = (peripheral: Peripheral): boolean => {
        const knownMiFloraDeviceNames = ["flower care", "flower mate"];
        const MiFloraMacPrefix = "c4:7c:8d";

        return (
            knownMiFloraDeviceNames.includes(peripheral.advertisement.localName?.toLowerCase()) ||
            peripheral.address.startsWith(MiFloraMacPrefix)
        );
    };

    public getManufacturerId(): number {
        return MiFloraGateway.manufacturerId;
    }

    public handleDeviceSensorData(peripheral: Peripheral): Observable<DeviceMessage> {
        const id = peripheral.uuid;

        return new Observable<DeviceMessage>((subscriber) => {
            const miFloraMeasurementEvent = parseMiFloraPeripheralAdvertisement(peripheral);
            const buffer = this.sensorEventBuffer.bufferMeasurementEvent(id, miFloraMeasurementEvent);

            if (this.sensorEventBuffer.isBufferReady(buffer)) {
                const deviceRegistryEntry = this.getDeviceRegistryEntry(id);
                subscriber.next(transformMiFloraMeasurementsToDeviceMessage(peripheral, deviceRegistryEntry, buffer));
                this.sensorEventBuffer.clearBuffer(id);
            }

            subscriber.complete();
        });
    }
}
