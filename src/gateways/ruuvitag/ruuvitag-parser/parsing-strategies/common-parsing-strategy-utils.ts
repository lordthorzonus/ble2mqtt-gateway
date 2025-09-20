import {
    asCelsius,
    asCO2Ppm,
    asNOXIndex,
    asPascal,
    asRelativeHumidity,
    asVOCIndex,
    Celsius,
    CO2Ppm,
    NOXIndex,
    Pascal,
    RelativeHumidity,
    VOCIndex,
} from "../../../units";

export const isInvalidMeasurementForSigned16BitInteger = (value: number): boolean => {
    return value === 0x8000 || value === -0x8000;
};

export const isInvalidMeasurementForUnsigned16BitInteger = (value: number): boolean => {
    return value === 0xffff;
};

export const isInvalidMeasurementForUnsigned24BitInteger = (value: number): boolean => {
    return value === 0xffffff;
};

/**
 * Parses the temperature from the advertisement.
 * Values supported: -163.835 °C to +163.835 °C in 0.005 °C increments.
 *
 * @param rawData - The raw buffer data
 * @param offset - Byte offset to read from
 * @returns The value in Celsius (°C).
 */
export const parseTemperature = (rawData: Buffer, offset: number): Celsius | null => {
    const temperature = rawData.readInt16BE(offset);
    const degreeIncrements = 0.005;

    if (isInvalidMeasurementForSigned16BitInteger(temperature)) {
        return null;
    }

    return asCelsius(temperature * degreeIncrements);
};

/**
 * Parses the humidity from the advertisement.
 * Values supported: 0.0 % to 100 % in 0.0025 % increments.
 * Higher values than 100 % are possible, but they generally indicate a faulty or miscalibrated sensor.
 *
 * @param rawData - The raw buffer data
 * @param offset - Byte offset to read from
 * @returns The value in percents (%).
 */
export const parseRelativeHumidity = (rawData: Buffer, offset: number): RelativeHumidity | null => {
    const humidity = rawData.readUInt16BE(offset);
    const percentageIncrements = 0.0025;

    if (isInvalidMeasurementForUnsigned16BitInteger(humidity)) {
        return null;
    }

    return asRelativeHumidity(humidity * percentageIncrements);
};

/**
 * Parses the atmospheric pressure from the advertisement.
 * Values supported by the RuuviTag are 50000 Pa to 115536 Pa in 1 Pa increments.
 *
 * @param rawData - The raw buffer data
 * @param offset - Byte offset to read from
 * @returns The pressure in Pascals (Pa).
 */
export const parsePressure = (rawData: Buffer, offset: number): Pascal | null => {
    const pressure = rawData.readUInt16BE(offset);
    const minimumSupportedPascalMeasurement = 50000;

    if (isInvalidMeasurementForUnsigned16BitInteger(pressure)) {
        return null;
    }

    return asPascal(pressure + minimumSupportedPascalMeasurement);
};

/**
 * Parses particulate matter (PM) concentration from raw data.
 * Values supported: 0 to 1000.0 (μg/m³) with 0.1 μg/m³ resolution.
 *
 * @param rawData - The raw buffer data
 * @param offset - Byte offset to read from
 * @returns PM concentration in μg/m³ or null if invalid
 */
export const parseParticulateMatter = (rawData: Buffer, offset: number): number | null => {
    const pm = rawData.readUInt16BE(offset);
    const resolution = 0.1;

    if (isInvalidMeasurementForUnsigned16BitInteger(pm)) {
        return null;
    }

    return pm * resolution;
};

/**
 * Parses the CO2 concentration from the advertisement.
 * Values supported: 0 to 65534 (ppm), however the sensor on Ruuvi supports only 40000 ppm.
 * In natural environment CO2 is always at least around 400 ppm. Resolution is 1 per bit.
 *
 * @param rawData - The raw buffer data
 * @param offset - Byte offset to read from
 * @returns The value in parts per million (ppm).
 */
