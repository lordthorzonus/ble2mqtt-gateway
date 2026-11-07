import { describe, expect, it } from "vitest";
import { Cause, Effect, Exit, FastCheck as fc, Option } from "effect";
import { InvalidRuuviDataLengthError, parse, RuuvitagSensorProtocolDataFormat } from "./index.js";

const RUUVI_MANUFACTURER_ID = [0x99, 0x04];

const MINIMUM_LENGTHS: [RuuvitagSensorProtocolDataFormat, number][] = [
    [RuuvitagSensorProtocolDataFormat.DataFormat3, 16],
    [RuuvitagSensorProtocolDataFormat.DataFormat5, 26],
    [RuuvitagSensorProtocolDataFormat.DataFormat6, 22],
    [RuuvitagSensorProtocolDataFormat.DataFormatE1, 42],
];

/** Zero-filled bodies for every length from the header up to just past the minimum, so the boundary is always tested. */
const lengthsAround = (headerLength: number, minimumLength: number): [Uint8Array][] =>
    Array.from({ length: minimumLength + 5 - headerLength }, (_, index) => [new Uint8Array(index)]);

const isDefect = (exit: Exit.Exit<unknown, unknown>): boolean => Exit.isFailure(exit) && Cause.isDie(exit.cause);

describe("RuuviTag parser properties", () => {
    it("never fails with a defect for arbitrary manufacturer data", () => {
        fc.assert(
            fc.property(fc.uint8Array({ maxLength: 64 }), (bytes) => {
                expect(isDefect(Effect.runSyncExit(parse(Buffer.from(bytes))))).toBe(false);
            })
        );
    });

    it("never fails with a defect for Ruuvi headers followed by arbitrary data", () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...MINIMUM_LENGTHS.map(([dataFormat]) => dataFormat)),
                fc.uint8Array({ maxLength: 64 }),
                (dataFormat, body) => {
                    const data = Buffer.from([...RUUVI_MANUFACTURER_ID, dataFormat, ...body]);

                    expect(isDefect(Effect.runSyncExit(parse(data)))).toBe(false);
                }
            )
        );
    });

    it.each(MINIMUM_LENGTHS)(
        "fails with InvalidRuuviDataLengthError exactly when data format %s is shorter than %s bytes",
        (dataFormat, minimumLength) => {
            const header = [...RUUVI_MANUFACTURER_ID, dataFormat];

            fc.assert(
                fc.property(
                    fc
                        .integer({ min: header.length, max: minimumLength + 4 })
                        .chain((length) =>
                            fc.uint8Array({ minLength: length - header.length, maxLength: length - header.length })
                        ),
                    (body) => {
                        const data = Buffer.from([...header, ...body]);
                        const exit = Effect.runSyncExit(parse(data));
                        const isLengthError =
                            Exit.isFailure(exit) &&
                            Cause.failureOption(exit.cause).pipe(
                                Option.exists((error) => error instanceof InvalidRuuviDataLengthError)
                            );

                        expect(isDefect(exit)).toBe(false);
                        expect(isLengthError).toBe(data.length < minimumLength);
                    }
                ),
                { examples: lengthsAround(header.length, minimumLength) }
            );
        }
    );
});
