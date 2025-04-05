import DataFormat3ParsingStrategy from "./parsing-strategies/data-format-3-parsing-strategy";
import DataFormat5ParsingStrategy from "./parsing-strategies/data-format-5-parsing-strategy";
import { Data, Effect, Match } from "effect";

type Nullable<T> = T | null;

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type RuuviTagSensorData = {
    relativeHumidityPercentage: Nullable<number>;
    temperature: Nullable<number>;
    pressure: Nullable<number>;
    accelerationX: Nullable<number>;
    accelerationY: Nullable<number>;
    accelerationZ: Nullable<number>;
    batteryVoltage: Nullable<number>;
    txPower: Nullable<number>;
    movementCounter: Nullable<number>;
    measurementSequence: Nullable<number>;
    macAddress: Nullable<string>;
};

export interface RuuviTagParsingStrategy {
    parse: (rawRuuviTagData: Buffer) => RuuviTagSensorData;
}

enum RuuvitagSensorProtocolDataFormat {
    DataFormat3 = 0x03,
    DataFormat2And4 = 0x04,
    DataFormat5 = 0x05,
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
    Match.orElse((dataFormat) => new UnsupportedDataFormatError({ dataFormat }))
);

export const parse = (rawRuuviTagData: Buffer): Effect.Effect<RuuviTagSensorData, RuuviParsingError> =>
    Effect.gen(function* () {
        const manufacturerId = rawRuuviTagData.readUInt16LE(RuuviTagDataOffsets.ManufacturedIdOffset);

        if (!validateRuuviTag(rawRuuviTagData)) {
            return yield* new NotValidRuuviManufacturerIdError({ manufacturerId });
        }

        const dataFormat = rawRuuviTagData.readUInt8(RuuviTagDataOffsets.DataFormatOffset);
        const parsingStrategy = yield* resolveParsingStrategy(dataFormat);

        return parsingStrategy.parse(rawRuuviTagData);
    });
