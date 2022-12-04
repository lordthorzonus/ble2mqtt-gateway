import {
    MifloraMeasurementEventType,
    parseMiFloraPeripheralAdvertisement,
    SupportedMiFloraMeasurements,
} from "./index";
import { Peripheral } from "@abandonware/noble";

jest.mock("../../../infra/logger", () => ({
    __esModule: true,
    logger: {
        warn: jest.fn(),
    },
}));

export const getStubPeripheral = (serviceData: string, id = "a"): Peripheral => {
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
            getStubPeripheral("71209800a864aed0a8654c0d08100112"),
            { measurementType: MifloraMeasurementEventType.Moisture, data: 18 },
        ],
        [
            getStubPeripheral("71209800b1cf076e8d7cc40d091002c600"),
            { measurementType: MifloraMeasurementEventType.SoilConductivity, data: 198 },
        ],
        [
            getStubPeripheral("71209800239c066e8d7cc40d0410020401"),
            { measurementType: MifloraMeasurementEventType.Temperature, data: 26 },
        ],
        [
            getStubPeripheral("71209800c3cf076e8d7cc40d071003370000"),
            { measurementType: MifloraMeasurementEventType.Illuminance, data: 55 },
        ],
        [getStubPeripheral("0000"), { measurementType: MifloraMeasurementEventType.InvalidEvent, data: 0 }],
    ];

    it.each(testCases)("should parse %j service data with correct strategy", (peripheral, expectedResult) => {
        expect(parseMiFloraPeripheralAdvertisement(peripheral)).toEqual(expectedResult);
    });

    it("should throw an error if a invalid peripheral is given", () => {
        const properPeripheral = getStubPeripheral("");
        const peripheral = {
            ...properPeripheral,
            advertisement: { ...properPeripheral.advertisement, serviceData: [] },
        } as unknown as Peripheral;

        expect(() => parseMiFloraPeripheralAdvertisement(peripheral)).toThrow(
            'Not a valid MiFlora device advertisement. Could not find a service with uuid: "fe95"'
        );
    });

    it("should throw an error if unknown xiaomi service data event is given", () => {
        const peripheral = getStubPeripheral("5020aa01b064aed0a8654c0d1004d9006001");
        expect(() => parseMiFloraPeripheralAdvertisement(peripheral)).toThrow("Unsupported MiFlora event got: 1040");
    });
});
