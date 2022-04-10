import type { Peripheral } from "@abandonware/noble";
import type { Gateway } from "./ble-gateway";

class MockGateway implements Gateway {
    private readonly manufacturerId: number;

    public mockHandleBleAdvertisement = jest.fn();
    public mockObserveUnavailableDevices = jest.fn();

    constructor(manufacturerId: number) {
        this.manufacturerId = manufacturerId;
    }

    public getManufacturerId(): number {
        return this.manufacturerId;
    }

    public handleBleAdvertisement(
        peripheral: Peripheral
    ): Observable<DeviceMessage | DeviceAvailabilityMessage | null> {
        return this.mockHandleBleAdvertisement(peripheral);
    }

    public observeUnavailableDevices(): Observable<DeviceAvailabilityMessage> {
        return this.mockObserveUnavailableDevices();
    }
}

const mockRuuvitagGateway = new MockGateway(0x0499);

jest.mock("./ruuvitag/ruuvitag-gateway", () => {
    return {
        __esModule: true,
        RuuviTagGateway: jest.fn().mockImplementation(() => mockRuuvitagGateway),
    };
});
jest.mock("../infra/ble-scanner", () => ({
    __esModule: true,
    scan: jest.fn(),
}));
import { BleGateway } from "./ble-gateway";
import { EMPTY, from, Observable, take, toArray } from "rxjs";
import { DeviceAvailabilityMessage, DeviceMessage } from "../types";
import { Config } from "../config";
import { scan } from "../infra/ble-scanner";

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

    const handledMessage = "handled message";

    it("should use the correct gateway for ruuvitag ble advertisements", (done) => {
        const gateway = new BleGateway(validGatewayConfiguration);
        mockBleScanner.mockReturnValue(from([ruuviPeripheral, ruuviPeripheral]));
        mockRuuvitagGateway.mockObserveUnavailableDevices.mockReturnValue(EMPTY);
        mockRuuvitagGateway.mockHandleBleAdvertisement.mockReturnValue(from([handledMessage]));

        gateway
            .observeEvents()
            .pipe(take(2), toArray())
            .subscribe((messages) => {
                expect(messages).toEqual([handledMessage, handledMessage]);
                expect(mockRuuvitagGateway.mockHandleBleAdvertisement).toHaveBeenCalledTimes(2);
                expect(mockRuuvitagGateway.mockHandleBleAdvertisement).toHaveBeenCalledWith(ruuviPeripheral);
                done();
            });
    });

    it("should filter away unknown advertisements", (done) => {
        const gateway = new BleGateway(validGatewayConfiguration);
        mockBleScanner.mockReturnValue(
            from([ruuviPeripheral, unknownPeripheral, ruuviPeripheral, unknownPeripheral, unknownPeripheral])
        );
        mockRuuvitagGateway.mockObserveUnavailableDevices.mockReturnValue(EMPTY);
        mockRuuvitagGateway.mockHandleBleAdvertisement.mockReturnValue(from([handledMessage]));

        gateway
            .observeEvents()
            .pipe(take(5), toArray())
            .subscribe((messages) => {
                expect(messages).toEqual([handledMessage, handledMessage]);
                expect(mockRuuvitagGateway.mockHandleBleAdvertisement).toHaveBeenCalledTimes(2);
                expect(mockRuuvitagGateway.mockHandleBleAdvertisement).toHaveBeenCalledWith(ruuviPeripheral);
                done();
            });
    });

    it("should also allow to observe unavailable device messages from gateways", (done) => {
        const gateway = new BleGateway(validGatewayConfiguration);
        const unavailableDeviceMessages = ["a", "b"];

        mockBleScanner.mockReturnValue(from([ruuviPeripheral, ruuviPeripheral]));
        mockRuuvitagGateway.mockObserveUnavailableDevices.mockReturnValue(from(unavailableDeviceMessages));
        mockRuuvitagGateway.mockHandleBleAdvertisement.mockReturnValue(from([handledMessage]));

        gateway
            .observeEvents()
            .pipe(take(4), toArray())
            .subscribe((messages) => {
                expect(messages).toEqual([handledMessage, handledMessage, ...unavailableDeviceMessages]);
                expect(mockRuuvitagGateway.mockObserveUnavailableDevices).toHaveBeenCalledTimes(1);
                done();
            });
    });
});
