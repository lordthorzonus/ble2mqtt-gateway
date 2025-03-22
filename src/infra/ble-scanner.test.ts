import { EventEmitter } from "events";
const mockNobleScanner = jest.fn();
const mockNobleStopScanning = jest.fn();
const mockRemoveAllListeners = jest.fn();
const mockNobleEventEmitter = new EventEmitter();
const mockNobleEventListener = jest
    .fn()
    .mockImplementation((eventName: string, callback: (event: string) => unknown) => {
        mockNobleEventEmitter.on(eventName, callback);
    });

jest.mock("@abandonware/noble", () => ({
    on: mockNobleEventListener,
    startScanning: mockNobleScanner,
    stopScanning: mockNobleStopScanning,
    removeAllListeners: mockRemoveAllListeners,
}));
import { Effect, Stream } from "effect";
import { scan, stopScanning } from "./ble-scanner";
import { TestContext } from "../test/test-context";

describe("BLE Scanner", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const peripheral = {
        advertisement: {
            manufacturerData: Buffer.from("99040512FC5394C37C0004FFFC040CAC364200CDCBB8334C884F", "hex"),
        },
        address: "aa:bb",
        rssi: 23,
        uuid: "aa:bb",
    };

    it("should register listeners to noble events when scan() is called", async () => {
        const stream = Stream.runCollect(Stream.take(scan(), 1));

        setTimeout(() => {
            mockNobleEventEmitter.emit("discover", peripheral);
        }, 100);

        await Effect.runPromise(Effect.provide(stream, TestContext));
        expect(mockNobleEventListener).toHaveBeenCalledWith("discover", expect.any(Function));
        expect(mockNobleEventListener).toHaveBeenCalledWith("stateChange", expect.any(Function));

        stopScanning();
        expect(mockNobleStopScanning).toHaveBeenCalledTimes(1);
        expect(mockRemoveAllListeners).toHaveBeenCalledTimes(1);
    });

    it("should call nobles start scanning when noble emits that it is ready to scan", async () => {
        const stream = Stream.runCollect(Stream.take(scan(), 1));

        setTimeout(() => {
            mockNobleEventEmitter.emit("stateChange", "poweredOn");
        }, 100);

        setTimeout(() => {
            mockNobleEventEmitter.emit("discover", peripheral);
        }, 100);

        await Effect.runPromise(Effect.provide(stream, TestContext));

        expect(mockNobleScanner).toHaveBeenCalledWith([], true);
    });

    it("should stream ble advertisements found", async () => {
        const stream = scan();

        setTimeout(() => {
            mockNobleEventEmitter.emit("discover", peripheral);
            mockNobleEventEmitter.emit("discover", peripheral);
        }, 100);

        const result = await Effect.runPromise(Effect.provide(Stream.runCollect(Stream.take(stream, 2)), TestContext));

        const advertisements = Array.from(result);
        expect(advertisements).toEqual([peripheral, peripheral]);
    }, 10000);
});
