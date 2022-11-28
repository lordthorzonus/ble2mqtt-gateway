import type { Peripheral } from "@abandonware/noble";
import type { Gateway } from "./ble-gateway";

class MockGateway implements Gateway {
    public readonly manufacturerId: number;

    public mockHandleBleAdvertisement = jest.fn();
    public mockObserveUnavailableDevices = jest.fn();

    constructor(manufacturerId: number) {
        this.manufacturerId = manufacturerId;
    }

    public getGatewayId(): number {
        return this.manufacturerId;
    }

    public handleBleAdvertisement(
        peripheral: Peripheral
    ): Observable<DeviceSensorMessage | DeviceAvailabilityMessage | null> {
        return this.mockHandleBleAdvertisement(peripheral);
    }

    public observeUnavailableDevices(): Observable<DeviceAvailabilityMessage> {
        return this.mockObserveUnavailableDevices();
    }
}

const mockRuuvitagGateway = new MockGateway(0x0499);
const mockMiFloraGateway = new MockGateway(0x95fe);
const mockMiFloraConstructor = jest.fn().mockImplementation(() => mockMiFloraGateway);
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
mockMiFloraConstructor.isMiFloraPeripheral = jest.fn().mockImplementation((peripheral: Peripheral) => {
    return peripheral.uuid === "miflora";
});

jest.mock("./ruuvitag/ruuvitag-gateway", () => {
    return {
        __esModule: true,
        RuuviTagGateway: jest.fn().mockImplementation(() => mockRuuvitagGateway),
    };
});

jest.mock("./miflora/miflora-gateway", () => {
    return {
        __esModule: true,
        MiFloraGateway: mockMiFloraConstructor,
    };
});
jest.mock("../infra/ble-scanner", () => ({
    __esModule: true,
    scan: jest.fn(),
}));

jest.mock("./analytics/gateway-analytics", () => {
    return {
        __esModule: true,
        GatewayAnalytics: mockGatewayAnalyticsConstructor,
    };
});

const mockGatewayAnalytics = {
    recordBluetoothAdvertisement: jest.fn(),
    recordDeviceMessage: jest.fn(),
    observeAnalytics: jest.fn(),
};
const mockGatewayAnalyticsConstructor = jest.fn().mockImplementation(() => mockGatewayAnalytics);

import { BleGateway } from "./ble-gateway";
import { EMPTY, from, Observable, take, toArray } from "rxjs";
import { DeviceAvailabilityMessage, DeviceSensorMessage, DeviceType, MessageType } from "../types";
import { Config } from "../config";
import { scan } from "../infra/ble-scanner";
import { TestScheduler } from "rxjs/testing";

const mockBleScanner = scan as jest.Mock;

