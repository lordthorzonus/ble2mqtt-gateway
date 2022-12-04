import Mock = jest.Mock;

jest.mock("./parsing-strategies/data-format-3-parsing-strategy");
jest.mock("./parsing-strategies/data-format-5-parsing-strategy");

import parse, { RuuviTagParsingStrategy } from "./index";
import DataFormat3ParsingStrategy from "./parsing-strategies/data-format-3-parsing-strategy";
import DataFormat5ParsingStrategy from "./parsing-strategies/data-format-5-parsing-strategy";

describe("RuuviTagParser", () => {
    const ruuviTagDataParsingStrategyMap: [string, RuuviTagParsingStrategy][] = [
        ["990403291A1ECE1EFC18F94202CA0B53", DataFormat3ParsingStrategy],
        ["9904058001000000008001800180010000000000CBB8334C884F", DataFormat5ParsingStrategy],
    ];

    it.each(ruuviTagDataParsingStrategyMap)(
        "should use the correct strategy for the correct data format, raw data: %s",
        (rawStringData, expectedParsingStrategy) => {
            const ruuviTagData = Buffer.from(rawStringData, "hex");
            const mockedParse = expectedParsingStrategy.parse as Mock;

            mockedParse.mockReturnValue("a");
            expect(parse(ruuviTagData)).toBe("a");
            expect(mockedParse).toHaveBeenCalledWith(ruuviTagData);
        }
    );

    it("should throw an error if the data given does not have corresponding data parsing strategy", () => {
        const ruuviTagData = Buffer.from("990406291A1ECE1EFC18F94202CA0B53", "hex");

        expect(() => parse(ruuviTagData)).toThrow(
            new Error("Unsupported data format, got a payload containing data format: 6")
        );
    });
    it("should throw an error if the data given is not valid ruuvi tag data", () => {
        const ruuviTagData = Buffer.from("048806291A1ECE1EFC18F94202CA0B53", "hex");

        expect(() => parse(ruuviTagData)).toThrow(
            new Error("Not a valid RuuviTag payload. Got manufacturerId: 0x8804, expected: 0x0499")
        );
    });
});
