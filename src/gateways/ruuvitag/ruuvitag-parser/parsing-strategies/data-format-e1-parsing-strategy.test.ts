import { RuuviTagAirQualitySensorData } from "../index";
import { DataFormatE1ParsingStrategy } from "./data-format-e1-parsing-strategy";

describe("Data Format E1 Parsing Strategy", () => {
    const testCases: [string, RuuviTagAirQualitySensorData][] = [
        [
            "9904E1170C5668C79E0065007004BD11CA00C9140413E0AC3FFFFFFECDEE11FFFFFFFFFFFFCBB8334C884F",
            {
                type: "air-quality",
                temperature: 29.5,
                pressure: 101102,
                relativeHumidityPercentage: 55.300000000000004,
                pm1: 10.100000000000001,
                pm2_5: 11.200000000000001,
                pm4: 121.30000000000001,
                pm10: 455.40000000000003,
                co2: 201,
                voc: 20,
                nox: 4,
                luminosity: 13027.0,
                measurementSequence: 16698862,
                macAddress: "FF:CB:B8:33:4C:88",
                calibrationInProgress: true,
            },
        ],
        [
            "9904E17FFF9C40FFFE27102710271027109C40F4F4DC28F0FFFFFFFFFFFEC1FFFFFFFFFFFFFFFFCBB8334C884F",
            {
                type: "air-quality",
                temperature: 163.835,
                pressure: 115534,
                relativeHumidityPercentage: 100.0,
                pm1: 1000.0,
                pm2_5: 1000.0,
                pm4: 1000.0,
                pm10: 1000.0,
                co2: 40000,
                voc: 500,
                nox: 500,
                luminosity: 144284,
                measurementSequence: 16777214,
                macAddress: "FF:FF:FF:CB:B8:33",
                calibrationInProgress: true,
            },
        ],
        [
            "9904E180010000000000000000000000000000000000000000FFFFFF000000FFFFFFFFFFFFCBB8334C884F",
            {
                type: "air-quality",
                temperature: -163.835,
                pressure: 50000,
                relativeHumidityPercentage: 0.0,
                pm1: 0.0,
                pm2_5: 0.0,
                pm4: 0.0,
                pm10: 0.0,
                co2: 0,
                voc: 0,
                nox: 0,
                luminosity: 0,
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