describe("BLE Gateway", () => {
    const validGatewayConfiguration: Config["gateways"] = {
        base_topic: "something",
        ruuvitag: {
            allow_unknown: false,
            devices: [
                {
                    id: "aa:aa",
                    name: "fridge",
                },
            ],
            timeout: 10000,
        },
        miflora: {
            timeout: 10000,
            devices: [
                {
                    id: "bb",
                    name: "plant",
                },
            ],
        },
    };
    const ruuviPeripheral = {
        advertisement: {
            manufacturerData: Buffer.from("99040512FC5394C37C0004FFFC040CAC364200CDCBB8334C884F", "hex"),
        },
        address: "aa:aa",
        rssi: 23,
        uuid: "aa:aa",
    };

    const unknownPeripheral = {
        advertisement: {
            manufacturerData: Buffer.from("11110512FC5394C37C0004FFFC040CAC364200CDCBB8334C884F", "hex"),
        },
        address: "bbb:bbb",
        rssi: 23,
        uuid: "bbb:bbb",
    };

    const mifloraPeripheral = {
        uuid: "miflora",
        address: "bb:bb",
        rssi: 43,
        advertisement: {
            serviceData: [{ uuid: "fe95", data: Buffer.from("71209800a864aed0a8654c0d08100112", "hex") }],
        },
    } as unknown as Peripheral;

    const handledMessage = {
        type: MessageType.SensorData,
        device: {
            type: DeviceType.Ruuvitag,
        },
        payload: {
            a: "handled message",
        },
    };

    afterEach(() => {
        mockRuuvitagGateway.mockObserveUnavailableDevices.mockReset();
        mockRuuvitagGateway.mockHandleBleAdvertisement.mockReset();
        mockMiFloraGateway.mockObserveUnavailableDevices.mockReset();
        mockMiFloraGateway.mockHandleBleAdvertisement.mockReset();
        mockGatewayAnalytics.observeAnalytics.mockReset();
        mockGatewayAnalytics.recordDeviceMessage.mockReset();
        mockGatewayAnalytics.recordBluetoothAdvertisement.mockReset();
    });

    it("should use the correct gateway for ruuvitag and miflora ble advertisements", (done) => {
        const gateway = new BleGateway(validGatewayConfiguration);
        mockBleScanner.mockReturnValue(from([ruuviPeripheral, ruuviPeripheral, mifloraPeripheral]));
        mockRuuvitagGateway.mockObserveUnavailableDevices.mockReturnValue(EMPTY);
        mockRuuvitagGateway.mockHandleBleAdvertisement.mockReturnValue(from([handledMessage]));
        mockMiFloraGateway.mockObserveUnavailableDevices.mockReturnValue(EMPTY);
        mockMiFloraGateway.mockHandleBleAdvertisement.mockReturnValue(from([handledMessage]));
        mockGatewayAnalytics.observeAnalytics.mockReturnValue(EMPTY);

        gateway
            .observeEvents()
            .pipe(take(3), toArray())
            .subscribe((messages) => {
                expect(messages).toEqual([handledMessage, handledMessage, handledMessage]);
                expect(mockRuuvitagGateway.mockHandleBleAdvertisement).toHaveBeenCalledTimes(2);
                expect(mockRuuvitagGateway.mockHandleBleAdvertisement).toHaveBeenCalledWith(ruuviPeripheral);
                expect(mockMiFloraGateway.mockHandleBleAdvertisement).toHaveBeenCalledTimes(1);
                expect(mockMiFloraGateway.mockHandleBleAdvertisement).toHaveBeenCalledWith(mifloraPeripheral);
                expect(mockGatewayAnalytics.recordBluetoothAdvertisement).toHaveBeenCalledTimes(3);
                expect(mockGatewayAnalytics.recordDeviceMessage).toHaveBeenCalledTimes(3);

                done();
            });
    });

    it("should filter away unknown advertisements", (done) => {
        const gateway = new BleGateway(validGatewayConfiguration);
        mockBleScanner.mockReturnValue(
            from([ruuviPeripheral, unknownPeripheral, ruuviPeripheral, unknownPeripheral, unknownPeripheral])
        );
        mockRuuvitagGateway.mockObserveUnavailableDevices.mockReturnValue(EMPTY);
        mockMiFloraGateway.mockObserveUnavailableDevices.mockReturnValue(EMPTY);
        mockRuuvitagGateway.mockHandleBleAdvertisement.mockReturnValue(from([handledMessage]));
        mockGatewayAnalytics.observeAnalytics.mockReturnValue(EMPTY);

        gateway
            .observeEvents()
            .pipe(take(5), toArray())
            .subscribe((messages) => {
                expect(messages).toEqual([handledMessage, handledMessage]);
                expect(mockRuuvitagGateway.mockHandleBleAdvertisement).toHaveBeenCalledTimes(2);
                expect(mockRuuvitagGateway.mockHandleBleAdvertisement).toHaveBeenCalledWith(ruuviPeripheral);
                expect(mockGatewayAnalytics.recordBluetoothAdvertisement).toHaveBeenCalledTimes(5);
                expect(mockGatewayAnalytics.recordDeviceMessage).toHaveBeenCalledTimes(2);
                done();
            });
    });

    it("should also allow to observe unavailable device messages from gateways", (done) => {
        mockBleScanner.mockReturnValue(from([ruuviPeripheral, ruuviPeripheral]));
        mockRuuvitagGateway.mockObserveUnavailableDevices.mockReturnValue(from(["ruuvitag1", "ruuvitag2"]));
        mockMiFloraGateway.mockObserveUnavailableDevices.mockReturnValue(from(["miflora1", "miflora2"]));
        mockRuuvitagGateway.mockHandleBleAdvertisement.mockReturnValue(from([handledMessage]));
        mockGatewayAnalytics.observeAnalytics.mockReturnValue(from(["analytics1", "analytics2"]));

        const gateway = new BleGateway(validGatewayConfiguration);

        const testScheduler = new TestScheduler((actual, expected) => {
            expect(actual).toEqual(expected);
        });

        return testScheduler.run((helpers) => {
            helpers.expectObservable(gateway.observeEvents().pipe(take(8))).toBe("(abcdefgh|)", {
                a: handledMessage,
                b: handledMessage,
                c: "ruuvitag1",
                d: "ruuvitag2",
                e: "miflora1",
                f: "miflora2",
                g: expect.objectContaining({
                    payload: "analytics1",
                    type: "analytics",
                }),
                h: expect.objectContaining({
                    payload: "analytics2",
                    type: "analytics",
                }),
            });
            done();
        });
    });
});
