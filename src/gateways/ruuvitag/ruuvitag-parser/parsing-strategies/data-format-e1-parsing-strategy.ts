import { asLux, asPM1, asPM10, asPM2_5, asPM4, Lux } from "../../../units";
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
    parseMacAddress48Bit,
    isInvalidMeasurementForUnsigned24BitInteger,
} from "./common-parsing-strategy-utils";

enum DataFormatE1Offset {
    Temperature = 3,
    Humidity = 5,
    Pressure = 7,
    PM10 = 9,
    PM25 = 11,
    PM40 = 13,
    PM100 = 15,
    CO2 = 17,
    VOC = 19,
    NOX = 20,
    Luminosity = 21,
    Reserved1 = 24,
    Reserved2 = 25,
    Reserved3 = 26,
    MeasurementSequence = 27,
    Flags = 30,
    Reserved4 = 31,
    MacAddress = 36,
}

/**
 * Parses the luminosity from the advertisement using linear encoding (24-bit).
 * Luminosity represents the light level in the environment of the sensor.
 * The light level is compensated with human eye sensitivity curve.
 * Values supported: 0 to 144284.00 lux with 0.01 lux resolution.
 *
 * @param rawData - The raw buffer data
 * @param offset - Byte offset to read from
 * @returns Luminosity in Lux or null if invalid
 */
const parseLuminosity = (rawData: Buffer, offset: number): Lux | null => {
    const luminosity = rawData.readUIntBE(offset, 3);
    const resolution = 0.01;

    if (isInvalidMeasurementForUnsigned24BitInteger(luminosity)) {
        return null;
    }

    return asLux(luminosity * resolution);
};

/**
 * Parses the measurement sequence number from the advertisement.
 * Measurement sequence number gets incremented by one for every measurement.
 * It can be used to gauge signal quality and packet loss as well as to deduplicate data entries.
 * Uses 24-bit encoding, supporting values from 0 to 16777214.
 *
 * @param rawData - The raw buffer data
 * @param offset - Byte offset to read from
 * @returns The measurement sequence number or null if invalid
 */
const parseMeasurementSequence = (rawData: Buffer, offset: number): number | null => {
    const measurementSequence = rawData.readUIntBE(offset, 3);

    if (isInvalidMeasurementForUnsigned24BitInteger(measurementSequence)) {
        return null;
    }

    return measurementSequence;
};

/**
 * Parses the raw manufacturer specific data field according to the Data Format E1 Specification.
 * This data format uses Bluetooth 5 advertisement extension to provide more data than
 * Bluetooth 4 advertisements can. Any Bluetooth 5.0 and upwards capable device should
 * be able to receive the data format. It extends on data format 6; if the same device
 * sends both in data format 6 and E1, the format 6 packet should be discarded.
 *
 * Data format E1 focuses on air quality measurements and includes environmental sensors for context.
 * It provides PM1.0, PM2.5, PM4.0, PM10.0, CO2, VOC, NOX measurements along with basic environmental data.
 *
 * Data field layout (40 bytes total):
 * Offset 0: Data format (E1)
 * Offset 1-2: Temperature (-163.835°C to +163.835°C in 0.005°C increments)
 * Offset 3-4: Humidity (0-163.83% in 0.0025% increments)
 * Offset 5-6: Pressure (50000-115534 Pa in 1 Pa increments)
 * Offset 7-8: PM 1.0 (0-1000.0 μg/m³ in 0.1 μg/m³ increments)
 * Offset 9-10: PM 2.5 (0-1000.0 μg/m³ in 0.1 μg/m³ increments)
 * Offset 11-12: PM 4.0 (0-1000.0 μg/m³ in 0.1 μg/m³ increments)
 * Offset 13-14: PM 10.0 (0-1000.0 μg/m³ in 0.1 μg/m³ increments)
 * Offset 15-16: CO2 (0-40000 ppm in 1 ppm increments)
 * Offset 17: VOC index lower 8 bits (0-500, unitless)
 * Offset 18: NOX index lower 8 bits (0-500, unitless)
 * Offset 19-21: Luminosity (0-144284.00 lux, resolution 0.01/bit)
 * Offset 22-24: Reserved
 * Offset 25-27: Measurement sequence (0-16777214)
 * Offset 28: Flags (VOC/NOX upper bits + calibration status)
 * Offset 29-33: Reserved
 * Offset 34-39: MAC address (48 bits)
 *
 * @see https://docs.ruuvi.com/communication/bluetooth-advertisements/data-format-e1
 */
export const DataFormatE1ParsingStrategy: RuuviTagAirQualityParsingStrategy = (rawRuuviTagData) => {
    const pm1 = parseParticulateMatter(rawRuuviTagData, DataFormatE1Offset.PM10);
    const pm2_5 = parseParticulateMatter(rawRuuviTagData, DataFormatE1Offset.PM25);
    const pm4 = parseParticulateMatter(rawRuuviTagData, DataFormatE1Offset.PM40);
    const pm10 = parseParticulateMatter(rawRuuviTagData, DataFormatE1Offset.PM100);

    return {
        type: "air-quality",
        temperature: parseTemperature(rawRuuviTagData, DataFormatE1Offset.Temperature),
        relativeHumidityPercentage: parseRelativeHumidity(rawRuuviTagData, DataFormatE1Offset.Humidity),
        pressure: parsePressure(rawRuuviTagData, DataFormatE1Offset.Pressure),
        pm1: pm1 ? asPM1(pm1) : null,
        pm2_5: pm2_5 ? asPM2_5(pm2_5) : null,
        pm4: pm4 ? asPM4(pm4) : null,
        pm10: pm10 ? asPM10(pm10) : null,
        co2: parseCO2(rawRuuviTagData, DataFormatE1Offset.CO2),
        voc: parseVOC(rawRuuviTagData, DataFormatE1Offset.VOC, DataFormatE1Offset.Flags),
        nox: parseNOX(rawRuuviTagData, DataFormatE1Offset.NOX, DataFormatE1Offset.Flags),
        luminosity: parseLuminosity(rawRuuviTagData, DataFormatE1Offset.Luminosity),
        measurementSequence: parseMeasurementSequence(rawRuuviTagData, DataFormatE1Offset.MeasurementSequence),
        macAddress: parseMacAddress48Bit(rawRuuviTagData, DataFormatE1Offset.MacAddress),
        calibrationInProgress: parseCalibrationInProgress(rawRuuviTagData, DataFormatE1Offset.Flags),
    };
};
