import { RuuviTagEnvironmentalSensorData } from "../index";
import { DataFormat3ParsingStrategy } from "./data-format-3-parsing-strategy";
import { asCelsius, asPascal, asRelativeHumidity } from "../../../units";

describe("Data Format 3 Parsing Strategy", () => {
    const testCases: [string, RuuviTagEnvironmentalSensorData][] = [
        [
            "990403291A1ECE1EFC18F94202CA0B53",
            {
                type: "environmental",
                temperature: asCelsius(26.3),
                pressure: asPascal(102766),
                relativeHumidityPercentage: asRelativeHumidity(20.5),
                accelerationX: -1.0,
                accelerationY: -1.726,
                accelerationZ: 0.714,
                batteryVoltage: 2.899,
                txPower: null,
                measurementSequence: null,
                movementCounter: null,
                macAddress: null,
            },
        ],
        [
            "990403FF7F63FFFF7FFF7FFF7FFFFFFF",
            {
                type: "environmental",
                temperature: asCelsius(127.99),
                pressure: asPascal(115535),
                relativeHumidityPercentage: asRelativeHumidity(127.5),
                accelerationX: 32.767,
                accelerationY: 32.767,
                accelerationZ: 32.767,
                batteryVoltage: 65.535,
                txPower: null,
                measurementSequence: null,
                movementCounter: null,
                macAddress: null,
            },
        ],
        [
            "99040300FF6300008001800180010000",
            {
                type: "environmental",
                temperature: asCelsius(-127.99),
                pressure: asPascal(50000),
                relativeHumidityPercentage: asRelativeHumidity(0.0),
                accelerationX: -32.767,
                accelerationY: -32.767,
                accelerationZ: -32.767,
                batteryVoltage: 0.0,
                txPower: null,
                measurementSequence: null,
                movementCounter: null,
                macAddress: null,
            },
        ],
    ];

    it.each(testCases)(
        "should parse the raw data %s to a valid RuuviTagSensorData",
        (rawStringData, expectedRuuviTagSensorData) => {
            const rawData = Buffer.from(rawStringData, "hex");
            expect(DataFormat3ParsingStrategy(rawData)).toEqual(expectedRuuviTagSensorData);
        }
    );
});
