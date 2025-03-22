import DataFormat3ParsingStrategy from "./parsing-strategies/data-format-3-parsing-strategy";
import DataFormat5ParsingStrategy from "./parsing-strategies/data-format-5-parsing-strategy";
import { ruuviTagManufacturerId, validateRuuviTag } from "./ruuvitag-validator";
import { Effect, Data } from "effect";
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

const DataFormatParsingStrategyMap = new Map<RuuvitagSensorProtocolDataFormat, RuuviTagParsingStrategy>([
    [RuuvitagSensorProtocolDataFormat.DataFormat3, DataFormat3ParsingStrategy],
    [RuuvitagSensorProtocolDataFormat.DataFormat5, DataFormat5ParsingStrategy],
]);

class NotValidRuuviManufacturerIdError extends Data.TaggedError("NotValidRuuviManufacturerIdError")<{
    manufacturerId: number;
}> {}

class UnsupportedDataFormatError extends Data.TaggedError("UnsupportedDataFormatError")<{
    dataFormat: number;
}> {}

export type RuuviParsingError = NotValidRuuviManufacturerIdError | UnsupportedDataFormatError;

const resolveParsingStrategy = (rawRuuviTagData: Buffer): Effect.Effect<RuuviTagParsingStrategy, RuuviParsingError> => {
    const dataFormat = rawRuuviTagData.readUInt8(RuuviTagDataOffsets.DataFormatOffset);
    const parsingStrategy = DataFormatParsingStrategyMap.get(dataFormat);

    if (!parsingStrategy) {
        return Effect.fail(new UnsupportedDataFormatError({ dataFormat }));
    }

    return Effect.succeed(parsingStrategy);
};

export const parse = (rawRuuviTagData: Buffer): Effect.Effect<RuuviTagSensorData, RuuviParsingError> => {
    const manufacturerId = rawRuuviTagData.readUInt16LE(RuuviTagDataOffsets.ManufacturedIdOffset);

    if (!validateRuuviTag(rawRuuviTagData)) {
        return Effect.fail(new NotValidRuuviManufacturerIdError({ manufacturerId }));
    }

    return Effect.gen(function* () {
        const parsingStrategy = yield* resolveParsingStrategy(rawRuuviTagData);
        return yield* Effect.succeed(parsingStrategy.parse(rawRuuviTagData));
    });
};
