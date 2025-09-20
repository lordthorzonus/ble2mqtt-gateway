import { RuuviTagAirQualitySensorData } from "../index";
import { DataFormat6ParsingStrategy } from "./data-format-6-parsing-strategy";

describe("Data Format 6 Parsing Strategy", () => {
    const testCases: [string, RuuviTagAirQualitySensorData][] = [
        [
            "06170C5668C79E007000C90A02D9FFCD004C884F",
            {
                type: "air-quality",
                temperature: 29.5,
                pressure: 101102,
                relativeHumidityPercentage: 55.300000000000004,
                measurementSequence: 205,
                macAddress: "4C:88:4F",
                pm25: 11.200000000000001,
                co2: 201,
                voc: 10,
                nox: 2,
                luminosity: 13026.67,
                calibrationInProgress: false,
            },
        ],
        [
            "067FFF9C40FFFE27109C40F4F4FEFFFFC14C884F",
            {
                type: "air-quality",
                temperature: 163.835,
                pressure: 115534,
                relativeHumidityPercentage: 100.0,
                measurementSequence: 255,
                macAddress: "4C:88:4F",
                pm25: 1000.0,
                co2: 40000,
                voc: 500,
                nox: 500,
                luminosity: 65535.0,
                calibrationInProgress: true,
            },
        ],
        [
            "0680010000000000000000000000FF00004C884F",
            {
                type: "air-quality",
                temperature: -163.835,
                pressure: 50000,
                relativeHumidityPercentage: 0.0,
                measurementSequence: 0,
                macAddress: "4C:88:4F",
                pm25: 0.0,
                co2: 0,
                voc: 0,
                nox: 0,
                luminosity: 0.0,
                calibrationInProgress: false,
            },
        ],
        [
            "068000FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
            {
                type: "air-quality",
                temperature: null,
                pressure: null,
                relativeHumidityPercentage: null,
                measurementSequence: 255,
                macAddress: null,
                pm25: null,
                co2: null,
                voc: null,
                nox: null,
                luminosity: null,
                calibrationInProgress: true,
            },
        ],
    ];

    it.each(testCases)(
        "should parse the raw data %s to a valid RuuviTagAirQualitySensorData",
        (rawStringData, expectedRuuviTagSensorData) => {
            const rawData = Buffer.from(rawStringData, "hex");
            expect(DataFormat6ParsingStrategy(rawData)).toEqual(expectedRuuviTagSensorData);
        }
    );
});
