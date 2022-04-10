import { RuuviTagParsingStrategy } from "../index";

enum DataFormatV3Offset {
    Humidity = 3,
    TemperatureBase = 4,
    TemperatureFraction = 5,
    Pressure = 6,
    AccelerationX = 8,
    AccelerationY = 10,
    AccelerationZ = 12,
    BatteryVoltage = 14,
}

/**
 * Parses the acceleration data from the advertisement.
 * Values are 16 bit signed integers. All channels are identical.
 *
 * @return Returns values in G.
 */
const parseAcceleration = (rawData: Buffer, dataOffset: DataFormatV3Offset): number => {
    const acceleration = rawData.readInt16BE(dataOffset);
    return acceleration / 1000;
};

/**
 * Parses the temperature from the advertisement.
 * Temperature is divided in base temperature which is a signed byte and fractions.
 *
 * @return Returns the value in Celsius (C).
 */
const parseTemperature = (rawData: Buffer): number => {
    const temperatureByte = rawData.readUInt8(DataFormatV3Offset.TemperatureBase);

    // First bit is the sign bit, which tells if the temperature is negative.
    const temperatureBase = temperatureByte & 0x7f;
    const isTemperatureNegative = ((temperatureByte >> 7) & 1) === 1;
    const temperatureFraction = rawData.readUInt8(DataFormatV3Offset.TemperatureFraction) / 100;

    const temperature = temperatureBase + temperatureFraction;

    return isTemperatureNegative ? temperature * -1 : temperature;
};

/**
 * Parses the humidity from the advertisement.
 * One lsb is 0.5%, e.g. 128 is 64%. Values above 200 (100%) indicate a fault in sensor.
 *
 * @return Returns the value in percents (%)
 */
const parseRelativeHumidity = (rawData: Buffer): number => {
    return rawData.readUInt8(DataFormatV3Offset.Humidity) * 0.5;
};

/**
 * Parses the battery voltage from the advertisement.
 *
 * @return Returns the value in Volts (V).
 */
const parseBatteryVoltage = (rawData: Buffer): number => {
    return rawData.readUInt16BE(DataFormatV3Offset.BatteryVoltage) / 1000;
};

/**
 * Parses the Atmospheric pressure from the advertisement.
 * Values supported by the RuuviTag are 50000 Pa to 115536 Pa in 1 Pa increments.
 *
 * Example:
 * Value    Measurement
 * 00000    50000 Pa
 * 51325    101325 Pa (average sea-level pressure)
 * 65536    115536 Pa
 *
 * @return Returns the pressure in Pascals (Pa).
 */
const parsePressure = (rawData: Buffer): number => {
    const minimumSupportedPascalMeasurement = 50000;
    return rawData.readUInt16BE(DataFormatV3Offset.Pressure) + minimumSupportedPascalMeasurement;
};

/**
 * Parses the raw manufacturer specific data field according to the Data Format 3 Specification (RAWv1)
 * @see https://github.com/ruuvi/ruuvi-sensor-protocols/blob/master/dataformat_03.md
 */
const DataFormat3ParsingStrategy: RuuviTagParsingStrategy = {
    parse(rawRuuviTagData) {
        return {
            accelerationX: parseAcceleration(rawRuuviTagData, DataFormatV3Offset.AccelerationX),
            accelerationY: parseAcceleration(rawRuuviTagData, DataFormatV3Offset.AccelerationY),
            accelerationZ: parseAcceleration(rawRuuviTagData, DataFormatV3Offset.AccelerationZ),
            batteryVoltage: parseBatteryVoltage(rawRuuviTagData),
            relativeHumidityPercentage: parseRelativeHumidity(rawRuuviTagData),
            pressure: parsePressure(rawRuuviTagData),
            temperature: parseTemperature(rawRuuviTagData),
            measurementSequence: null,
            movementCounter: null,
            txPower: null,
            macAddress: null,
        };
    },
};

export default DataFormat3ParsingStrategy;
