import { Effect } from "effect";
import Mock = jest.Mock;

jest.mock("./parsing-strategies/data-format-3-parsing-strategy");
jest.mock("./parsing-strategies/data-format-5-parsing-strategy");
jest.mock("./parsing-strategies/data-format-6-parsing-strategy");

import {
    parse,
    RuuviTagParsingStrategy,
    UnsupportedDataFormatError,
    NotValidRuuviManufacturerIdError,
    RuuviAirParsingStrategy,
} from "./index";
import { DataFormat3ParsingStrategy } from "./parsing-strategies/data-format-3-parsing-strategy";
import { DataFormat5ParsingStrategy } from "./parsing-strategies/data-format-5-parsing-strategy";
import { DataFormat6ParsingStrategy } from "./parsing-strategies/data-format-6-parsing-strategy";

describe("RuuviTagParser", () => {
    const ruuviTagDataParsingStrategyMap: [string, RuuviTagParsingStrategy | RuuviAirParsingStrategy][] = [
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
                    const mockedParse = expectedParsingStrategy as Mock;

                    mockedParse.mockReturnValue("a");
                    const result = yield* parse(ruuviTagData);
                    expect(result).toBe("a");
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
});
