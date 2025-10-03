import { RuuviAirSensorData } from "../index";
import { DataFormatE1ParsingStrategy } from "./data-format-e1-parsing-strategy";
import {
    asCelsius,
    asPascal,
    asRelativeHumidity,
    asPM1,
    asPM2_5,
    asPM4,
    asPM10,
    asCO2Ppm,
    asVOCIndex,
    asNOXIndex,
    asLux,
} from "../../../units";

describe("Data Format E1 Parsing Strategy", () => {
    const testCases: [string, RuuviAirSensorData][] = [
        [
            "9904E1170C5668C79E0065007004BD11CA00C9140413E0AC3FFFFFFECDEE11FFFFFFFFFFFFCBB8334C884F",
            {
                type: "air-quality",
                temperature: asCelsius(29.5),
                pressure: asPascal(101102),
                relativeHumidityPercentage: asRelativeHumidity(55.300000000000004),
                pm1: asPM1(10.100000000000001),
                pm2_5: asPM2_5(11.200000000000001),
                pm4: asPM4(121.30000000000001),
                pm10: asPM10(455.40000000000003),
                co2: asCO2Ppm(201),
                voc: asVOCIndex(20),
                nox: asNOXIndex(4),
                luminosity: asLux(13027.0),
                measurementSequence: 16698862,
                macAddress: "FF:CB:B8:33:4C:88",
                calibrationInProgress: true,
            },
        ],
        [
            "9904E17FFF9C40FFFE27102710271027109C40F4F4DC28F0FFFFFFFFFFFEC1FFFFFFFFFFFFFFFFCBB8334C884F",
            {
                type: "air-quality",
                temperature: asCelsius(163.835),
                pressure: asPascal(115534),
                relativeHumidityPercentage: asRelativeHumidity(100.0),
                pm1: asPM1(1000.0),
                pm2_5: asPM2_5(1000.0),
                pm4: asPM4(1000.0),
                pm10: asPM10(1000.0),
                co2: asCO2Ppm(40000),
                voc: asVOCIndex(500),
                nox: asNOXIndex(500),
                luminosity: asLux(144284),
                measurementSequence: 16777214,
                macAddress: "FF:FF:FF:CB:B8:33",
                calibrationInProgress: true,
            },
        ],
        [
            "9904E180010000000000000000000000000000000000000000FFFFFF000000FFFFFFFFFFFFCBB8334C884F",
            {
                type: "air-quality",
                temperature: asCelsius(-163.835),
                pressure: asPascal(50000),
                relativeHumidityPercentage: asRelativeHumidity(0.0),
                pm1: asPM1(0.0),
                pm2_5: asPM2_5(0.0),
                pm4: asPM4(0.0),
                pm10: asPM10(0.0),
                co2: asCO2Ppm(0),
                voc: asVOCIndex(0),
                nox: asNOXIndex(0),
                luminosity: asLux(0),
                measurementSequence: 16711680,
                macAddress: "FF:CB:B8:33:4C:88",
                calibrationInProgress: false,
            },
        ],
        [
            "9904E18000FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
            {
                type: "air-quality",
                temperature: null,
                pressure: null,
                relativeHumidityPercentage: null,
                pm1: null,
                pm2_5: null,
                pm4: null,
                pm10: null,
                co2: null,
                voc: null,
                nox: null,
                luminosity: null,
                measurementSequence: null,
                macAddress: null,
                calibrationInProgress: true,
            },
        ],
    ];

    it.each(testCases)(
        "should parse the raw data %s to a valid RuuviTagAirQualitySensorData",
        (rawStringData, expectedRuuviTagSensorData) => {
            const rawData = Buffer.from(rawStringData, "hex");
            expect(DataFormatE1ParsingStrategy(rawData)).toEqual(expectedRuuviTagSensorData);
        }
    );
});
