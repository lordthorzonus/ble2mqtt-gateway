import { RuuviTagParsingStrategy } from "../index";
import {
    parseTemperature,
    parseRelativeHumidity,
    parsePressure,
    parseMacAddress48Bit,
    isInvalidMeasurementForSigned16BitInteger,
    isInvalidMeasurementForUnsigned16BitInteger,
} from "./common-parsing-strategy-utils";

enum DataFormatV5Offset {
    Temperature = 3,
    Humidity = 5,
    Pressure = 7,
    AccelerationX = 9,
    AccelerationY = 11,
    AccelerationZ = 13,
    PowerInfo = 15,
    MovementCounter = 17,
    MeasurementSequence = 18,
    MacAddress = 20,
}

/**
 * Parses the acceleration data from the advertisement.
 * Values are 16 bit signed integers. All channels are identical.
 *
 * @param rawData - The raw buffer data
 * @param offset - Byte offset to read from
 * @returns Values in G.
 */
const parseAcceleration = (rawData: Buffer, offset: number): number | null => {
    const acceleration = rawData.readInt16BE(offset);

    if (isInvalidMeasurementForSigned16BitInteger(acceleration)) {
        return null;
    }

    return acceleration / 1000;
};

/**
 * Parses the battery voltage from the advertisement.
 *
 * Power info (11+5bit unsigned), first 11 bits is the battery voltage above 1.6V, in Volts (1.6V to 3.646V range).
 *
 * @param rawData - The raw buffer data
 * @param offset - Byte offset to read from
 * @returns The value in Volts (V).
 */
const parseBatteryVoltage = (rawData: Buffer, offset: number): number | null => {
    const powerInfo = rawData.readUInt16BE(offset);
    const minimumVoltage = 1600;
    const max11BitUnsignedInteger = 2047;

    const voltage = powerInfo >>> 5;

    if (voltage === max11BitUnsignedInteger) {
        return null;
    }

    return (voltage + minimumVoltage) / 1000;
};

/**
 * Parses the tx power from the advertisement.
 * Power info (11+5bit unsigned), last 5 bits unsigned are the TX power above -40dBm,
 * in 2dBm steps. (-40dBm to +20dBm range)
 *
 * @param rawData - The raw buffer data
 * @param offset - Byte offset to read from
 * @returns The value in dBm.
 */
const parseTxPower = (rawData: Buffer, offset: number): number | null => {
    const powerInfo = rawData.readUInt16BE(offset);
    const max5BitUnsignedInteger = 31;
    const dBmIncrement = 2;
    const minimumDBm = -40;

    const txPower = powerInfo & 0b11111;

    if (txPower === max5BitUnsignedInteger) {
        return null;
    }

    return txPower * dBmIncrement + minimumDBm;
};

/**
 * Parses the movement counter (8 bit unsigned) from the advertisement data.
 * Movement counter is one-byte counter which gets triggered when LIS2DH12 gives "activity interrupt".
 * Sensitivity depends on the firmware, by default the sensitivity is a movement over 64 mG.
 *
 * @param rawData - The raw buffer data
 * @param offset - Byte offset to read from
 * @returns Movement counter as number
 */
const parseMovementCounter = (rawData: Buffer, offset: number): number | null => {
    const movementCounter = rawData.readUInt8(offset);
    const max8BitValue = 255;

    if (movementCounter === max8BitValue) {
        return null;
    }

    return movementCounter;
};

/**
 * Parses the measurement sequence from the advertisement.
 * Measurement sequence number gets incremented by one for every measurement.
 * It can be used to gauge signal quality and packet loss as well as to deduplicated data entries.
 *
 * @param rawData - The raw buffer data
 * @param offset - Byte offset to read from
 * @returns The measurement sequence as number.
 */
const parseMeasurementSequence = (rawData: Buffer, offset: number): number | null => {
    const measurementSequence = rawData.readUInt16BE(offset);

    if (isInvalidMeasurementForUnsigned16BitInteger(measurementSequence)) {
        return null;
    }

    return measurementSequence;
};

/**
 * Parses the raw manufacturer specific data field according to the Data Format 5 Specification (RAWv2)
 * @see https://github.com/ruuvi/ruuvi-sensor-protocols/blob/master/dataformat_05.md
 */
export const DataFormat5ParsingStrategy: RuuviTagParsingStrategy = (rawRuuviTagData) => {
    return {
        type: "environmental",
        temperature: parseTemperature(rawRuuviTagData, DataFormatV5Offset.Temperature),
        relativeHumidityPercentage: parseRelativeHumidity(rawRuuviTagData, DataFormatV5Offset.Humidity),
        pressure: parsePressure(rawRuuviTagData, DataFormatV5Offset.Pressure),
        accelerationX: parseAcceleration(rawRuuviTagData, DataFormatV5Offset.AccelerationX),
        accelerationY: parseAcceleration(rawRuuviTagData, DataFormatV5Offset.AccelerationY),
        accelerationZ: parseAcceleration(rawRuuviTagData, DataFormatV5Offset.AccelerationZ),
        batteryVoltage: parseBatteryVoltage(rawRuuviTagData, DataFormatV5Offset.PowerInfo),
        txPower: parseTxPower(rawRuuviTagData, DataFormatV5Offset.PowerInfo),
        movementCounter: parseMovementCounter(rawRuuviTagData, DataFormatV5Offset.MovementCounter),
        measurementSequence: parseMeasurementSequence(rawRuuviTagData, DataFormatV5Offset.MeasurementSequence),
        macAddress: parseMacAddress48Bit(rawRuuviTagData, DataFormatV5Offset.MacAddress),
    };
};
