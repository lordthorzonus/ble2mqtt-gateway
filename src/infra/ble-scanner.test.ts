import { EventEmitter } from "events";

const mockNobleEventEmitter = new EventEmitter();
const mockWaitForPoweredOn = jest.fn();
const mockStartScanning = jest.fn();
const mockStopScanning = jest.fn();

const mockNoble = {
    waitForPoweredOnAsync: () => mockWaitForPoweredOn(),
    startScanningAsync: (...args: unknown[]) => mockStartScanning(...args),
    stopScanningAsync: () => mockStopScanning(),
    on: (eventName: string, callback: (event: unknown) => unknown) => {
        mockNobleEventEmitter.on(eventName, callback);
    },
};

jest.mock("@stoprocent/noble", () => ({
    __esModule: true,
    default: mockNoble,
}));

import { Effect, Stream } from "effect";
import { scan } from "./ble-scanner";
import { TestContext } from "../test/test-context";

describe("BLE Scanner", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockWaitForPoweredOn.mockResolvedValue(undefined);
        mockStartScanning.mockResolvedValue(undefined);
        mockStopScanning.mockResolvedValue(undefined);
    });

    const peripheral = {
        advertisement: {
            manufacturerData: Buffer.from("99040512FC5394C37C0004FFFC040CAC364200CDCBB8334C884F", "hex"),
            serviceData: [],
        },
        address: "aa:bb",
        rssi: 23,
        uuid: "aa:bb",
    };

    it("should wait for noble to power on and start scanning", async () => {
        const stream = Stream.runCollect(Stream.take(scan(), 1));

        setTimeout(() => {
            mockNobleEventEmitter.emit("discover", peripheral);
        }, 10);

        await Effect.runPromise(Effect.provide(stream, TestContext));

        expect(mockWaitForPoweredOn).toHaveBeenCalledTimes(1);
        expect(mockStartScanning).toHaveBeenCalledWith([], true);
    });

    it("should stream ble advertisements found", async () => {
        const stream = scan();

        setTimeout(() => {
            mockNobleEventEmitter.emit("discover", peripheral);
            mockNobleEventEmitter.emit("discover", peripheral);
        }, 10);

        const result = await Effect.runPromise(Effect.provide(Stream.runCollect(Stream.take(stream, 2)), TestContext));

        const advertisements = Array.from(result);
        expect(advertisements).toEqual([peripheral, peripheral]);
    });

    it("should call stopScanning when stream is finalized", async () => {
        const stream = scan();

        setTimeout(() => {
            mockNobleEventEmitter.emit("discover", peripheral);
        }, 10);

        await Effect.runPromise(Effect.provide(Stream.runCollect(Stream.take(stream, 1)), TestContext));

        expect(mockStopScanning).toHaveBeenCalledTimes(1);
    });
});
