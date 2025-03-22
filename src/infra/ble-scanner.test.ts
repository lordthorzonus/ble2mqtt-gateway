jest.mock("./logger", () => ({
    __esModule: true,
    logger: {
        info: jest.fn(),
        debug: jest.fn(),
    },
}));

import { EventEmitter } from "events";
const mockNobleEventEmitter = new EventEmitter();
const mockNobleEventListener = jest
    .fn()
    .mockImplementation((eventName: string, callback: (event: string) => unknown) => {
        mockNobleEventEmitter.on(eventName, callback);
    });
const mockNobleScanner = jest.fn();
const mockNobleStopScanning = jest.fn();
const mockRemoveAllListeners = jest.fn();

jest.mock("@abandonware/noble", () => ({
    on: mockNobleEventListener,
    startScanning: mockNobleScanner,
    stopScanning: mockNobleStopScanning,
    removeAllListeners: mockRemoveAllListeners,
}));

import { scan, stopScanning } from "./ble-scanner";
import { Effect, Stream, pipe } from "effect";

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

        await Effect.runPromise(stream);
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

        await Effect.runPromise(stream);

        expect(mockNobleScanner).toHaveBeenCalledWith([], true);
    });

    it("should stream ble advertisements found", async () => {
        const stream = scan();

        setTimeout(() => {
            mockNobleEventEmitter.emit("discover", peripheral);
            mockNobleEventEmitter.emit("discover", peripheral);
        }, 100);

        const result = await Effect.runPromise(pipe(stream, Stream.take(2), Stream.runCollect));

        const advertisements = Array.from(result);
        expect(advertisements).toEqual([peripheral, peripheral]);
    }, 10000);
});
