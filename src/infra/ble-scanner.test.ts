import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Peripheral } from "./ble-scanner.js";

// Vitest moves vi.mock factories above the imports, so vi.hoisted has to create the mock state too.
const { mockNobleEventEmitter, mockWaitForPoweredOn, mockStartScanning, mockStopScanning, mockNoble } =
    await vi.hoisted(async () => {
        const { EventEmitter } = await import("node:events");
        const mockNobleEventEmitter = new EventEmitter();
        const mockWaitForPoweredOn = vi.fn();
        const mockStartScanning = vi.fn();
        const mockStopScanning = vi.fn();

        const mockNoble = {
            waitForPoweredOnAsync: () => mockWaitForPoweredOn(),
            startScanningAsync: (...args: unknown[]) => mockStartScanning(...args),
            stopScanningAsync: () => mockStopScanning(),
            on: (eventName: string, callback: (peripheral: Peripheral) => void) => {
                mockNobleEventEmitter.on(eventName, callback);
            },
            removeListener: (eventName: string, callback: (peripheral: Peripheral) => void) => {
                mockNobleEventEmitter.removeListener(eventName, callback);
            },
        };

        return { mockNobleEventEmitter, mockWaitForPoweredOn, mockStartScanning, mockStopScanning, mockNoble };
    });

vi.mock("@stoprocent/noble", () => ({
    default: mockNoble,
}));

import { Effect, Stream } from "effect";
import { scan } from "./ble-scanner.js";
import { TestContext } from "../test/test-context.js";

describe("BLE Scanner", () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
        const stream = Stream.runCollect(Stream.take(scan, 1));

        setTimeout(() => {
            mockNobleEventEmitter.emit("discover", peripheral);
        }, 10);

        await Effect.runPromise(Effect.provide(stream, TestContext));

        expect(mockWaitForPoweredOn).toHaveBeenCalledTimes(1);
        expect(mockStartScanning).toHaveBeenCalledWith([], true);
    });

    it("should stream ble advertisements found", async () => {
        const stream = scan;

        setTimeout(() => {
            mockNobleEventEmitter.emit("discover", peripheral);
            mockNobleEventEmitter.emit("discover", peripheral);
        }, 10);

        const result = await Effect.runPromise(Effect.provide(Stream.runCollect(Stream.take(stream, 2)), TestContext));

        const advertisements = Array.from(result);
        expect(advertisements).toEqual([peripheral, peripheral]);
    });

    it("should call stopScanning when stream is finalized", async () => {
        const stream = scan;

        setTimeout(() => {
            mockNobleEventEmitter.emit("discover", peripheral);
        }, 10);

        await Effect.runPromise(Effect.provide(Stream.runCollect(Stream.take(stream, 1)), TestContext));

        expect(mockStopScanning).toHaveBeenCalledTimes(1);
    });
});
