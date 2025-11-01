import { Peripheral } from "../../infra/ble-scanner";
import { DeviceRegistryEntry } from "../device-registry";
import { MessageType, DeviceType, MifloraSensorMessage } from "../../types";
import { v4 as uuid } from "uuid";
import { DateTime } from "luxon";
import { MiFloraSensorMeasurementBuffer } from "./miflora-event-buffer";
import { formatNumericSensorValue } from "../numeric-sensor-value-formatter";
import { pipe } from "effect";
import {
    asCelsius,
    asLux,
    asSoilConductivity,
    asSoilMoisture,
    Celsius,
    Lux,
    SoilConductivity,
    SoilMoisture,
} from "../units";

export interface MiFloraSensorData {
    temperature: Celsius | null;
    moisture: SoilMoisture | null;
    illuminance: Lux | null;
    soilConductivity: SoilConductivity | null;
    lowBatteryWarning: boolean;
}

const getSensorData = (buffer: MiFloraSensorMeasurementBuffer, decimalPrecision: number) =>
    pipe(
        buffer,
        (buffer: MiFloraSensorMeasurementBuffer) => ({
            temperature: buffer.temperatureEvent?.data ? asCelsius(buffer.temperatureEvent.data) : null,
            moisture: buffer.moistureEvent?.data ? asSoilMoisture(buffer.moistureEvent.data) : null,
            illuminance: buffer.illuminanceEvent?.data ? asLux(buffer.illuminanceEvent.data) : null,
            soilConductivity: buffer.soilConductivityEvent?.data
                ? asSoilConductivity(buffer.soilConductivityEvent.data)
                : null,
            lowBatteryWarning: buffer.lowBatteryEvent?.data === 1,
        }),
        (sensorData: MiFloraSensorData): MiFloraSensorData => ({
            temperature: formatNumericSensorValue(sensorData.temperature, decimalPrecision),
            moisture: formatNumericSensorValue(sensorData.moisture, decimalPrecision),
            illuminance: formatNumericSensorValue(sensorData.illuminance, decimalPrecision),
            soilConductivity: formatNumericSensorValue(sensorData.soilConductivity, decimalPrecision),
            lowBatteryWarning: sensorData.lowBatteryWarning,
        })
    );

export const transformMiFloraMeasurementsToDeviceMessage = (
    peripheral: Peripheral,
    deviceRegistryEntry: DeviceRegistryEntry,
    miFloraSensorMeasurementBuffer: MiFloraSensorMeasurementBuffer
): MifloraSensorMessage => {
    const sensorData = getSensorData(miFloraSensorMeasurementBuffer, deviceRegistryEntry.decimalPrecision);

    return {
        id: uuid(),
        device: {
            macAddress: peripheral.address,
            rssi: peripheral.rssi,
            id: deviceRegistryEntry.device.id,
            type: DeviceType.MiFlora,
            friendlyName: deviceRegistryEntry.device.friendlyName,
            timeout: deviceRegistryEntry.timeout,
            model: "miflora",
        },
        time: DateTime.now(),
        type: MessageType.SensorData,
        payload: sensorData,
    };
};
