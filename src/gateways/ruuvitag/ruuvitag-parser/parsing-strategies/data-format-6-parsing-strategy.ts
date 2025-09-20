import { RuuviTagAirQualityParsingStrategy } from "../index";

enum DataFormatV6Offset {
    Temperature = 1,
    Humidity = 3,
    Pressure = 5,
    PM25 = 7,
    CO2 = 9,
    VOC = 11,
    NOX = 12,
    Luminosity = 13,
    Reserved = 14,
    MeasurementSequence = 15,
    Flags = 16,
    MacAddress = 17,
}

const isInvalidMeasurementForSigned16BitInteger = (value: number): boolean => {
    return value === 0x8000 || value === -0x8000;
};

const isInvalidMeasurementForUnsigned16BitInteger = (value: number) => {
    return value === 0xffff;
};

/**
 * Parses the temperature from the advertisement.
 * Values supported: -163.835 °C to +163.835 °C in 0.005 °C increments.
 *
 * Example:
 * Value    Measurement
 * 0x0000   0 °C
 * 0x01C3   +2.255 °C
 * 0xFE3D   -2.255 °C
 * 0x8000   Invalid / not available
 *
 * @return Returns the value in Celsius (°C).
 */
const parseTemperature = (rawData: Buffer): number | null => {
    const temperature = rawData.readInt16BE(DataFormatV6Offset.Temperature);
    const degreeIncrements = 0.005;

    if (isInvalidMeasurementForSigned16BitInteger(temperature)) {
        return null;
    }

    return temperature * degreeIncrements;
};

/**
 * Parses the humidity from the advertisement.
 * Values supported: 0.0 % to 100 % in 0.0025 % increments.
 * Higher values than 100 % are possible, but they generally indicate a faulty or miscalibrated sensor.
 *
 * Example:
 * Value    Measurement
 * 0        0%
 * 10010    25.025%
 * 40000    100.0%
 * 65535    Invalid / not available
 *
 * @return Returns the value in percents (%).
 */
const parseRelativeHumidity = (rawData: Buffer): number | null => {
    const humidity = rawData.readUInt16BE(DataFormatV6Offset.Humidity);
    const percentageIncrements = 0.0025;

    if (isInvalidMeasurementForUnsigned16BitInteger(humidity)) {
        return null;
    }

    return humidity * percentageIncrements;
};

/**
 * Parses the atmospheric pressure from the advertisement.
 * Values supported: 50000 Pa to 115534 Pa in 1 Pa increments.
 *
 * Example:
 * Value    Measurement
 * 00000    50000 Pa
 * 51325    101325 Pa (average sea-level pressure)
 * 65534    115534 Pa
 * 65535    Invalid / not available
 *
 * @return Returns the pressure in Pascals (Pa).
 */
const parsePressure = (rawData: Buffer): number | null => {
    const pressure = rawData.readUInt16BE(DataFormatV6Offset.Pressure);
    const minimumSupportedPascalMeasurement = 50000;

    if (isInvalidMeasurementForUnsigned16BitInteger(pressure)) {
        return null;
    }

    return pressure + minimumSupportedPascalMeasurement;
};

/**
 * Parses the PM 2.5 (particulate matter) concentration from the advertisement.
 * Values supported: 0 to 6553.4 (μg/m³), however the sensor on Ruuvi supports only 1000 μg/m³.
 * Resolution is 0.1 per bit.
 *
 * Example:
 * Value    Measurement
 * 0x0000   0 μg/m³
 * 0x03E8   100.0 μg/m³
 * 0xFFFF   Invalid / not available
 *
 * @return Returns the value in micrograms per cubic meter (μg/m³).
 */
const parsePM25 = (rawData: Buffer): number | null => {
    const pm25 = rawData.readUInt16BE(DataFormatV6Offset.PM25);
    const resolution = 0.1;

    if (isInvalidMeasurementForUnsigned16BitInteger(pm25)) {
        return null;
    }

    return pm25 * resolution;
};

/**
 * Parses the CO2 concentration from the advertisement.
 * Values supported: 0 to 65534 (ppm), however the sensor on Ruuvi supports only 40000 ppm.
 * In natural environment CO2 is always at least around 400 ppm. Resolution is 1 per bit.
 *
 * Example:
 * Value    Measurement
 * 0x0000   0 ppm
 * 0x03E8   1000 ppm
 * 0xFFFF   Invalid / not available
 *
 * @return Returns the value in parts per million (ppm).
 */
