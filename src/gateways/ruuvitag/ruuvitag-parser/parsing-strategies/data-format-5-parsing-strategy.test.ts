import { RuuviTagSensorData } from "../index";
import DataFormat5ParsingStrategy from "./data-format-5-parsing-strategy";

describe("Data Format 5 Parsing Strategy", () => {
    const macAddress = "CB:B8:33:4C:88:4F";
    const testCases: [string, RuuviTagSensorData][] = [
        [
            "99040512FC5394C37C0004FFFC040CAC364200CDCBB8334C884F",
            {
                temperature: 24.3,
                pressure: 100044,
                relativeHumidityPercentage: 53.49,
                accelerationX: 0.004,
                accelerationY: -0.004,
                accelerationZ: 1.036,
                batteryVoltage: 2.977,
                txPower: 4,
                movementCounter: 66,
                measurementSequence: 205,
                macAddress,
            },
        ],
        [
            "9904057FFFFFFEFFFE7FFF7FFF7FFFFFDEFEFFFECBB8334C884F",
            {
                temperature: 163.835,
                pressure: 115534,
                relativeHumidityPercentage: 163.835,
                accelerationX: 32.767,
                accelerationY: 32.767,
                accelerationZ: 32.767,
                batteryVoltage: 3.646,
                txPower: 20,
                movementCounter: 254,
                measurementSequence: 65534,
                macAddress,
            },
        ],
        [
            "9904058001000000008001800180010000000000CBB8334C884F",
            {
                temperature: -163.835,
                pressure: 50000,
                relativeHumidityPercentage: 0.0,
                accelerationX: -32.767,
                accelerationY: -32.767,
                accelerationZ: -32.767,
                batteryVoltage: 1.6,
                txPower: -40,
                movementCounter: 0,
                measurementSequence: 0,
                macAddress,
            },
        ],
        [
            "9904058000FFFFFFFF800080008000FFFFFFFFFFFFFFFFFFFFFF",
            {
                temperature: null,
                pressure: null,
                relativeHumidityPercentage: null,
                accelerationX: null,
                accelerationY: null,
                accelerationZ: null,
                batteryVoltage: null,
                txPower: null,
                movementCounter: null,
                measurementSequence: null,
                macAddress: null,
            },
        ],
    ];

    it.each(testCases)(
        "should parse the raw data %s to a valid RuuviTagSensorData",
        (rawStringData, expectedRuuviTagSensorData) => {
            const rawData = Buffer.from(rawStringData, "hex");
            expect(DataFormat5ParsingStrategy.parse(rawData)).toEqual(expectedRuuviTagSensorData);
        }
    );
});
