import { describe, expect, it } from "vitest";
import { InvalidOralBDataLengthError, parseOralBAdvertisement, toOralBSensorData } from "./oralb-parser.js";
import { ResolvedOralBModel } from "./oralb-sensor-data.js";
import { Cause, Effect, Exit, FastCheck as fc } from "effect";
import { asSeconds, asSectorNumber } from "../units.js";

const parse = (manufacturerData: Buffer, model?: ResolvedOralBModel) =>
    Effect.map(parseOralBAdvertisement(manufacturerData), ({ rawData, detectedModel }) =>
        toOralBSensorData(rawData, model ?? detectedModel)
    );

const parseOralBModel = (manufacturerData: Buffer) =>
    Effect.map(parseOralBAdvertisement(manufacturerData), ({ detectedModel }) => detectedModel);

describe("oralb-parser", () => {
    describe("parse", () => {
        it("should parse 9-byte advertisement and return sensor data", () => {
            const manufacturerData = Buffer.from([
                0xdc,
                0x00, // manufacturer ID (220) - 2 bytes
                0x08,
                0x36, // model bytes (IO Series 6/7) - bytes 0-1
                0x03, // gap/reserved? - byte 2
                0x02, // state: idle - byte 3
                0x00, // pressure: normal - byte 4
                0x00, // time minutes - byte 5
                0x00, // time seconds - byte 6
                0x01, // mode: 1 (sensitive for IO) - byte 7
                0x01, // sector: 1 - byte 8
            ]);

            const result = Effect.runSync(parse(manufacturerData));

            expect(result.state).toBe("idle");
            expect(result.pressure).toBe("normal");
            expect(result.brushingTimeSeconds).toBe(asSeconds(0));
            expect(result.brushingMode).toBe("sensitive");
            expect(result.sector).toBe("no_sector");
            expect(result.isBrushing).toBe(false);
            expect(result.sectorTimer).toBeUndefined();
            expect(result.numberOfSectors).toBeUndefined();
        });

        it("should keep mapped sector while running even when brushing time is zero", () => {
            const manufacturerData = Buffer.from([
                0xdc,
                0x00,
                0x08,
                0x36,
                0x03,
                0x03, // state: running
                0x00,
                0x00, // time minutes
                0x00, // time seconds
                0x01,
                0x01, // sector: 1
            ]);

            const result = Effect.runSync(parse(manufacturerData));

            expect(result.sector).toBe("sector_1");
        });

        it("should parse 11-byte advertisement with sector timer and number of sectors", () => {
            const manufacturerData = Buffer.from([
                0xdc,
                0x00, // manufacturer ID - 2 bytes
                0x06,
                0x32, // model bytes (IO Series 6/7) - bytes 0-1
                0x03, // gap/reserved? - byte 2
                0x03, // state: running - byte 3
                0x90, // pressure: high (144) - byte 4
                0x01, // time minutes: 1 - byte 5
                0x1e, // time seconds: 30 - byte 6
                0x00, // mode: 0 (daily_clean for IO) - byte 7
                0x02, // sector: 2 - byte 8
                0x0f, // sector timer: 15 - byte 9
                0x04, // number of sectors: 4 - byte 10
            ]);

            const result = Effect.runSync(parse(manufacturerData));

            expect(result.state).toBe("running");
            expect(result.pressure).toBe("high");
            expect(result.brushingTimeSeconds).toBe(asSeconds(90));
            expect(result.brushingMode).toBe("daily_clean");
            expect(result.sector).toBe("sector_2");
            expect(result.isBrushing).toBe(true);
            expect(result.sectorTimer).toBe(asSeconds(15));
            expect(result.numberOfSectors).toBe(asSectorNumber(4));
        });

        it("should use model override when provided", () => {
            const manufacturerData = Buffer.from([
                0xdc,
                0x00,
                0xff,
                0xff, // unknown model bytes
                0x03,
                0x02,
                0x00,
                0x00,
                0x00,
                0x01, // mode: 1
                0x01,
            ]);

            const result = Effect.runSync(parse(manufacturerData, "smart_series_4000"));

            // Smart Series mode 1 is "daily_clean"
            expect(result.brushingMode).toBe("daily_clean");
        });

        it("uses the unknown model for unknown model bytes without override", () => {
            const manufacturerData = Buffer.from([
                0xdc,
                0x00,
                0xff,
                0xff, // unknown model bytes
                0x03,
                0x03, // state: running
                0x90, // pressure: high
                0x01, // time minutes: 1
                0x1e, // time seconds: 30
                0x01, // mode: 1
                0x02, // sector: 2
            ]);

            const result = Effect.runSync(parse(manufacturerData));

            expect(result.state).toBe("running");
            expect(result.pressure).toBe("high");
            expect(result.brushingTimeSeconds).toBe(asSeconds(90));
            expect(result.sector).toBe("sector_2");
            expect(result.brushingMode).toBe("unknown_mode_1");
        });

        it("should handle unknown state values", () => {
            const manufacturerData = Buffer.from([
                0xdc,
                0x00,
                0x08,
                0x36,
                0x03,
                0xff, // unknown state: 255
                0x00,
                0x00,
                0x00,
                0x00,
                0x01,
            ]);

            const result = Effect.runSync(parse(manufacturerData));

            expect(result.state).toBe("unknown_state_255");
        });

        it("should handle unknown pressure values", () => {
            const manufacturerData = Buffer.from([
                0xdc,
                0x00,
                0x08,
                0x36,
                0x03,
                0x02,
                0x63, // unknown pressure: 99
                0x00,
                0x00,
                0x00,
                0x01,
            ]);

            const result = Effect.runSync(parse(manufacturerData));

            expect(result.pressure).toBe("unknown_pressure_99");
        });

        it("should handle unknown mode values", () => {
            const manufacturerData = Buffer.from([
                0xdc,
                0x00,
                0x08,
                0x36,
                0x03,
                0x02,
                0x00,
                0x00,
                0x00,
                0x63, // unknown mode: 99
                0x01,
            ]);

            const result = Effect.runSync(parse(manufacturerData));

            expect(result.brushingMode).toBe("unknown_mode_99");
        });

        it("should handle unknown sector values", () => {
            const manufacturerData = Buffer.from([
                0xdc,
                0x00,
                0x08,
                0x36,
                0x03,
                0x02,
                0x00,
                0x00,
                0x01,
                0x00,
                0x63, // unknown sector: 99
            ]);

            const result = Effect.runSync(parse(manufacturerData));

            expect(result.sector).toBe("unknown_sector_99");
        });

        it("should fail when manufacturer ID is not OralB", () => {
            const manufacturerData = Buffer.from([
                0xff,
                0x00, // wrong manufacturer ID
                0x08,
                0x36,
                0x03,
                0x02,
                0x00,
                0x00,
                0x00,
                0x01,
                0x01,
            ]);

            const result = Effect.runSyncExit(parse(manufacturerData));

            expect(result._tag).toBe("Failure");
            expect(result).toHaveProperty("cause");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const cause = (result as any).cause;
            expect(cause._tag).toBe("Fail");
            expect(cause.error._tag).toBe("NotValidOralBManufacturerIdError");
        });

        it.each([[[]], [[0xdc]]])(
            "fails with InvalidOralBDataLengthError instead of reading out of range: %j",
            (bytes: number[]) => {
                const manufacturerData = Buffer.from(bytes);

                expect(Effect.runSync(Effect.flip(parseOralBAdvertisement(manufacturerData)))).toStrictEqual(
                    new InvalidOralBDataLengthError({ length: bytes.length })
                );
            }
        );

        it("should fail when data length is invalid (not 9 or 11 bytes after manufacturer ID)", () => {
            const manufacturerData = Buffer.from([
                0xdc,
                0x00, // manufacturer ID
                0x08,
                0x36,
                0x03,
                0x02,
                0x00,
                0x00, // only 6 data bytes
            ]);

            const result = Effect.runSyncExit(parse(manufacturerData));

            expect(result._tag).toBe("Failure");
            expect(result).toHaveProperty("cause");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const cause = (result as any).cause;
            expect(cause._tag).toBe("Fail");
            expect(cause.error._tag).toBe("InvalidOralBDataLengthError");
        });
    });

    describe("parseOralBModel", () => {
        it("should resolve IO Series 6/7 from model bytes 0x08 0x36", () => {
            const manufacturerData = Buffer.from([
                0xdc,
                0x00,
                0x08,
                0x36, // IO Series 6/7
                0x03,
                0x02,
                0x00,
                0x00,
                0x00,
                0x00,
                0x01,
            ]);
            const result = Effect.runSync(parseOralBModel(manufacturerData));
            expect(result).toBe("io_series_6_7");
        });

        it("should resolve IO Series 6/7 from model bytes 0x06 0x32", () => {
            const manufacturerData = Buffer.from([
                0xdc,
                0x00,
                0x06,
                0x32, // IO Series 6/7
                0x03,
                0x02,
                0x00,
                0x00,
                0x00,
                0x00,
                0x01,
            ]);
            const result = Effect.runSync(parseOralBModel(manufacturerData));
            expect(result).toBe("io_series_6_7");
        });

        it("returns the unknown model for unknown model bytes", () => {
            const manufacturerData = Buffer.from([
                0xdc,
                0x00,
                0xff,
                0xff, // unknown model
                0x03,
                0x02,
                0x00,
                0x00,
                0x00,
                0x00,
                0x01,
            ]);
            const result = Effect.runSync(parseOralBModel(manufacturerData));

            expect(result).toBe("unknown");
        });
    });

    describe("properties", () => {
        const isDefect = (exit: Exit.Exit<unknown, unknown>): boolean =>
            Exit.isFailure(exit) && Cause.isDie(exit.cause);

        const oralbAdvertisement = (withSectorFields: boolean) =>
            fc
                .uint8Array({ minLength: withSectorFields ? 11 : 9, maxLength: withSectorFields ? 11 : 9 })
                .map((payload) => Buffer.from([0xdc, 0x00, ...payload]));

        it("never fails with a defect for arbitrary manufacturer data", () => {
            fc.assert(
                fc.property(fc.uint8Array({ maxLength: 20 }), (bytes) => {
                    expect(isDefect(Effect.runSyncExit(parseOralBAdvertisement(Buffer.from(bytes))))).toBe(false);
                })
            );
        });

        it("parses every Oral-B advertisement of a valid length", () => {
            fc.assert(
                fc.property(fc.boolean().chain(oralbAdvertisement), (data) => {
                    expect(Exit.isSuccess(Effect.runSyncExit(parseOralBAdvertisement(data)))).toBe(true);
                })
            );
        });

        it("derives brushing time, brushing state and sector fields from the raw bytes", () => {
            fc.assert(
                fc.property(fc.boolean().chain(oralbAdvertisement), (data) => {
                    const { rawData, detectedModel } = Effect.runSync(parseOralBAdvertisement(data));
                    const sensorData = toOralBSensorData(rawData, detectedModel);

                    expect(sensorData.brushingTimeSeconds).toBe(rawData.timeMinutes * 60 + rawData.timeSeconds);
                    expect(sensorData.isBrushing).toBe(rawData.state === 3);
                    expect(sensorData.sectorTimer !== undefined).toBe(data.length === 13);
                    expect(sensorData.numberOfSectors !== undefined).toBe(data.length === 13);
                })
            );
        });
    });
});