const parseCO2 = (rawData: Buffer): number | null => {
    const co2 = rawData.readUInt16BE(DataFormatV6Offset.CO2);

    if (isInvalidMeasurementForUnsigned16BitInteger(co2)) {
        return null;
    }

    return co2;
};

/**
 * Parses the VOC (Volatile Organic Compounds) index from the advertisement.
 * VOC is a unitless index which learns the installation environment and tracks changes over time.
 * The index average is 100, i.e. values under 100 mean the air quality is improving and
 * values over 100 mean the air quality is getting worse.
 * Uses 9 bits, with the least significant bit stored in the Flags byte (bit 6).
 *
 * Example:
 * Value    Measurement
 * 0x000    0
 * 0x0E8    232
 * 0x1FF    Invalid / not available
 *
 * @return Returns the VOC index (unitless).
 */
const parseVOC = (rawData: Buffer): number | null => {
    const vocLower8Bits = rawData.readUInt8(DataFormatV6Offset.VOC);
    const flags = rawData.readUInt8(DataFormatV6Offset.Flags);
    const vocUpperBit = (flags & 0b01000000) >> 6;
    const voc = (vocUpperBit << 8) | vocLower8Bits;
    const max9BitValue = 0x1ff;

    if (voc === max9BitValue) {
        return null;
    }

    return voc;
};

/**
 * Parses the NOX (Nitrogen Oxides) index from the advertisement.
 * NOX is a unitless index which learns the installation environment and tracks changes over time.
 * The index has a base value of 1, values higher than 1 meaning there's more nitrogen oxides
 * in the air than usual.
 * Uses 9 bits, with the least significant bit stored in the Flags byte (bit 7).
 *
 * Example:
 * Value    Measurement
 * 0x000    0
 * 0x0E8    232
 * 0x1FF    Invalid / not available
 *
 * @return Returns the NOX index (unitless).
 */
const parseNOX = (rawData: Buffer): number | null => {
    const noxLower8Bits = rawData.readUInt8(DataFormatV6Offset.NOX);
    const flags = rawData.readUInt8(DataFormatV6Offset.Flags);
    const noxUpperBit = (flags & 0b10000000) >> 7;
    const nox = (noxUpperBit << 8) | noxLower8Bits;
    const max9BitValue = 0x1ff;

    if (nox === max9BitValue) {
        return null;
    }

    return nox;
};

/**
 * Parses the luminosity from the advertisement.
 * Luminosity represents the light level in the environment of the sensor.
 * The light level is compensated with human eye sensitivity curve.
 * Value is 8-bit unsigned logarithmic number. Values should be rounded at most to 0.01 precision.
 * The highest valid code is 254, and 255 is reserved for "not available".
 *
 * Decoding formula:
 * MAX_VALUE := 65535
 * MAX_CODE  := 254
 * DELTA     := ln(MAX_VALUE + 1) / MAX_CODE
 * VALUE     := exp(CODE * DELTA) - 1
 *
 * Example:
 * Value    Measurement
 * 0x00     0 lux
 * 0x01     0.04 lux
 * 0x10     1.01 lux
 * 0x80     244.06 lux
 * 0xFE     65535.00 lux
 * 0xFF     Invalid / not available
 *
 * @return Returns the value in Lux.
 */
const parseLuminosity = (rawData: Buffer): number | null => {
    const code = rawData.readUInt8(DataFormatV6Offset.Luminosity);
    const maxCode = 254;

    if (code === 255) {
        return null;
    }

    if (code === 0) {
        return 0;
    }

    const maxValue = 65535;
    const delta = Math.log(maxValue + 1) / maxCode;
    const value = Math.exp(code * delta) - 1;

    return Math.round(value * 100) / 100;
};

/**
 * Parses the measurement sequence number from the advertisement.
 * Measurement sequence number gets incremented by one for every measurement.
 * It can be used to gauge signal quality and packet loss as well as to deduplicate data entries.
 * You should note that the measurement sequence refers to data rather than transmission,
 * so you might receive many transmissions with the same measurement sequence number.
 * The highest valid value is 255, there is no "invalid / not available" value as this
 * counter tracks the E1 format counter.
 *
 * Example:
 * Value    Measurement
 * 0x00     0 counts
 * 0x10     10 counts
 * 0xFF     255 counts
 *
 * @return Returns the measurement sequence as number.
 */
