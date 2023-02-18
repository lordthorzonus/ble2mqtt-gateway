import { Peripheral } from "@abandonware/noble";
import { DeviceRegistryEntry } from "../device-registry";
import { DeviceSensorMessage, MessageType, DeviceType } from "../../types";
import { v4 as uuid } from "uuid";
import { DateTime } from "luxon";
import { MiFloraSensorMeasurementBuffer } from "./miflora-event-buffer";

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type MiFloraSensorData = {
    temperature: number | null;
    moisture: number | null;
    illuminance: number | null;
    soilConductivity: number | null;
};

export const transformMiFloraMeasurementsToDeviceMessage = (
    peripheral: Peripheral,
    deviceRegistryEntry: DeviceRegistryEntry,
    miFloraSensorMeasurementBuffer: MiFloraSensorMeasurementBuffer
): DeviceSensorMessage => {
    const sensorData: MiFloraSensorData = {
        temperature: miFloraSensorMeasurementBuffer.temperatureEvent?.data ?? null,
        moisture: miFloraSensorMeasurementBuffer.moistureEvent?.data ?? null,
        illuminance: miFloraSensorMeasurementBuffer.illuminanceEvent?.data ?? null,
        soilConductivity: miFloraSensorMeasurementBuffer.soilConductivityEvent?.data ?? null,
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
