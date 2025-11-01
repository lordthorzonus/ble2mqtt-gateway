import type { Peripheral } from "../infra/ble-scanner";
import { DeviceType, MessageType } from "../types";
import { Config, GlobalConfiguration } from "../config";
import { Effect, Layer, Stream } from "effect";

const mockRuuvitagMapMessageFn = jest.fn();
const mockMiFloraMapMessageFn = jest.fn();
const mockRuuviUnavailableDevices = jest.fn();
const mockMiFloraUnavailableDevices = jest.fn();
const mockRuuviRegisterDeviceStatusPublished = jest.fn();
const mockMiFloraRegisterDeviceStatusPublished = jest.fn();

jest.mock("./ruuvitag/ruuvitag-gateway", () => {
    return {
        __esModule: true,
        makeRuuvitagGateway: jest.fn().mockImplementation(() => mockRuuvitagMapMessageFn),
        makeRuuvitagDeviceRegistry: jest.fn().mockImplementation(() => ({
            getUnavailableDevices: mockRuuviUnavailableDevices,
            registerDeviceStatusPublished: mockRuuviRegisterDeviceStatusPublished,
        })),
        ruuviTagManufacturerId: 0x0499,
    };
});

jest.mock("./miflora/miflora-gateway", () => {
    return {
        __esModule: true,
        makeMiFloraGateway: jest.fn().mockImplementation(() => mockMiFloraMapMessageFn),
        makeMiFloraDeviceRegistry: jest.fn().mockImplementation(() => ({
            getUnavailableDevices: mockMiFloraUnavailableDevices,
            registerDeviceStatusPublished: mockMiFloraRegisterDeviceStatusPublished,
        })),
        mifloraGatewayId: 0x95fe,
        isMiFloraPeripheral: jest.fn().mockImplementation((peripheral) => peripheral.uuid === "miflora"),
    };
});

import { makeBleGateway } from "./ble-gateway";
import { makeRuuvitagGateway, makeRuuvitagDeviceRegistry } from "./ruuvitag/ruuvitag-gateway";
import { makeMiFloraGateway, makeMiFloraDeviceRegistry } from "./miflora/miflora-gateway";
import { DateTime } from "luxon";
import { Logger } from "../infra/logger";
import { mockLogger } from "../test/test-context";

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
        jest.clearAllMocks();
    });

    const TestLayer = Layer.mergeAll(
        Layer.succeed(Logger, Logger.make(mockLogger)),
        Layer.succeed(
            Config,
            Config.make({
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
                    ble_gateway_processing: "unbounded",
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

    it("should use the correct gateway for ruuvitag and miflora ble advertisements", async () => {
        mockRuuviUnavailableDevices.mockReturnValue([]);
        mockMiFloraUnavailableDevices.mockReturnValue([]);

        mockRuuvitagMapMessageFn.mockReturnValue(Effect.succeed([handledMessage]));
        mockMiFloraMapMessageFn.mockReturnValue(Effect.succeed([handledMessage]));

        const program = Effect.gen(function* () {
            const bleGateway = yield* makeBleGateway();
            const eventStream = bleGateway(Stream.fromIterable([ruuviPeripheral, ruuviPeripheral, mifloraPeripheral]));
            return yield* Stream.runCollect(Stream.take(eventStream, 3));
        });

        const messages = Array.from(await Effect.runPromise(Effect.provide(program, TestLayer)));

        expect(messages).toHaveLength(3);
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

    it("should filter away unknown advertisements", async () => {
        const peripherals = [ruuviPeripheral, unknownPeripheral, unknownPeripheral, unknownPeripheral, ruuviPeripheral];

        mockRuuviUnavailableDevices.mockReturnValue([]);
        mockMiFloraUnavailableDevices.mockReturnValue([]);

        mockRuuvitagMapMessageFn.mockReturnValue(Effect.succeed([handledMessage]));
        mockMiFloraMapMessageFn.mockReturnValue(Effect.succeed([handledMessage]));

        const program = Effect.gen(function* () {
            const bleGateway = yield* makeBleGateway();
            const eventStream = bleGateway(Stream.fromIterable(peripherals));
            return yield* Stream.runCollect(Stream.take(eventStream, 2));
        });

        const messages = Array.from(await Effect.runPromise(Effect.provide(program, TestLayer)));

        expect(messages).toHaveLength(2);
        expect(messages).toEqual([handledMessage, handledMessage]);

        expect(mockRuuvitagMapMessageFn).toHaveBeenCalledTimes(2);
        expect(mockRuuvitagMapMessageFn).toHaveBeenCalledWith(ruuviPeripheral);
    });

    it("should handle peripherals with empty or short manufacturer data without crashing", async () => {
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

        const peripherals = [peripheralWithEmptyData, peripheralWithSingleByte, ruuviPeripheral];

        mockRuuviUnavailableDevices.mockReturnValue([]);
        mockMiFloraUnavailableDevices.mockReturnValue([]);

        mockRuuvitagMapMessageFn.mockReturnValue(Effect.succeed([handledMessage]));

        const program = Effect.gen(function* () {
            const bleGateway = yield* makeBleGateway();
            const eventStream = bleGateway(Stream.fromIterable(peripherals));
            return yield* Stream.runCollect(Stream.take(eventStream, 1));
        });

        const messages = Array.from(await Effect.runPromise(Effect.provide(program, TestLayer)));

        expect(messages).toHaveLength(1);
        expect(messages).toEqual([handledMessage]);

        expect(mockRuuvitagMapMessageFn).toHaveBeenCalledTimes(1);
        expect(mockRuuvitagMapMessageFn).toHaveBeenCalledWith(ruuviPeripheral);
    });

    it("should also allow to observe unavailable device messages from gateways", async () => {
        const peripherals = [ruuviPeripheral, ruuviPeripheral];

        mockRuuviUnavailableDevices.mockReturnValue([ruuviTag1UnavailableMessage, ruuviTag2UnavailableMessage]);
        mockMiFloraUnavailableDevices.mockReturnValue([miFlora1UnavailableMessage, miFlora2UnavailableMessage]);

        mockRuuvitagMapMessageFn.mockReturnValue(Effect.succeed([handledMessage]));
        mockMiFloraMapMessageFn.mockReturnValue(Effect.succeed([handledMessage]));

        const program = Effect.gen(function* () {
            const bleGateway = yield* makeBleGateway();
            const eventStream = bleGateway(Stream.fromIterable(peripherals));
            return yield* Stream.runCollect(Stream.take(eventStream, 6));
        });

        const messages = Array.from(await Effect.runPromise(Effect.provide(program, TestLayer)));

        expect(messages).toHaveLength(6);
        expect(messages).toEqual(
            expect.arrayContaining([expect.objectContaining(handledMessage), expect.objectContaining(handledMessage)])
        );
        expect(messages[2]).toEqual({
            ...ruuviTag1UnavailableMessage,
            id: expect.any(String),
            time: expect.any(DateTime),
        });
        expect(messages[3]).toEqual({
            ...ruuviTag2UnavailableMessage,
            id: expect.any(String),
            time: expect.any(DateTime),
        });
        expect(messages[4]).toEqual({
            ...miFlora1UnavailableMessage,
            id: expect.any(String),
            time: expect.any(DateTime),
        });
        expect(messages[5]).toEqual({
            ...miFlora2UnavailableMessage,
            id: expect.any(String),
            time: expect.any(DateTime),
        });

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