const parseMeasurementSequence = (rawData: Buffer): number | null => {
    const measurementSequence = rawData.readUInt8(DataFormatV6Offset.MeasurementSequence);
    return measurementSequence;
};

/**
 * Parses the calibration status from the flags byte.
 * Flags byte contains additional information and is interpreted bit-by-bit.
 * Bit 0 (least significant) indicates calibration status:
 * 1 -> Calibration in progress, sensor data not fully accurate yet
 * 0 -> Calibration complete
 *
 * @return Returns true if calibration is in progress, false if complete.
 */
const parseCalibrationInProgress = (rawData: Buffer): boolean => {
    const flags = rawData.readUInt8(DataFormatV6Offset.Flags);
    return (flags & 0b00000001) === 1;
};

/**
 * Parses the MAC address from the advertisement.
 * MAC address is static, statistically unique random identifier of the device.
 * The address is 48 bits, but this data format carries only 24 least significant bits.
 * The Bluetooth advertisement itself carries the full MAC address of the sensor,
 * and most host devices can and should parse the MAC address directly from the Bluetooth metadata.
 * However, iOS devices do not reveal the full MAC address to the application,
 * but instead convert the MAC address to an UUID which is not guaranteed to stay static.
 * Hence iOS devices should use these 24 bits as a static identifier of the device.
 * In case that all the bits are set for the mac address we'll assume it's invalid/not available.
 *
 * @return Returns the 24-bit MAC address as string (3 bytes).
 */
const parseMacAddress = (rawData: Buffer): string | null => {
    const macAddressData = rawData.readUIntBE(DataFormatV6Offset.MacAddress, 3);
    const invalidMacAddress = "ffffff";
    const macAddress = macAddressData.toString(16).padStart(6, "0");

    if (macAddress === invalidMacAddress) {
        return null;
    }

    const macAddressArray = macAddress.match(/.{1,2}/g);
    return macAddressArray ? macAddressArray.join(":").toUpperCase() : null;
};

/**
 * Parses the raw manufacturer specific data field according to the Data Format 6 Specification.
 * This data format uses Bluetooth 4 advertisement extension to be compatible with Bluetooth 4 devices.
 * Any Bluetooth 5.0 and upwards capable device should discard this data format and listen to
 * data format E1 packets instead.
 *
 * Data format 6 focuses on air quality measurements and includes environmental sensors for context.
 * It provides PM2.5, CO2, VOC, NOX measurements along with basic environmental data.
 *
 * Data field layout (20 bytes total):
 * Offset 0: Data format (6)
 * Offset 1-2: Temperature (-163.835°C to +163.835°C in 0.005°C increments)
 * Offset 3-4: Humidity (0-163.83% in 0.0025% increments)
 * Offset 5-6: Pressure (50000-115534 Pa in 1 Pa increments)
 * Offset 7-8: PM 2.5 (0-1000.0 μg/m³ in 0.1 μg/m³ increments)
 * Offset 9-10: CO2 (0-40000 ppm in 1 ppm increments)
 * Offset 11: VOC index lower 8 bits (0-500, unitless)
 * Offset 12: NOX index lower 8 bits (0-500, unitless)
 * Offset 13: Luminosity (0-65535 lux, logarithmic encoding)
 * Offset 14: Reserved
 * Offset 15: Measurement sequence (0-255)
 * Offset 16: Flags (VOC/NOX upper bits + calibration status)
 * Offset 17-19: MAC address (24 least significant bits)
 *
 * @see https://docs.ruuvi.com/communication/bluetooth-advertisements/data-format-6
 */
export const DataFormat6ParsingStrategy: RuuviTagAirQualityParsingStrategy = (rawRuuviTagData) => {
    return {
        type: "air-quality",
        temperature: parseTemperature(rawRuuviTagData),
        relativeHumidityPercentage: parseRelativeHumidity(rawRuuviTagData),
        pressure: parsePressure(rawRuuviTagData),
        pm25: parsePM25(rawRuuviTagData),
        co2: parseCO2(rawRuuviTagData),
        voc: parseVOC(rawRuuviTagData),
        nox: parseNOX(rawRuuviTagData),
        luminosity: parseLuminosity(rawRuuviTagData),
        measurementSequence: parseMeasurementSequence(rawRuuviTagData),
        macAddress: parseMacAddress(rawRuuviTagData),
        calibrationInProgress: parseCalibrationInProgress(rawRuuviTagData),
    };
};
