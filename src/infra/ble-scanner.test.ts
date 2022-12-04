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

import { scan } from "./ble-scanner";
import { take, toArray } from "rxjs";

describe("BLE Scanner", () => {
    const peripheral = {
        advertisement: {
            manufacturerData: Buffer.from("99040512FC5394C37C0004FFFC040CAC364200CDCBB8334C884F", "hex"),
        },
        address: "aa:bb",
        rssi: 23,
        uuid: "aa:bb",
    };

    it("should register listeners to noble events when scan() is called", () => {
        const observable = scan();
        const subscription = observable.subscribe();
        expect(mockNobleEventListener).toHaveBeenCalledWith("discover", expect.any(Function));
        expect(mockNobleEventListener).toHaveBeenCalledWith("stateChange", expect.any(Function));
        subscription.unsubscribe();
        expect(mockNobleStopScanning).toHaveBeenCalledTimes(1);
        expect(mockRemoveAllListeners).toHaveBeenCalledTimes(1);
    });

    it("should call nobles start scanning when noble emits that it is ready to scan", () => {
        scan();
        mockNobleEventEmitter.emit("stateChange", "poweredOn");
        expect(mockNobleScanner).toHaveBeenCalledWith([], true);
    });

    it("should stream ble advertisements found", (done) => {
        const observable = scan();
        observable.pipe(take(2), toArray()).subscribe((advertisements) => {
            expect(advertisements).toEqual([peripheral, peripheral]);
            done();
        });

        mockNobleEventEmitter.emit("discover", peripheral);
        mockNobleEventEmitter.emit("discover", peripheral);
    });
});
