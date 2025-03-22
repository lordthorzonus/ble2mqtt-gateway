import type { Peripheral } from "@abandonware/noble";
import { DeviceType, MessageType } from "../types";
import { Config } from "../config";
import { Effect, Stream } from "effect";

const mockRuuvitagMapMessageFn = jest.fn();
const mockMiFloraMapMessageFn = jest.fn();
const mockRuuvitagStreamUnavailableDevices = jest.fn();
const mockMiFloraStreamUnavailableDevices = jest.fn();

jest.mock("./ruuvitag/ruuvitag-gateway", () => {
    return {
        __esModule: true,
        makeRuuvitagGateway: jest.fn().mockImplementation(() => mockRuuvitagMapMessageFn),
        makeRuuvitagDeviceRegistry: jest.fn().mockImplementation(() => ({
            streamUnavailableDevices: mockRuuvitagStreamUnavailableDevices,
        })),
        ruuviTagManufacturerId: 0x0499,
    };
});

jest.mock("./miflora/miflora-gateway", () => {
    return {
        __esModule: true,
        makeMiFloraGateway: jest.fn().mockImplementation(() => mockMiFloraMapMessageFn),
        makeMiFloraDeviceRegistry: jest.fn().mockImplementation(() => ({
            streamUnavailableDevices: mockMiFloraStreamUnavailableDevices,
        })),
        mifloraGatewayId: 0x95fe,
        isMiFloraPeripheral: jest.fn().mockImplementation((peripheral) => peripheral.uuid === "miflora"),
    };
});

import { makeGateway } from "./ble-gateway";
import { makeRuuvitagGateway, makeRuuvitagDeviceRegistry } from "./ruuvitag/ruuvitag-gateway";
import { makeMiFloraGateway, makeMiFloraDeviceRegistry } from "./miflora/miflora-gateway";
import { DateTime } from "luxon";

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

    it("should use the correct gateway for ruuvitag and miflora ble advertisements", async () => {
        mockRuuvitagStreamUnavailableDevices.mockReturnValue(Stream.empty);
        mockMiFloraStreamUnavailableDevices.mockReturnValue(Stream.empty);

        mockRuuvitagMapMessageFn.mockReturnValue(Effect.succeed([handledMessage]));
        mockMiFloraMapMessageFn.mockReturnValue(Effect.succeed([handledMessage]));

        const gatewayFn = makeGateway(validGatewayConfiguration);
        const eventStream = gatewayFn(Stream.fromIterable([ruuviPeripheral, ruuviPeripheral, mifloraPeripheral]));

        const messages = await Effect.runPromise(
            Stream.runCollect(eventStream).pipe(Effect.map((events) => Array.from(events)))
        );

        expect(messages).toHaveLength(3);
        expect(messages).toEqual([handledMessage, handledMessage, handledMessage]);

        expect(mockRuuvitagMapMessageFn).toHaveBeenCalledTimes(2);
        expect(mockRuuvitagMapMessageFn).toHaveBeenCalledWith(ruuviPeripheral);
        expect(mockMiFloraMapMessageFn).toHaveBeenCalledTimes(1);
        expect(mockMiFloraMapMessageFn).toHaveBeenCalledWith(mifloraPeripheral);

        expect(makeRuuvitagGateway).toHaveBeenCalledWith(validGatewayConfiguration.ruuvitag);
        expect(makeRuuvitagDeviceRegistry).toHaveBeenCalledWith(validGatewayConfiguration.ruuvitag);
        expect(makeMiFloraGateway).toHaveBeenCalledWith(validGatewayConfiguration.miflora);
        expect(makeMiFloraDeviceRegistry).toHaveBeenCalledWith(validGatewayConfiguration.miflora);
    });

    it("should filter away unknown advertisements", async () => {
        const peripherals = [ruuviPeripheral, unknownPeripheral, ruuviPeripheral, unknownPeripheral, unknownPeripheral];

        mockRuuvitagStreamUnavailableDevices.mockReturnValue(Stream.empty);
        mockMiFloraStreamUnavailableDevices.mockReturnValue(Stream.empty);

        mockRuuvitagMapMessageFn.mockReturnValue(Effect.succeed([handledMessage]));
        mockMiFloraMapMessageFn.mockReturnValue(Effect.succeed([handledMessage]));

        const gatewayFn = makeGateway(validGatewayConfiguration);
        const eventStream = gatewayFn(Stream.fromIterable(peripherals));

        const messages = await Effect.runPromise(
            Stream.runCollect(eventStream).pipe(Effect.map((events) => Array.from(events)))
        );

        expect(messages).toHaveLength(2);
        expect(messages).toEqual([handledMessage, handledMessage]);

        expect(mockRuuvitagMapMessageFn).toHaveBeenCalledTimes(2);
        expect(mockRuuvitagMapMessageFn).toHaveBeenCalledWith(ruuviPeripheral);
    });

    it("should also allow to observe unavailable device messages from gateways", async () => {
        const peripherals = [ruuviPeripheral, ruuviPeripheral];

        const ruuviUnavailableStream = Stream.fromIterable([ruuviTag1UnavailableMessage, ruuviTag2UnavailableMessage]);
        const miFloraUnavailableStream = Stream.fromIterable([miFlora1UnavailableMessage, miFlora2UnavailableMessage]);

        mockRuuvitagStreamUnavailableDevices.mockReturnValue(
            ruuviUnavailableStream as unknown as Stream.Stream<unknown>
        );
        mockMiFloraStreamUnavailableDevices.mockReturnValue(
            miFloraUnavailableStream as unknown as Stream.Stream<unknown>
        );

        mockRuuvitagMapMessageFn.mockReturnValue(Effect.succeed([handledMessage]));
        mockMiFloraMapMessageFn.mockReturnValue(Effect.succeed([handledMessage]));

        const gatewayFn = makeGateway(validGatewayConfiguration);
        const eventStream = gatewayFn(Stream.fromIterable(peripherals));

        const messages = await Effect.runPromise(
            Stream.runCollect(eventStream).pipe(Effect.map((events) => Array.from(events)))
        );

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
    });
});
