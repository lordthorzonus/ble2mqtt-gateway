import { RuuviTagAirQualityParsingStrategy } from "../index";
import {
    parseTemperature,
    parseRelativeHumidity,
    parsePressure,
    parseParticulateMatter,
    parseCO2,
    parseVOC,
    parseNOX,
    parseCalibrationInProgress,
} from "./common-parsing-strategy-utils";

enum DataFormatV6Offset {
    Temperature = 3,
    Humidity = 5,
    Pressure = 7,
    PM25 = 9,
    CO2 = 11,
    VOC = 13,
    NOX = 14,
    Luminosity = 15,
    Reserved = 16,
    MeasurementSequence = 17,
    Flags = 18,
    MacAddress = 19,
}

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
 * @param rawData - The raw buffer data
 * @param offset - Byte offset to read from
 * @returns The value in Lux.
 */
const parseLuminosity = (rawData: Buffer, offset: number): number | null => {
    const code = rawData.readUInt8(offset);
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
 * @param rawData - The raw buffer data
 * @param offset - Byte offset to read from
 * @returns The measurement sequence as number.
 */
const parseMeasurementSequence = (rawData: Buffer, offset: number): number => {
    return rawData.readUInt8(offset);
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
 * @param rawData - The raw buffer data
 * @param offset - Byte offset to read from
 * @returns The 24-bit MAC address as string (3 bytes).
 */
const parseMacAddress = (rawData: Buffer, offset: number): string | null => {
    const macAddressData = rawData.readUIntBE(offset, 3);
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
        temperature: parseTemperature(rawRuuviTagData, DataFormatV6Offset.Temperature),
        relativeHumidityPercentage: parseRelativeHumidity(rawRuuviTagData, DataFormatV6Offset.Humidity),
        pressure: parsePressure(rawRuuviTagData, DataFormatV6Offset.Pressure),
        pm1: null,
        pm2_5: parseParticulateMatter(rawRuuviTagData, DataFormatV6Offset.PM25),
        pm4: null,
        pm10: null,
        co2: parseCO2(rawRuuviTagData, DataFormatV6Offset.CO2),
        voc: parseVOC(rawRuuviTagData, DataFormatV6Offset.VOC, DataFormatV6Offset.Flags),
        nox: parseNOX(rawRuuviTagData, DataFormatV6Offset.NOX, DataFormatV6Offset.Flags),
        luminosity: parseLuminosity(rawRuuviTagData, DataFormatV6Offset.Luminosity),
        measurementSequence: parseMeasurementSequence(rawRuuviTagData, DataFormatV6Offset.MeasurementSequence),
        macAddress: parseMacAddress(rawRuuviTagData, DataFormatV6Offset.MacAddress),
        calibrationInProgress: parseCalibrationInProgress(rawRuuviTagData, DataFormatV6Offset.Flags),
    };
};
