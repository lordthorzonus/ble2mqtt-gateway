import { v4 as uuid } from "uuid";
import { RuuviTagEnvironmentalSensorData, RuuviAirSensorData, RuuviTagSensorData } from "./ruuvitag-parser/index.js";
import {
    EnhancedRuuviTagSensorData,
    decorateRuuviTagEnvironmentalSensorDataWithCalculatedValues,
    decorateRuuviTagAirQualitySensorDataWithCalculatedValues,
} from "./ruuvitag-sensor-data-decorator/index.js";
import { MessageType, DeviceType, RuuvitagSensorMessage } from "../../types.js";
import { DateTime } from "luxon";
import { DeviceRegistryEntry } from "../device-registry.js";
import { formatEnvironmentalSensorValues, formatAirQualitySensorValues } from "./ruuvitag-measurement-formatter.js";
import { Match, Option, pipe } from "effect";
import { PeripheralWithManufacturerData } from "../gateway-helpers.js";

export interface RuuviTag {
    macAddress: string;
    id: string;
    rssi: number;
}

const processEnvironmentalData = (
    data: RuuviTagEnvironmentalSensorData,
    decimalPrecision: number
): EnhancedRuuviTagSensorData =>
    pipe(data, decorateRuuviTagEnvironmentalSensorDataWithCalculatedValues, (decoratedValues) =>
        formatEnvironmentalSensorValues(decoratedValues, decimalPrecision)
    );

const processAirQualityData = (data: RuuviAirSensorData, decimalPrecision: number): EnhancedRuuviTagSensorData =>
    pipe(data, decorateRuuviTagAirQualitySensorDataWithCalculatedValues, (decoratedValues) =>
        formatAirQualitySensorValues(decoratedValues, decimalPrecision)
    );

const transformRuuviTagData = (
    ruuviTagData: RuuviTagSensorData,
    decimalPrecision: number
): EnhancedRuuviTagSensorData =>
    Match.value(ruuviTagData).pipe(
        Match.withReturnType<EnhancedRuuviTagSensorData>(),
        Match.when({ type: "environmental" }, (data) => processEnvironmentalData(data, decimalPrecision)),
        Match.when({ type: "air-quality" }, (data) => processAirQualityData(data, decimalPrecision)),
        Match.exhaustive
    );

/**
 * Decorates and formats parsed RuuviTag sensor data with the device's decimal precision.
 */
export const transformRuuviTagSensorDataToDeviceMessage = (
    peripheral: PeripheralWithManufacturerData,
    deviceRegistryEntry: DeviceRegistryEntry,
    ruuviTagSensorData: RuuviTagSensorData
): Option.Option<RuuvitagSensorMessage> => {
    const sensorData = transformRuuviTagData(ruuviTagSensorData, deviceRegistryEntry.decimalPrecision);
    const macAddress = sensorData.macAddress ?? peripheral.address;

    const commonMessage = {
        id: uuid(),
        device: {
            macAddress,
            rssi: peripheral.rssi,
            id: deviceRegistryEntry.device.id,
            type: DeviceType.Ruuvitag,
            friendlyName: deviceRegistryEntry.device.friendlyName,
            timeout: deviceRegistryEntry.timeout,
        },
        time: DateTime.now(),
        type: MessageType.SensorData,
    } as const;

    return Match.value(sensorData).pipe(
        Match.when({ type: "environmental" }, (data) =>
            Option.some({
                ...commonMessage,
                device: {
                    ...commonMessage.device,
                    model: data.type,
                },
                payload: data,
            } as const)
        ),
        Match.when({ type: "air-quality" }, (data) =>
            Option.some({
                ...commonMessage,
                device: {
                    ...commonMessage.device,
                    model: data.type,
                },
                payload: data,
            } as const)
        ),
        Match.exhaustive
    );
};
