import { describe, expect, it } from "vitest";
import {
    MifloraMeasurementEventType,
    parseMiFloraPeripheralAdvertisement,
    SupportedMiFloraMeasurements,
    InvalidMiFloraAdvertisementError,
    UnsupportedMiFloraEventError,
    InvalidMiFloraDataLengthError,
} from "./index.js";
import { Peripheral } from "../../../infra/ble-scanner.js";
import { Cause, Effect, Exit, FastCheck as fc, Option } from "effect";
import { testEffectWithContext } from "../../../test/test-context.js";

export const getStubPeripheralWithServiceData = (serviceData: string, id = "a"): Peripheral => {
    return {
        uuid: id,
        address: "aa:bb",
        rssi: 43,
        advertisement: {
            serviceData: [{ uuid: "fe95", data: Buffer.from(serviceData, "hex") }],
        },
    };
};

describe("parseMiFloraPeripheralAdvertisement()", () => {
    const testCases: [Peripheral, SupportedMiFloraMeasurements][] = [
        [
            getStubPeripheralWithServiceData("71209800a864aed0a8654c0d08100112"),
            { measurementType: MifloraMeasurementEventType.Moisture, data: 18 },
        ],
        [
            getStubPeripheralWithServiceData("71209800b1cf076e8d7cc40d091002c600"),
            { measurementType: MifloraMeasurementEventType.SoilConductivity, data: 198 },
        ],
        [
            getStubPeripheralWithServiceData("71209800239c066e8d7cc40d0410020401"),
            { measurementType: MifloraMeasurementEventType.Temperature, data: 26 },
        ],
        [
            getStubPeripheralWithServiceData("71209800c3cf076e8d7cc40d071003370000"),
            { measurementType: MifloraMeasurementEventType.Illuminance, data: 55 },
        ],
        [
            getStubPeripheralWithServiceData("7120980000a54db07e855c0d"),
            { measurementType: MifloraMeasurementEventType.LowBatteryEvent, data: 1 },
        ],
        [
            getStubPeripheralWithServiceData("0000"),
            { measurementType: MifloraMeasurementEventType.InvalidEvent, data: 0 },
        ],
    ];

    it.each(testCases)(
        "should parse %j service data with correct strategy",
        (peripheral: Peripheral, expectedResult: SupportedMiFloraMeasurements) => {
            return Effect.runPromise(
                testEffectWithContext(
                    Effect.gen(function* () {
                        const result = yield* parseMiFloraPeripheralAdvertisement(peripheral);
                        expect(result).toEqual(expectedResult);
                    })
                )
            );
        }
    );

    it("should throw an error if a invalid peripheral is given", () => {
        return Effect.runPromise(
            testEffectWithContext(
                Effect.gen(function* () {
                    const properPeripheral = getStubPeripheralWithServiceData("");
                    const peripheral = {
                        ...properPeripheral,
                        advertisement: { ...properPeripheral.advertisement, serviceData: [] },
                    } as unknown as Peripheral;

                    const result = yield* Effect.flip(parseMiFloraPeripheralAdvertisement(peripheral));
                    expect(result).toStrictEqual(new InvalidMiFloraAdvertisementError({ peripheral }));
                })
            )
        );
    });

    it("should throw an error if unknown xiaomi service data event is given", () => {
        return Effect.runPromise(
            testEffectWithContext(
                Effect.gen(function* () {
                    const peripheral = getStubPeripheralWithServiceData("5020aa01b064aed0a8654c0d1004d9006001");
                    const result = yield* Effect.flip(parseMiFloraPeripheralAdvertisement(peripheral));
                    expect(result).toStrictEqual(new UnsupportedMiFloraEventError({ eventType: 1040 }));
                })
            )
        );
    });

    const truncatedEvents: [string, MifloraMeasurementEventType, number][] = [
        ["71209800a864aed0a8654c0d0810", MifloraMeasurementEventType.Moisture, 16],
        ["71209800b1cf076e8d7cc40d091002c6", MifloraMeasurementEventType.SoilConductivity, 17],
        ["71209800239c066e8d7cc40d04100204", MifloraMeasurementEventType.Temperature, 17],
        ["71209800c3cf076e8d7cc40d0710033700", MifloraMeasurementEventType.Illuminance, 18],
    ];

    it.each(truncatedEvents)(
        "fails with InvalidMiFloraDataLengthError for truncated event data: %s",
        (serviceData, eventType, minimumLength) =>
            Effect.runPromise(
                Effect.gen(function* () {
                    const peripheral = getStubPeripheralWithServiceData(serviceData);
                    const result = yield* Effect.flip(parseMiFloraPeripheralAdvertisement(peripheral));
                    expect(result).toStrictEqual(
                        new InvalidMiFloraDataLengthError({
                            eventType,
                            length: serviceData.length / 2,
                            minimumLength,
                        })
                    );
                })
            )
    );

    describe("properties", () => {
        const isDefect = (exit: Exit.Exit<unknown, unknown>): boolean =>
            Exit.isFailure(exit) && Cause.isDie(exit.cause);

        const parseServiceData = (data: Uint8Array) =>
            Effect.runSyncExit(
                parseMiFloraPeripheralAdvertisement(getStubPeripheralWithServiceData(Buffer.from(data).toString("hex")))
            );

        it("never fails with a defect for arbitrary service data", () => {
            fc.assert(
                fc.property(fc.uint8Array({ maxLength: 40 }), (data) => {
                    expect(isDefect(parseServiceData(data))).toBe(false);
                })
            );
        });

        const minimumLengths: [MifloraMeasurementEventType, number][] = [
            [MifloraMeasurementEventType.Temperature, 17],
            [MifloraMeasurementEventType.SoilConductivity, 17],
            [MifloraMeasurementEventType.Moisture, 16],
            [MifloraMeasurementEventType.Illuminance, 18],
        ];

        it.each(minimumLengths)(
            "fails with InvalidMiFloraDataLengthError exactly when event %s is shorter than %s bytes",
            (eventType, minimumLength) => {
                const eventTypeBytes = [eventType & 0xff, eventType >> 8];

                fc.assert(
                    fc.property(
                        fc.uint8Array({ minLength: 12, maxLength: 12 }),
                        fc
                            .integer({ min: 0, max: 6 })
                            .chain((length) => fc.uint8Array({ minLength: length, maxLength: length })),
                        (prefix, tail) => {
                            const data = Buffer.concat([prefix, Buffer.from(eventTypeBytes), tail]);
                            const exit = parseServiceData(data);
                            const isLengthError =
                                Exit.isFailure(exit) &&
                                Cause.failureOption(exit.cause).pipe(
                                    Option.exists((error) => error instanceof InvalidMiFloraDataLengthError)
                                );

                            expect(isDefect(exit)).toBe(false);
                            expect(isLengthError).toBe(data.length < minimumLength);
                        }
                    ),
                    {
                        examples: Array.from({ length: 7 }, (_, length): [Uint8Array, Uint8Array] => [
                            new Uint8Array(12),
                            new Uint8Array(length),
                        ]),
                    }
                );
            }
        );
    });
});
