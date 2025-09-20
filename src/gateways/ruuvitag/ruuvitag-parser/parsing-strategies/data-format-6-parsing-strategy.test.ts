import { RuuviTagAirQualitySensorData } from "../index";
import { DataFormat6ParsingStrategy } from "./data-format-6-parsing-strategy";
import {
    asCelsius,
    asPascal,
    asRelativeHumidity,
    asPM2_5,
    asCO2Ppm,
    asVOCIndex,
    asNOXIndex,
    asLux,
} from "../../../units";

describe("Data Format 6 Parsing Strategy", () => {
    const testCases: [string, RuuviTagAirQualitySensorData][] = [
        [
            "990406170C5668C79E007000C90A02D900CD004C884F",
            {
                type: "air-quality",
                temperature: asCelsius(29.5),
                pressure: asPascal(101102),
                relativeHumidityPercentage: asRelativeHumidity(55.300000000000004),
                measurementSequence: 205,
                macAddress: "4C:88:4F",
                pm1: null,
                pm2_5: asPM2_5(11.200000000000001),
                pm4: null,
                pm10: null,
                co2: asCO2Ppm(201),
                voc: asVOCIndex(10),
                nox: asNOXIndex(2),
                luminosity: asLux(13026.67),
                calibrationInProgress: false,
            },
        ],
        [
            "9904067FFF9C40FFFE27109C40F4F4FEC0FFFF4C884F",
            {
                type: "air-quality",
                temperature: asCelsius(163.835),
                pressure: asPascal(115534),
                relativeHumidityPercentage: asRelativeHumidity(100.0),
                measurementSequence: 255,
                macAddress: "4C:88:4F",
                pm1: null,
                pm2_5: asPM2_5(1000.0),
                pm4: null,
                pm10: null,
                co2: asCO2Ppm(40000),
                voc: asVOCIndex(500),
                nox: asNOXIndex(500),
                luminosity: asLux(65535),
                calibrationInProgress: true,
            },
        ],
        [
            "99040680010000000000000000000000FF00004C884F",
            {
                type: "air-quality",
                temperature: asCelsius(-163.835),
                pressure: asPascal(50000),
                relativeHumidityPercentage: asRelativeHumidity(0.0),
                measurementSequence: 0,
                macAddress: "4C:88:4F",
                pm1: null,
                pm2_5: asPM2_5(0),
                pm4: null,
                pm10: null,
                co2: asCO2Ppm(0),
                voc: asVOCIndex(0),
                nox: asNOXIndex(0),
                luminosity: asLux(0.0),
                calibrationInProgress: false,
            },
        ],
        [
            "9904068000FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
            {
                type: "air-quality",
                temperature: null,
                pressure: null,
                relativeHumidityPercentage: null,
                measurementSequence: 255,
                macAddress: null,
                pm1: null,
                pm2_5: null,
                pm4: null,
                pm10: null,
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
