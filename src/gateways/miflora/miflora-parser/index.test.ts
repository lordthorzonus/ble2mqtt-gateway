import {
    MifloraMeasurementEventType,
    parseMiFloraPeripheralAdvertisement,
    SupportedMiFloraMeasurements,
    InvalidMiFloraAdvertisementError,
    UnsupportedMiFloraEventError,
} from "./index";
import { Peripheral } from "../../../infra/ble-scanner";
import { Effect } from "effect";
import { testEffectWithContext } from "../../../test/test-context";

export const getStubPeripheralWithServiceData = (serviceData: string, id = "a"): Peripheral => {
    return {
        uuid: id,
        address: "aa:bb",
        rssi: 43,
        advertisement: {
            serviceData: [{ uuid: "fe95", data: Buffer.from(serviceData, "hex") }],
        },
    } as unknown as Peripheral;
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
});
