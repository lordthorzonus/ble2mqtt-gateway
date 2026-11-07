import { Celsius, CO2Ppm, Lux, NOxIndex, Pascal, PM1, PM10, PM2_5, PM4, RelativeHumidity, VOCIndex } from "../../units";
import { DataFormat3ParsingStrategy } from "./parsing-strategies/data-format-3-parsing-strategy";
import { DataFormat5ParsingStrategy } from "./parsing-strategies/data-format-5-parsing-strategy";
import { DataFormat6ParsingStrategy } from "./parsing-strategies/data-format-6-parsing-strategy";
import { DataFormatE1ParsingStrategy } from "./parsing-strategies/data-format-e1-parsing-strategy";
import { Data, Effect, Match } from "effect";
import { RuuvitagSensorProtocolDataFormat } from "./data-format";

export { RuuvitagSensorProtocolDataFormat };
import { InvalidRuuviDataLengthError } from "./parsing-strategies/common-parsing-strategy-utils";

export { InvalidRuuviDataLengthError };

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

export interface RuuviAirSensorData {
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
    nox: Nullable<NOxIndex>;
    luminosity: Nullable<Lux>;
    measurementSequence: Nullable<number>;
    macAddress: Nullable<string>;
    calibrationInProgress: Nullable<boolean>;
}

export type RuuviTagSensorData = RuuviTagEnvironmentalSensorData | RuuviAirSensorData;

export type RuuviTagParsingStrategy = (
    rawRuuviTagData: Buffer
) => Effect.Effect<RuuviTagEnvironmentalSensorData, InvalidRuuviDataLengthError>;
export type RuuviAirParsingStrategy = (
    rawRuuviTagData: Buffer
) => Effect.Effect<RuuviAirSensorData, InvalidRuuviDataLengthError>;

enum RuuviTagDataOffsets {
    ManufacturedIdOffset = 0,
    DataFormatOffset = 2,
}

const HEADER_LENGTH = RuuviTagDataOffsets.DataFormatOffset + 1;

export const ruuviTagManufacturerId = 0x0499;

export class NotValidRuuviManufacturerIdError extends Data.TaggedError("NotValidRuuviManufacturerIdError")<{
    manufacturerId: number;
}> {}

export class UnsupportedDataFormatError extends Data.TaggedError("UnsupportedDataFormatError")<{
    dataFormat: number;
}> {}

export type RuuviParsingError =
    NotValidRuuviManufacturerIdError | UnsupportedDataFormatError | InvalidRuuviDataLengthError;

const resolveParsingStrategy = Match.type<number>().pipe(
    Match.when(RuuvitagSensorProtocolDataFormat.DataFormat3, () => Effect.succeed(DataFormat3ParsingStrategy)),
    Match.when(RuuvitagSensorProtocolDataFormat.DataFormat5, () => Effect.succeed(DataFormat5ParsingStrategy)),
    Match.when(RuuvitagSensorProtocolDataFormat.DataFormat6, () => Effect.succeed(DataFormat6ParsingStrategy)),
    Match.when(RuuvitagSensorProtocolDataFormat.DataFormatE1, () => Effect.succeed(DataFormatE1ParsingStrategy)),
    Match.orElse((dataFormat) => new UnsupportedDataFormatError({ dataFormat }))
);

const assertValidDataFormat = (dataFormat: number): dataFormat is RuuvitagSensorProtocolDataFormat =>
    Object.values<number | string>(RuuvitagSensorProtocolDataFormat).includes(dataFormat);

/**
 * Validates the manufacturer id and returns the raw data format byte.
 */
const parseHeader = (
    rawRuuviTagData: Buffer
): Effect.Effect<number, NotValidRuuviManufacturerIdError | InvalidRuuviDataLengthError> => {
    if (rawRuuviTagData.length < HEADER_LENGTH) {
        return new InvalidRuuviDataLengthError({
            dataFormat: null,
            length: rawRuuviTagData.length,
            minimumLength: HEADER_LENGTH,
        });
    }

    const manufacturerId = rawRuuviTagData.readUInt16LE(RuuviTagDataOffsets.ManufacturedIdOffset);

    if (manufacturerId !== ruuviTagManufacturerId) {
        return new NotValidRuuviManufacturerIdError({ manufacturerId });
    }

    return Effect.succeed(rawRuuviTagData.readUInt8(RuuviTagDataOffsets.DataFormatOffset));
};

export const parse = (rawRuuviTagData: Buffer): Effect.Effect<RuuviTagSensorData, RuuviParsingError> =>
    Effect.gen(function* () {
        const dataFormat = yield* parseHeader(rawRuuviTagData);
        const parsingStrategy = yield* resolveParsingStrategy(dataFormat);

        return yield* parsingStrategy(rawRuuviTagData);
    });

export const parseRuuviDataFormat = (
    rawRuuviTagData: Buffer
): Effect.Effect<RuuvitagSensorProtocolDataFormat, RuuviParsingError> =>
    Effect.flatMap(parseHeader(rawRuuviTagData), (dataFormat) =>
        assertValidDataFormat(dataFormat) ? Effect.succeed(dataFormat) : new UnsupportedDataFormatError({ dataFormat })
    );