export const parseCO2 = (rawData: Buffer, offset: number): CO2Ppm | null => {
    const co2 = rawData.readUInt16BE(offset);

    if (isInvalidMeasurementForUnsigned16BitInteger(co2)) {
        return null;
    }

    return asCO2Ppm(co2);
};

/**
 * Parses the VOC (Volatile Organic Compounds) index from the advertisement.
 * VOC is a unitless index which learns the installation environment and tracks changes over time.
 * The index average is 100, i.e. values under 100 mean the air quality is improving and
 * values over 100 mean the air quality is getting worse.
 * Uses 9 bits, with the least significant bit stored in the Flags byte (bit 6).
 *
 * @param rawData - The raw buffer data
 * @param vocOffset - Byte offset for the lower 8 bits
 * @param flagsOffset - Byte offset for the flags containing the upper bit
 * @returns The VOC index (unitless).
 */
export const parseVOC = (rawData: Buffer, vocOffset: number, flagsOffset: number): VOCIndex | null => {
    const vocLower8Bits = rawData.readUInt8(vocOffset);
    const flags = rawData.readUInt8(flagsOffset);
    const vocUpperBit = (flags & 0b01000000) >> 6;
    const voc = (vocUpperBit << 8) | vocLower8Bits;
    const max9BitValue = 0x1ff;

    if (voc === max9BitValue) {
        return null;
    }

    return asVOCIndex(voc);
};

/**
 * Parses the NOX (Nitrogen Oxides) index from the advertisement.
 * NOX is a unitless index which learns the installation environment and tracks changes over time.
 * The index has a base value of 1, values higher than 1 meaning there's more nitrogen oxides
 * in the air than usual.
 * Uses 9 bits, with the least significant bit stored in the Flags byte (bit 7).
 *
 * @param rawData - The raw buffer data
 * @param noxOffset - Byte offset for the lower 8 bits
 * @param flagsOffset - Byte offset for the flags containing the upper bit
 * @returns The NOX index (unitless).
 */
export const parseNOX = (rawData: Buffer, noxOffset: number, flagsOffset: number): NOXIndex | null => {
    const noxLower8Bits = rawData.readUInt8(noxOffset);
    const flags = rawData.readUInt8(flagsOffset);
    const noxUpperBit = (flags & 0b10000000) >> 7;
    const nox = (noxUpperBit << 8) | noxLower8Bits;
    const max9BitValue = 0x1ff;

    if (nox === max9BitValue) {
        return null;
    }

    return asNOXIndex(nox);
};

/**
 * Parses the calibration status from the flags byte.
 * Flags byte contains additional information and is interpreted bit-by-bit.
 * Bit 0 (least significant) indicates calibration status:
 * 1 -> Calibration in progress, sensor data not fully accurate yet
 * 0 -> Calibration complete
 *
 * @param rawData - The raw buffer data
 * @param flagsOffset - Byte offset for the flags
 * @returns true if calibration is in progress, false if complete.
 */
export const parseCalibrationInProgress = (rawData: Buffer, flagsOffset: number): boolean => {
    const flags = rawData.readUInt8(flagsOffset);
    return (flags & 0b00000001) === 1;
};

/**
 * Parses the MAC address from the advertisement. In case that all the bits are set for the mac address
 * we'll assume it's invalid/not available.
 *
 * @param rawData - The raw buffer data
 * @param offset - Byte offset to read from
 * @returns The 48bit MAC address as string.
 */
export const parseMacAddress48Bit = (rawData: Buffer, offset: number): string | null => {
    const macAddressData = rawData.readUIntBE(offset, 6);
    const invalidMacAddress = "ffffffffffff";
    const macAddress = macAddressData.toString(16).padStart(12, "0");

    if (macAddress === invalidMacAddress) {
        return null;
    }

    const macAddressArray = macAddress.match(/.{1,2}/g);
    return macAddressArray ? macAddressArray.join(":").toUpperCase() : null;
};
