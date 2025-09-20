import { v4 as uuid } from "uuid";
import {
    parse,
    RuuviParsingError,
    RuuviTagEnvironmentalSensorData,
    RuuviTagAirQualitySensorData,
    RuuviTagSensorData,
} from "./ruuvitag-parser";
import {
    EnhancedRuuviTagSensorData,
    decorateRuuviTagSensorDataWithCalculatedValues,
    decorateRuuviTagAirQualitySensorDataWithCalculatedValues,
} from "./ruuvitag-sensor-data-decorator";
import { MessageType, DeviceType, RuuvitagSensorMessage } from "../../types";
import { DateTime } from "luxon";
import { DeviceRegistryEntry } from "../device-registry";
import { formatEnvironmentalSensorValues, formatAirQualitySensorValues } from "./ruuvitag-measurement-formatter";
import { Effect, Match, Option, pipe } from "effect";
import { PeripheralWithManufacturerData } from "./ruuvitag-gateway";

export interface RuuviTag {
    macAddress: string;
    id: string;
    rssi: number;
}
const processEnvironmentalData = (
    data: RuuviTagEnvironmentalSensorData,
    decimalPrecision: number
): EnhancedRuuviTagSensorData =>
    pipe(data, decorateRuuviTagSensorDataWithCalculatedValues, (decoratedValues) =>
        formatEnvironmentalSensorValues(decoratedValues, decimalPrecision)
    );

const processAirQualityData = (
    data: RuuviTagAirQualitySensorData,
    decimalPrecision: number
): EnhancedRuuviTagSensorData =>
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

const getSensorData = (
    data: Buffer,
    decimalPrecision: number
): Effect.Effect<EnhancedRuuviTagSensorData, RuuviParsingError> =>
    pipe(
        data,
        parse,
        Effect.map((ruuviTagData) => transformRuuviTagData(ruuviTagData, decimalPrecision))
    );

export const transformPeripheralAdvertisementToSensorDataDeviceMessage = (
    peripheral: PeripheralWithManufacturerData,
    deviceRegistryEntry: DeviceRegistryEntry
): Effect.Effect<Option.Option<RuuvitagSensorMessage>, RuuviParsingError> =>
    Effect.gen(function* () {
        const sensorData = yield* getSensorData(
            peripheral.advertisement.manufacturerData,
            deviceRegistryEntry.decimalPrecision
        );
        const macAddress = sensorData.macAddress ?? peripheral.address;

        return Option.some({
            id: uuid(),
            deviceType: DeviceType.Ruuvitag,
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
            payload: sensorData,
        });
    });
