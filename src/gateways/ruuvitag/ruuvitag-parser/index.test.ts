import { describe, expect, it, vi } from "vitest";
import { Effect } from "effect";

vi.mock("./parsing-strategies/data-format-3-parsing-strategy.js");

vi.mock("./parsing-strategies/data-format-5-parsing-strategy.js");

vi.mock("./parsing-strategies/data-format-6-parsing-strategy.js");

import {
    parse,
    RuuviTagSensorData,
    UnsupportedDataFormatError,
    NotValidRuuviManufacturerIdError,
    InvalidRuuviDataLengthError,
    parseRuuviDataFormat,
} from "./index.js";
import { DataFormat3ParsingStrategy } from "./parsing-strategies/data-format-3-parsing-strategy.js";
import { DataFormat5ParsingStrategy } from "./parsing-strategies/data-format-5-parsing-strategy.js";
import { DataFormat6ParsingStrategy } from "./parsing-strategies/data-format-6-parsing-strategy.js";

describe("RuuviTagParser", () => {
    // Both strategy kinds fit this signature, so one typed sentinel can stand in for either result.
    type AnyParsingStrategy = (
        rawRuuviTagData: Buffer
    ) => Effect.Effect<RuuviTagSensorData, InvalidRuuviDataLengthError>;

    const parsedSentinel: RuuviTagSensorData = {
        type: "environmental",
        macAddress: null,
        measurementSequence: null,
        movementCounter: null,
        txPower: null,
        accelerationX: null,
        accelerationY: null,
        accelerationZ: null,
        batteryVoltage: null,
        pressure: null,
        relativeHumidityPercentage: null,
        temperature: null,
    };

    const ruuviTagDataParsingStrategyMap: [string, AnyParsingStrategy][] = [
        ["990403291A1ECE1EFC18F94202CA0B53", DataFormat3ParsingStrategy],
        ["9904058001000000008001800180010000000000CBB8334C884F", DataFormat5ParsingStrategy],
        ["99040680010000000000000000000000FF00004C884F", DataFormat6ParsingStrategy],
    ];

    it.each(ruuviTagDataParsingStrategyMap)(
        "should use the correct strategy for the correct data format, raw data: %s",
        (rawStringData, expectedParsingStrategy) => {
            return Effect.runPromise(
                Effect.gen(function* () {
                    const ruuviTagData = Buffer.from(rawStringData, "hex");
                    const mockedParse = vi.mocked(expectedParsingStrategy);

                    mockedParse.mockReturnValue(Effect.succeed(parsedSentinel));
                    const result = yield* parse(ruuviTagData);
                    expect(result).toBe(parsedSentinel);
                    expect(mockedParse).toHaveBeenCalledWith(ruuviTagData);
                })
            );
        }
    );

    it("should throw an error if the data given does not have corresponding data parsing strategy", () => {
        return Effect.runPromise(
            Effect.gen(function* () {
                const ruuviTagData = Buffer.from("990407291A1ECE1EFC18F94202CA0B53", "hex");

                const result = yield* Effect.flip(parse(ruuviTagData));
                expect(result).toStrictEqual(new UnsupportedDataFormatError({ dataFormat: 7 }));
            })
        );
    });

    it("should throw an error if the data given is not valid ruuvi tag data", () => {
        return Effect.runPromise(
            Effect.gen(function* () {
                const ruuviTagData = Buffer.from("048806291A1ECE1EFC18F94202CA0B53", "hex");

                const result = yield* Effect.flip(parse(ruuviTagData));
                expect(result).toStrictEqual(new NotValidRuuviManufacturerIdError({ manufacturerId: 0x8804 }));
            })
        );
    });

    it.each(["", "99", "9904"])(
        "fails with InvalidRuuviDataLengthError for a truncated header: '%s'",
        (rawStringData) =>
            Effect.runPromise(
                Effect.gen(function* () {
                    const ruuviTagData = Buffer.from(rawStringData, "hex");

                    const expectedError = new InvalidRuuviDataLengthError({
                        dataFormat: null,
                        length: ruuviTagData.length,
                        minimumLength: 3,
                    });

                    expect(yield* Effect.flip(parse(ruuviTagData))).toStrictEqual(expectedError);
                    expect(yield* Effect.flip(parseRuuviDataFormat(ruuviTagData))).toStrictEqual(expectedError);
                })
            )
    );
});
