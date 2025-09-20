import { v4 as uuid } from "uuid";
import {
    parse,
    RuuviParsingError,
    RuuviTagEnvironmentalSensorData,
    RuuviTagAirQualitySensorData,
    RuuviTagSensorData,
    parseRuuviDeviceModel,
} from "./ruuvitag-parser";
import {
    EnhancedRuuviTagSensorData,
    decorateRuuviTagEnvironmentalSensorDataWithCalculatedValues,
    decorateRuuviTagAirQualitySensorDataWithCalculatedValues,
} from "./ruuvitag-sensor-data-decorator";
import { MessageType, DeviceType, RuuvitagSensorMessage, RuuviModel } from "../../types";
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
    pipe(data, decorateRuuviTagEnvironmentalSensorDataWithCalculatedValues, (decoratedValues) =>
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

const parseSensorData = (
    data: Buffer,
    decimalPrecision: number
): Effect.Effect<EnhancedRuuviTagSensorData, RuuviParsingError> =>
    pipe(
        data,
        parse,
        Effect.map((ruuviTagData) => transformRuuviTagData(ruuviTagData, decimalPrecision))
    );

export const resolveDeviceModel = (
    peripheral: PeripheralWithManufacturerData
): Effect.Effect<RuuviModel, RuuviParsingError> => parseRuuviDeviceModel(peripheral.advertisement.manufacturerData);

export const transformPeripheralAdvertisementToSensorDataDeviceMessage = (
    peripheral: PeripheralWithManufacturerData,
    deviceRegistryEntry: DeviceRegistryEntry
): Effect.Effect<Option.Option<RuuvitagSensorMessage>, RuuviParsingError> =>
    Effect.gen(function* () {
        const sensorData = yield* parseSensorData(
            peripheral.advertisement.manufacturerData,
            deviceRegistryEntry.decimalPrecision
        );
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
    });
