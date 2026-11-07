import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Peripheral } from "../infra/ble-scanner.js";
import { DeviceType, MessageType } from "../types.js";
import { Config, GlobalConfiguration } from "../config.js";
import { Effect, Layer, Stream } from "effect";
import { DateTime } from "luxon";

const mockRuuvitagMapMessageFn = vi.fn();
const mockMiFloraMapMessageFn = vi.fn();
const mockRuuviUnavailableDevices = vi.fn();
const mockMiFloraUnavailableDevices = vi.fn();
const mockRuuviRegisterDeviceStatusPublished = vi.fn();
const mockMiFloraRegisterDeviceStatusPublished = vi.fn();

vi.mock("./ruuvitag/ruuvitag-gateway.js", () => ({
    __esModule: true,
    makeRuuvitagGateway: vi.fn().mockImplementation(() => mockRuuvitagMapMessageFn),
    makeRuuvitagDeviceRegistry: vi.fn().mockImplementation(() => ({
        getUnavailableDevices: mockRuuviUnavailableDevices,
        registerDeviceStatusPublished: mockRuuviRegisterDeviceStatusPublished,
    })),
    ruuviTagManufacturerId: 0x0499,
}));

vi.mock("./miflora/miflora-gateway.js", () => ({
    __esModule: true,
    makeMiFloraGateway: vi.fn().mockImplementation(() => mockMiFloraMapMessageFn),
    makeMiFloraDeviceRegistry: vi.fn().mockImplementation(() => ({
        getUnavailableDevices: mockMiFloraUnavailableDevices,
        registerDeviceStatusPublished: mockMiFloraRegisterDeviceStatusPublished,
    })),
    mifloraGatewayId: 0x95fe,
    isMiFloraPeripheral: vi.fn().mockImplementation((peripheral) => peripheral.uuid === "miflora"),
}));

import { makeBleGateway } from "./ble-gateway.js";
import { makeRuuvitagGateway, makeRuuvitagDeviceRegistry } from "./ruuvitag/ruuvitag-gateway.js";
import { makeMiFloraGateway, makeMiFloraDeviceRegistry } from "./miflora/miflora-gateway.js";
import { Logger } from "../infra/logger.js";
import { mockLogger } from "../test/test-context.js";

