import { describe, expect, it } from "vitest";
import { InvalidRuuviDataLengthError } from "./common-parsing-strategy-utils.js";
import { Effect } from "effect";
import { RuuviTagEnvironmentalSensorData } from "../index.js";
import { DataFormat3ParsingStrategy } from "./data-format-3-parsing-strategy.js";
import { asCelsius, asPascal, asRelativeHumidity } from "../../../units.js";

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
            expect(Effect.runSync(DataFormat3ParsingStrategy(rawData))).toEqual(expectedRuuviTagSensorData);
        }
    );

    it("fails with InvalidRuuviDataLengthError when the data is shorter than the data format reads", () => {
        const rawData = Buffer.from("990403291A1ECE1EFC18F94202CA0B", "hex");

        expect(Effect.runSync(Effect.flip(DataFormat3ParsingStrategy(rawData)))).toStrictEqual(
            new InvalidRuuviDataLengthError({ dataFormat: 0x03, length: rawData.length, minimumLength: 16 })
        );
    });
});
