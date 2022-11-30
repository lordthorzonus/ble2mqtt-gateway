import { Peripheral } from "@abandonware/noble";
import { DeviceRegistryEntry } from "../device-registry";
import { DeviceSensorMessage, MessageType, DeviceType } from "../../types";
import { v4 as uuid } from "uuid";
import { DateTime } from "luxon";
import { ReadyMiFloraSensorMeasurementBuffer } from "./miflora-event-buffer";

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
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
): DeviceSensorMessage => {
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
        type: MessageType.SensorData,
        payload: sensorData,
    };
};