describe("BLE Gateway", () => {
    const validGatewayConfiguration: GlobalConfiguration["gateways"] = {
        base_topic: "something",
        ruuvitag: {
            allow_unknown: false,
            devices: [
                {
                    id: "aa:aa",
                    name: "fridge",
                    model: "environmental",
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
            serviceData: [],
        },
        address: "aa:aa",
        rssi: 23,
        uuid: "aa:aa",
    } as unknown as Peripheral;

    const unknownPeripheral = {
        advertisement: {
            manufacturerData: Buffer.from("11110512FC5394C37C0004FFFC040CAC364200CDCBB8334C884F", "hex"),
            serviceData: [],
        },
        address: "bbb:bbb",
        rssi: 23,
        uuid: "bbb:bbb",
    } as unknown as Peripheral;

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

    const ruuviTag1UnavailableMessage = {
        type: MessageType.Availability,
        device: {
            friendlyName: "fridge",
            id: "aa:aa",
            macAddress: "aa:aa",
            type: DeviceType.Ruuvitag,
            rssi: null,
            timeout: undefined,
        },
        payload: {
            state: "offline",
        },
    };

    const ruuviTag2UnavailableMessage = {
        type: MessageType.Availability,
        device: {
            friendlyName: "storage",
            id: "bb:bb",
            macAddress: "bb:bb",
            rssi: null,
            timeout: undefined,
            type: DeviceType.Ruuvitag,
        },
        payload: {
            state: "offline",
        },
    };

    const miFlora1UnavailableMessage = {
        type: MessageType.Availability,
        device: {
            friendlyName: "plant",
            id: "bb",
            macAddress: "bb",
            rssi: null,
            timeout: undefined,
            type: DeviceType.MiFlora,
        },
        payload: {
            state: "offline",
        },
    };

    const miFlora2UnavailableMessage = {
        type: MessageType.Availability,
        device: {
            friendlyName: "plant2",
            id: "cc",
            macAddress: "cc",
            rssi: null,
            timeout: undefined,
            type: DeviceType.MiFlora,
        },
        payload: {
            state: "offline",
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    const TestLayer = Layer.mergeAll(
        Layer.succeed(Logger, Logger.of(mockLogger)),
        Layer.succeed(
            Config,
            Config.of({
                gateways: validGatewayConfiguration,
                homeassistant: {
                    discovery_topic: "test",
                },
                log_level: "debug",
                decimal_precision: 2,
                gateway_name: "test",
                unavailable_devices_check_interval_ms: 1000,
                gateway_version: "1.0.0",
                concurrency: {
                    mqtt_message_production: "unbounded",
                    mqtt_publishing: "unbounded",
                },
                mqtt: {
                    host: "test",
                    port: 1883,
                    username: "test",
                    password: "test",
                    client_id: "test",
                    protocol: "mqtt",
                },
            })
        )
    );

    const collectDeviceMessages = (peripherals: Peripheral[], takeCount: number) =>
        Effect.gen(function* () {
            const bleGateway = yield* makeBleGateway();
            const eventStream = bleGateway.deviceMessages(Stream.fromIterable(peripherals));

            return yield* Stream.runCollect(Stream.take(eventStream, takeCount));
        });

    it("uses the correct gateway for ruuvitag and miflora ble advertisements", async () => {
        mockRuuviUnavailableDevices.mockReturnValue([]);
        mockMiFloraUnavailableDevices.mockReturnValue([]);

        mockRuuvitagMapMessageFn.mockReturnValue(Effect.succeed([handledMessage]));
        mockMiFloraMapMessageFn.mockReturnValue(Effect.succeed([handledMessage]));

        const messages = Array.from(
            await Effect.runPromise(
                Effect.provide(
                    collectDeviceMessages([ruuviPeripheral, ruuviPeripheral, mifloraPeripheral], 3),
                    TestLayer
                )
            )
        );

        expect(messages).toEqual([handledMessage, handledMessage, handledMessage]);
        expect(mockRuuvitagMapMessageFn).toHaveBeenCalledTimes(2);
        expect(mockRuuvitagMapMessageFn).toHaveBeenCalledWith(ruuviPeripheral);
        expect(mockMiFloraMapMessageFn).toHaveBeenCalledTimes(1);
        expect(mockMiFloraMapMessageFn).toHaveBeenCalledWith(mifloraPeripheral);
        expect(makeRuuvitagGateway).toHaveBeenCalledWith(validGatewayConfiguration.ruuvitag);
        expect(makeRuuvitagDeviceRegistry).toHaveBeenCalledWith(
            validGatewayConfiguration.ruuvitag,
            expect.objectContaining({ defaultDecimalPrecision: expect.any(Number) })
        );
        expect(makeMiFloraGateway).toHaveBeenCalledWith(validGatewayConfiguration.miflora);
        expect(makeMiFloraDeviceRegistry).toHaveBeenCalledWith(
            validGatewayConfiguration.miflora,
            expect.objectContaining({ defaultDecimalPrecision: expect.any(Number) })
        );
    });

    it("filters away unknown advertisements", async () => {
        mockRuuviUnavailableDevices.mockReturnValue([]);
        mockMiFloraUnavailableDevices.mockReturnValue([]);

        mockRuuvitagMapMessageFn.mockReturnValue(Effect.succeed([handledMessage]));
        mockMiFloraMapMessageFn.mockReturnValue(Effect.succeed([handledMessage]));

        const messages = Array.from(
            await Effect.runPromise(
                Effect.provide(
                    collectDeviceMessages(
                        [ruuviPeripheral, unknownPeripheral, unknownPeripheral, unknownPeripheral, ruuviPeripheral],
                        2
                    ),
                    TestLayer
                )
            )
        );

        expect(messages).toEqual([handledMessage, handledMessage]);
        expect(mockRuuvitagMapMessageFn).toHaveBeenCalledTimes(2);
        expect(mockRuuvitagMapMessageFn).toHaveBeenCalledWith(ruuviPeripheral);
    });

    it("handles peripherals with empty or short manufacturer data without crashing", async () => {
        const peripheralWithEmptyData = {
            advertisement: {
                manufacturerData: Buffer.from([]),
                serviceData: [],
            },
            address: "cc:cc",
            rssi: 23,
            uuid: "cc:cc",
        } as unknown as Peripheral;

        const peripheralWithSingleByte = {
            advertisement: {
                manufacturerData: Buffer.from([0x99]),
                serviceData: [],
            },
            address: "dd:dd",
            rssi: 23,
            uuid: "dd:dd",
        } as unknown as Peripheral;

        mockRuuviUnavailableDevices.mockReturnValue([]);
        mockMiFloraUnavailableDevices.mockReturnValue([]);

        mockRuuvitagMapMessageFn.mockReturnValue(Effect.succeed([handledMessage]));

        const messages = Array.from(
            await Effect.runPromise(
                Effect.provide(
                    collectDeviceMessages([peripheralWithEmptyData, peripheralWithSingleByte, ruuviPeripheral], 1),
                    TestLayer
                )
            )
        );

        expect(messages).toEqual([handledMessage]);
        expect(mockRuuvitagMapMessageFn).toHaveBeenCalledTimes(1);
        expect(mockRuuvitagMapMessageFn).toHaveBeenCalledWith(ruuviPeripheral);
    });

    it("observes unavailable device messages from gateways", async () => {
        mockRuuviUnavailableDevices.mockReturnValue([ruuviTag1UnavailableMessage, ruuviTag2UnavailableMessage]);
        mockMiFloraUnavailableDevices.mockReturnValue([miFlora1UnavailableMessage, miFlora2UnavailableMessage]);

        mockRuuvitagMapMessageFn.mockReturnValue(Effect.succeed([handledMessage]));
        mockMiFloraMapMessageFn.mockReturnValue(Effect.succeed([handledMessage]));

        const messages = Array.from(
            await Effect.runPromise(
                Effect.provide(collectDeviceMessages([ruuviPeripheral, ruuviPeripheral], 6), TestLayer)
            )
        );

        expect(messages).toHaveLength(6);
        expect(messages).toEqual(
            expect.arrayContaining([expect.objectContaining(handledMessage), expect.objectContaining(handledMessage)])
        );
        // Gateways run concurrently, so only the order within one gateway is deterministic.
        const unavailableMessagesOf = (deviceType: DeviceType) =>
            messages.filter(
                (message) => message.type === MessageType.Availability && message.device.type === deviceType
            );
        const withGeneratedFields = (message: typeof ruuviTag1UnavailableMessage) => ({
            ...message,
            id: expect.any(String),
            time: expect.any(DateTime),
        });

        expect(unavailableMessagesOf(DeviceType.Ruuvitag)).toEqual([
            withGeneratedFields(ruuviTag1UnavailableMessage),
            withGeneratedFields(ruuviTag2UnavailableMessage),
        ]);
        expect(unavailableMessagesOf(DeviceType.MiFlora)).toEqual([
            withGeneratedFields(miFlora1UnavailableMessage),
            withGeneratedFields(miFlora2UnavailableMessage),
        ]);

        expect(mockRuuviRegisterDeviceStatusPublished).toHaveBeenNthCalledWith(
            1,
            ruuviTag1UnavailableMessage.device.id
        );
        expect(mockRuuviRegisterDeviceStatusPublished).toHaveBeenNthCalledWith(
            2,
            ruuviTag2UnavailableMessage.device.id
        );
        expect(mockMiFloraRegisterDeviceStatusPublished).toHaveBeenNthCalledWith(
            1,
            miFlora1UnavailableMessage.device.id
        );
        expect(mockMiFloraRegisterDeviceStatusPublished).toHaveBeenNthCalledWith(
            2,
            miFlora2UnavailableMessage.device.id
        );
    });
});
