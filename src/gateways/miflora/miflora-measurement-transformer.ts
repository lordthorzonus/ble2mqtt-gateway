import { Peripheral } from "@abandonware/noble";
import { DeviceRegistryEntry } from "../device-registry";
import { DeviceMessage, DeviceMessageType, DeviceType } from "../../types";
import { v4 as uuid } from "uuid";
import { DateTime } from "luxon";
import { ReadyMiFloraSensorMeasurementBuffer } from "./miflora-event-buffer";

export type MiFloraSensorData = {
    temperature: number;
    moisture: number;
    illuminance: number;
    soilConductivity: number;
};

export const transformMiFloraMeasurementsToDeviceMessage = (
    peripheral: Peripheral,
    deviceRegistryEntry: DeviceRegistryEntry,
    miFloraSensorMeasurementBuffer: ReadyMiFloraSensorMeasurementBuffer
): DeviceMessage => {
    const sensorData: MiFloraSensorData = {
        temperature: miFloraSensorMeasurementBuffer.temperatureEvent.data,
        moisture: miFloraSensorMeasurementBuffer.moistureEvent.data,
        illuminance: miFloraSensorMeasurementBuffer.illuminanceEvent.data,
        soilConductivity: miFloraSensorMeasurementBuffer.soilConductivityEvent.data,
    };

    return {
        id: uuid(),
        device: {
            macAddress: peripheral.address,
            rssi: peripheral.rssi,
            id: deviceRegistryEntry.device.id,
            type: DeviceType.MiFlora,
            friendlyName: deviceRegistryEntry.device.friendlyName,
            timeout: deviceRegistryEntry.timeout,
        },
        time: DateTime.now(),
        type: DeviceMessageType.SensorData,
        payload: sensorData,
    };
};
