import DataFormat3ParsingStrategy from "./parsing-strategies/data-format-3-parsing-strategy";
import DataFormat5ParsingStrategy from "./parsing-strategies/data-format-5-parsing-strategy";
import { ruuviTagManufacturerId, validateRuuviTag } from "./ruuvitag-validator";

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

const throwNotValidManufacturerIdError = (manufacturerId: number) => {
    throw Error(
        `Not a valid RuuviTag payload. Got manufacturerId: 0x${manufacturerId
            .toString(16)
            .padStart(4, "0")}, expected: 0x${ruuviTagManufacturerId.toString(16).padStart(4, "0")}`
    );
};

const validate = (rawRuuviTagData: Buffer) => {
    const manufacturerId = rawRuuviTagData.readUInt16LE(RuuviTagDataOffsets.ManufacturedIdOffset);

    if (!validateRuuviTag(rawRuuviTagData)) {
        throwNotValidManufacturerIdError(manufacturerId);
    }
};

const resolveParsingStrategy = (rawRuuviTagData: Buffer): RuuviTagParsingStrategy => {
    const dataFormat = rawRuuviTagData.readUInt8(RuuviTagDataOffsets.DataFormatOffset);
    const parsingStrategy = DataFormatParsingStrategyMap.get(dataFormat);

    if (!parsingStrategy) {
        throw Error(`Unsupported data format, got a payload containing data format: ${dataFormat}`);
    }

    return parsingStrategy;
};

const parse = (rawRuuviTagData: Buffer): RuuviTagSensorData => {
    validate(rawRuuviTagData);
    return resolveParsingStrategy(rawRuuviTagData).parse(rawRuuviTagData);
};

export default parse;
