import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Effect, Layer } from "effect";
import { makeOralbDeviceRegistry, makeOralbGateway } from "./oralb-gateway.js";
import { Settings } from "luxon";
import { v4 as uuid } from "uuid";
import { Peripheral } from "../../infra/ble-scanner.js";
import { Logger } from "../../infra/logger.js";
import { Config, GlobalConfiguration, OralBGatewayConfiguration } from "../../config.js";
import { DeviceRegistryService } from "../gateway-helpers.js";
import { getTestConfig } from "../../test/test-context.js";
import { DeviceMessage, DeviceType, MessageType, OralBSensorMessage } from "../../types.js";

vi.mock("uuid");

const isOralBSensorMessage = (message: DeviceMessage): message is OralBSensorMessage =>
    message.type === MessageType.SensorData && message.device.type === DeviceType.OralB;

const mockedUuid = vi.mocked<() => string>(uuid);
const defaultTimeout = 60000;

const validGatewayConfiguration: GlobalConfiguration["gateways"] = {
    base_topic: "test",
    oralb: {
        timeout: defaultTimeout,
        allow_unknown: false,
        devices: [
            {
                id: "aa:bb:cc:dd:ee:ff",
                name: "my_toothbrush",
            },
        ],
    },
};

const oralbSettings = validGatewayConfiguration.oralb;

if (!oralbSettings) {
    throw new Error("OralB configuration is required for this test");
}

const TestLayer = Layer.provideMerge(
    Logger.layerWithoutDependencies,
    Layer.succeed(
        Config,
        getTestConfig({
            gateways: validGatewayConfiguration,
        })
    )
);

