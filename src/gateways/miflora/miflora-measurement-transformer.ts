import { Peripheral } from "@abandonware/noble";
import { DeviceRegistryEntry } from "../device-registry";
import { MessageType, DeviceType, MifloraSensorMessage } from "../../types";
import { v4 as uuid } from "uuid";
import { DateTime } from "luxon";
import { MiFloraSensorMeasurementBuffer } from "./miflora-event-buffer";
import { flow } from "lodash";
import { formatNumericSensorValue } from "../numeric-sensor-value-formatter";

export type MiFloraSensorData = {
    temperature: number | null;
    moisture: number | null;
    illuminance: number | null;
    soilConductivity: number | null;
    lowBatteryWarning: boolean;
};

const getSensorData = flow(
    (buffer: MiFloraSensorMeasurementBuffer) => ({
        temperature: buffer.temperatureEvent?.data ?? null,
        moisture: buffer.moistureEvent?.data ?? null,
        illuminance: buffer.illuminanceEvent?.data ?? null,
        soilConductivity: buffer.soilConductivityEvent?.data ?? null,
        lowBatteryWarning: buffer.lowBatteryEvent?.data === 1,
    }),
    (sensorData: MiFloraSensorData): MiFloraSensorData => ({
        temperature: formatNumericSensorValue(sensorData.temperature),
        moisture: formatNumericSensorValue(sensorData.moisture),
        illuminance: formatNumericSensorValue(sensorData.illuminance),
        soilConductivity: formatNumericSensorValue(sensorData.soilConductivity),
        lowBatteryWarning: sensorData.lowBatteryWarning,
    })
);

export const transformMiFloraMeasurementsToDeviceMessage = (
    peripheral: Peripheral,
    deviceRegistryEntry: DeviceRegistryEntry,
    miFloraSensorMeasurementBuffer: MiFloraSensorMeasurementBuffer
): MifloraSensorMessage => {
    const sensorData = getSensorData(miFloraSensorMeasurementBuffer);

    return {
        id: uuid(),
        deviceType: DeviceType.MiFlora,
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
