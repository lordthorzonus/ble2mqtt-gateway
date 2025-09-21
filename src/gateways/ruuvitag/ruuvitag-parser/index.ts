import { RuuviModel } from "../../../types";
import { Celsius, CO2Ppm, Lux, NOXIndex, Pascal, PM1, PM10, PM2_5, PM4, RelativeHumidity, VOCIndex } from "../../units";
import { DataFormat3ParsingStrategy } from "./parsing-strategies/data-format-3-parsing-strategy";
import { DataFormat5ParsingStrategy } from "./parsing-strategies/data-format-5-parsing-strategy";
import { DataFormat6ParsingStrategy } from "./parsing-strategies/data-format-6-parsing-strategy";
import { DataFormatE1ParsingStrategy } from "./parsing-strategies/data-format-e1-parsing-strategy";
import { Data, Effect, Match } from "effect";

type Nullable<T> = T | null;

export interface RuuviTagEnvironmentalSensorData {
    type: "environmental";
    relativeHumidityPercentage: Nullable<RelativeHumidity>;
    temperature: Nullable<Celsius>;
    pressure: Nullable<Pascal>;
    accelerationX: Nullable<number>;
    accelerationY: Nullable<number>;
    accelerationZ: Nullable<number>;
    batteryVoltage: Nullable<number>;
    txPower: Nullable<number>;
    movementCounter: Nullable<number>;
    measurementSequence: Nullable<number>;
    macAddress: Nullable<string>;
}

export interface RuuviTagAirQualitySensorData {
    type: "air-quality";
    temperature: Nullable<Celsius>;
    relativeHumidityPercentage: Nullable<RelativeHumidity>;
    pressure: Nullable<Pascal>;
    pm1: Nullable<PM1>;
    pm2_5: Nullable<PM2_5>;
    pm4: Nullable<PM4>;
    pm10: Nullable<PM10>;
    co2: Nullable<CO2Ppm>;
    voc: Nullable<VOCIndex>;
    nox: Nullable<NOXIndex>;
    luminosity: Nullable<Lux>;
    measurementSequence: Nullable<number>;
    macAddress: Nullable<string>;
    calibrationInProgress: Nullable<boolean>;
}

export type RuuviTagSensorData = RuuviTagEnvironmentalSensorData | RuuviTagAirQualitySensorData;

export type RuuviTagParsingStrategy = (rawRuuviTagData: Buffer) => RuuviTagEnvironmentalSensorData;
export type RuuviTagAirQualityParsingStrategy = (rawRuuviTagData: Buffer) => RuuviTagAirQualitySensorData;

export enum RuuvitagSensorProtocolDataFormat {
    DataFormat3 = 0x03,
    DataFormat2And4 = 0x04,
    DataFormat5 = 0x05,
    DataFormat6 = 0x06,
    DataFormatE1 = 0xe1,
}

enum RuuviTagDataOffsets {
    ManufacturedIdOffset = 0,
    DataFormatOffset = 2,
}

export const ruuviTagManufacturerId = 0x0499;

/**
 * Checks if the given manufacturerData contains the correct manufacturerId 0x0499 The least significant byte first.
 */
const validateRuuviTag = (manufacturerData?: Buffer): boolean => {
    if (!manufacturerData) {
        return false;
    }

    const manufacturerId = manufacturerData.readUInt16LE(0);

    return manufacturerId === ruuviTagManufacturerId;
};

export class NotValidRuuviManufacturerIdError extends Data.TaggedError("NotValidRuuviManufacturerIdError")<{
    manufacturerId: number;
}> {}

export class UnsupportedDataFormatError extends Data.TaggedError("UnsupportedDataFormatError")<{
    dataFormat: number;
}> {}

export type RuuviParsingError = NotValidRuuviManufacturerIdError | UnsupportedDataFormatError;

const resolveParsingStrategy = Match.type<number>().pipe(
    Match.when(RuuvitagSensorProtocolDataFormat.DataFormat3, () => Effect.succeed(DataFormat3ParsingStrategy)),
    Match.when(RuuvitagSensorProtocolDataFormat.DataFormat5, () => Effect.succeed(DataFormat5ParsingStrategy)),
    Match.when(RuuvitagSensorProtocolDataFormat.DataFormat6, () => Effect.succeed(DataFormat6ParsingStrategy)),
    Match.when(RuuvitagSensorProtocolDataFormat.DataFormatE1, () => Effect.succeed(DataFormatE1ParsingStrategy)),
    Match.orElse((dataFormat) => new UnsupportedDataFormatError({ dataFormat }))
);

const resolveDeviceModel = Match.type<number>().pipe(
    Match.withReturnType<Effect.Effect<RuuviModel, UnsupportedDataFormatError>>(),
    Match.when(RuuvitagSensorProtocolDataFormat.DataFormat3, () => Effect.succeed("environmental" as const)),
    Match.when(RuuvitagSensorProtocolDataFormat.DataFormat5, () => Effect.succeed("environmental" as const)),
    Match.when(RuuvitagSensorProtocolDataFormat.DataFormat6, () => Effect.succeed("air-quality" as const)),
    Match.when(RuuvitagSensorProtocolDataFormat.DataFormatE1, () => Effect.succeed("air-quality" as const)),
    Match.orElse((dataFormat) => new UnsupportedDataFormatError({ dataFormat }))
);

const assertValidDataFormat = (dataFormat: number): dataFormat is RuuvitagSensorProtocolDataFormat =>
    Object.values(RuuvitagSensorProtocolDataFormat).includes(dataFormat);

export const parse = (rawRuuviTagData: Buffer): Effect.Effect<RuuviTagSensorData, RuuviParsingError> =>
    Effect.gen(function* () {
        const manufacturerId = rawRuuviTagData.readUInt16LE(RuuviTagDataOffsets.ManufacturedIdOffset);

        if (!validateRuuviTag(rawRuuviTagData)) {
            return yield* new NotValidRuuviManufacturerIdError({ manufacturerId });
        }

        const dataFormat = rawRuuviTagData.readUInt8(RuuviTagDataOffsets.DataFormatOffset);
        const parsingStrategy = yield* resolveParsingStrategy(dataFormat);

        return parsingStrategy(rawRuuviTagData);
    });

export const parseRuuviDeviceModel = (rawRuuviTagData: Buffer): Effect.Effect<RuuviModel, RuuviParsingError> =>
    Effect.gen(function* () {
        const manufacturerId = rawRuuviTagData.readUInt16LE(RuuviTagDataOffsets.ManufacturedIdOffset);

        if (!validateRuuviTag(rawRuuviTagData)) {
            return yield* new NotValidRuuviManufacturerIdError({ manufacturerId });
        }

        const dataFormat = rawRuuviTagData.readUInt8(RuuviTagDataOffsets.DataFormatOffset);
        return yield* resolveDeviceModel(dataFormat);
    });

export const parseRuuviDataFormat = (
    rawRuuviTagData: Buffer
): Effect.Effect<RuuvitagSensorProtocolDataFormat, NotValidRuuviManufacturerIdError | UnsupportedDataFormatError> => {
    const manufacturerId = rawRuuviTagData.readUInt16LE(RuuviTagDataOffsets.ManufacturedIdOffset);

    if (!validateRuuviTag(rawRuuviTagData)) {
        return new NotValidRuuviManufacturerIdError({ manufacturerId });
    }
    const dataFormat = rawRuuviTagData.readUInt8(RuuviTagDataOffsets.DataFormatOffset);
    if (!assertValidDataFormat(dataFormat)) {
        return new UnsupportedDataFormatError({ dataFormat });
    }

    return Effect.succeed(dataFormat);
};