describe("OralB Gateway", () => {
    const originalNow = Settings.now;

    const peripheral: Peripheral = {
        advertisement: {
            manufacturerData: Buffer.from([
                0xdc,
                0x00, // manufacturer ID
                0x08,
                0x36, // model bytes (IO Series 6/7)
                0x03, // reserved
                0x03, // state: running
                0x90, // pressure: power_button_pressed
                0x01, // time minutes: 1
                0x1e, // time seconds: 30
                0x01, // mode: 1
                0x02, // sector: 2
            ]),
            serviceData: [],
        },
        address: "aa:bb:cc:dd:ee:ff",
        rssi: -70,
        uuid: "aa:bb:cc:dd:ee:ff",
    };

    beforeEach(() => {
        Settings.now = () => 0;
        mockedUuid.mockReturnValue("test-uuid");
    });

    afterEach(() => {
        Settings.now = originalNow;
    });

    describe("makeOralbDeviceRegistry", () => {
        it("should create a device registry with configured devices", () => {
            const registry = makeOralbDeviceRegistry(oralbSettings, {
                defaultDecimalPrecision: 2,
            });

            expect(registry).toBeDefined();
        });
    });

    describe("makeOralbGateway", () => {
        it("should parse advertisement and return device message for known device", async () => {
            const gateway = makeOralbGateway(oralbSettings);

            const deviceRegistry = makeOralbDeviceRegistry(oralbSettings, {
                defaultDecimalPrecision: 2,
            });

            const program = gateway(peripheral).pipe(
                Effect.provideService(DeviceRegistryService, deviceRegistry),
                Effect.provide(TestLayer)
            );

            const messages = await Effect.runPromise(program);
            const messagesArray = Array.from(messages);

            expect(messagesArray).toHaveLength(2);

            const availabilityMessage = messagesArray[0];
            const sensorMessage = messagesArray[1];

            expect(availabilityMessage).toBeDefined();
            expect(sensorMessage).toBeDefined();
            expect(availabilityMessage?.type).toBe(MessageType.Availability);
            expect(sensorMessage?.type).toBe(MessageType.SensorData);

            const oralbMessage = messagesArray.find(isOralBSensorMessage);
            expect(oralbMessage?.device.friendlyName).toBe("my_toothbrush");
            expect(oralbMessage?.device.id).toBe("aa:bb:cc:dd:ee:ff");
            expect(oralbMessage?.payload.state).toBe("running");
            expect(oralbMessage?.payload.brushingMode).toBe("sensitive");
            expect(oralbMessage?.payload.isBrushing).toBe(true);
        });

        it("should return empty array for unknown device when allow_unknown is false", async () => {
            const unknownPeripheral = {
                ...peripheral,
                address: "ff:ff:ff:ff:ff:ff",
                uuid: "ff:ff:ff:ff:ff:ff",
            };

            const gateway = makeOralbGateway(oralbSettings);

            const deviceRegistry = makeOralbDeviceRegistry(oralbSettings, {
                defaultDecimalPrecision: 2,
            });

            const program = gateway(unknownPeripheral).pipe(
                Effect.provideService(DeviceRegistryService, deviceRegistry),
                Effect.provide(TestLayer)
            );

            const messages = await Effect.runPromise(program);
            const messagesArray = Array.from(messages);

            expect(messagesArray).toHaveLength(0);
        });

        it("should auto-discover unknown device when allow_unknown is true", async () => {
            const config: OralBGatewayConfiguration = {
                ...oralbSettings,
                allow_unknown: true,
                devices: [],
            };

            const unknownPeripheral = {
                ...peripheral,
                address: "ff:ff:ff:ff:ff:ff",
                uuid: "ff:ff:ff:ff:ff:ff",
            };

            const gateway = makeOralbGateway(config);

            const deviceRegistry = makeOralbDeviceRegistry(config, {
                defaultDecimalPrecision: 2,
            });

            const program = gateway(unknownPeripheral).pipe(
                Effect.provideService(DeviceRegistryService, deviceRegistry),
                Effect.provide(TestLayer)
            );

            const messages = await Effect.runPromise(program);
            const messagesArray = Array.from(messages);

            expect(messagesArray.length).toBeGreaterThan(0);
        });

        it("should use model override from configuration", async () => {
            const configWithModelOverride: GlobalConfiguration["gateways"] = {
                base_topic: "test",
                oralb: {
                    timeout: defaultTimeout,
                    allow_unknown: false,
                    devices: [
                        {
                            id: "aa:bb:cc:dd:ee:ff",
                            name: "my_toothbrush",
                            model: "smart_series_4000",
                        },
                    ],
                },
            };

            const oralbConfig = configWithModelOverride.oralb;

            if (!oralbConfig) {
                throw new Error("OralB configuration is required for this test");
            }

            const gateway = makeOralbGateway(oralbConfig);

            const deviceRegistry = makeOralbDeviceRegistry(oralbConfig, {
                defaultDecimalPrecision: 2,
            });

            const testLayer = Layer.provideMerge(
                Logger.layerWithoutDependencies,
                Layer.succeed(
                    Config,
                    getTestConfig({
                        gateways: configWithModelOverride,
                    })
                )
            );

            const program = gateway(peripheral).pipe(
                Effect.provideService(DeviceRegistryService, deviceRegistry),
                Effect.provide(testLayer)
            );

            const messages = await Effect.runPromise(program);
            const messagesArray = Array.from(messages);

            const sensorMessage = messagesArray.find(isOralBSensorMessage);
            expect(sensorMessage).toBeDefined();
            expect(sensorMessage?.payload.brushingMode).toBe("daily_clean");
        });

        const unknownModelPeripheral = {
            ...peripheral,
            advertisement: {
                ...peripheral.advertisement,
                manufacturerData: Buffer.from([0xdc, 0x00, 0xff, 0xff, 0x03, 0x03, 0x90, 0x01, 0x1e, 0x01, 0x02]),
            },
        };

        const runGateway = (settings: NonNullable<OralBGatewayConfiguration>, input: Peripheral) =>
            Effect.runPromise(
                makeOralbGateway(settings)(input).pipe(
                    Effect.provideService(
                        DeviceRegistryService,
                        makeOralbDeviceRegistry(settings, { defaultDecimalPrecision: 2 })
                    ),
                    Effect.provide(TestLayer)
                )
            );

        const findSensorMessage = (messages: Iterable<DeviceMessage>): OralBSensorMessage | undefined =>
            Array.from(messages).find(isOralBSensorMessage);

        it("uses the configured model override when the model bytes are unknown", async () => {
            const settings: NonNullable<OralBGatewayConfiguration> = {
                ...oralbSettings,
                devices: [{ id: "aa:bb:cc:dd:ee:ff", name: "my_toothbrush", model: "smart_series_4000" }],
            };

            const sensorMessage = findSensorMessage(await runGateway(settings, unknownModelPeripheral));

            expect(sensorMessage?.device.model).toBe("smart_series_4000");
            expect(sensorMessage?.payload.brushingMode).toBe("daily_clean");
        });

        it("publishes the unknown model with model independent values when the model bytes are unknown", async () => {
            const sensorMessage = findSensorMessage(await runGateway(oralbSettings, unknownModelPeripheral));

            expect(sensorMessage?.device.model).toBe("unknown");
            expect(sensorMessage?.payload).toEqual(
                expect.objectContaining({
                    state: "running",
                    pressure: "high",
                    brushingTimeSeconds: 90,
                    sector: "sector_2",
                    brushingMode: "unknown_mode_1",
                    isBrushing: true,
                })
            );
        });

        it("reports the detected model on sensor messages", async () => {
            const sensorMessage = findSensorMessage(await runGateway(oralbSettings, peripheral));

            expect(sensorMessage?.device.model).toBe("io_series_6_7");
        });
    });
});
