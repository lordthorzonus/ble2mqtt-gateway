import { Config } from "./config";
import { gateway } from "./gateway";
import { Logger } from "./infra/logger";
import { MqttClient } from "./infra/mqtt-client";
import { mockLogger, mockMqttClient } from "./test/test-context";
import { Settings } from "luxon";
import { Data, Duration, Effect, Layer, Schedule, Stream } from "effect";
import { v4 as uuid } from "uuid";

const mockScan = jest.fn();
const mockedUuid = uuid as jest.Mock;

jest.mock("uuid");

// The scanner module is mocked, so its error class is not importable here.
class ScannerError extends Data.TaggedError("BleScannerError")<{ message: string }> {}

jest.mock("./infra/ble-scanner", () => ({
    __esModule: true,
    scan: jest.fn(() => mockScan()),
}));

describe("gateway", () => {
    const originalNow = Settings.now;
    const createConfig = () =>
        Config.make({
            mqtt: {
                host: "localhost",
                port: 1883,
                username: "test",
                password: "test",
                client_id: "test",
                protocol: "mqtt",
            },
            log_level: "info",
            decimal_precision: 2,
            unavailable_devices_check_interval_ms: 86_400_000,
            gateway_name: "test",
            gateway_version: "1.0.0",
            concurrency: {
                mqtt_message_production: "unbounded",
                mqtt_publishing: "unbounded",
            },
            gateways: {
                base_topic: "test",
                ruuvitag: {
                    allow_unknown: false,
                    timeout: 1000,
                    devices: [
                        {
                            id: "aa:aa",
                            name: "fridge",
                            model: "environmental",
                        },
                    ],
                },
                miflora: {
                    timeout: 1000,
                    devices: [{ id: "bb", name: "plant" }],
                },
                oralb: {
                    allow_unknown: false,
                    timeout: 1000,
                    devices: [{ id: "aa:bb:cc:dd:ee:ff", name: "toothbrush" }],
                },
            },
            homeassistant: {
                discovery_topic: "test",
            },
        });

    const makeTestLayer = (config: Config) =>
        Layer.mergeAll(
            Layer.succeed(Config, config),
            Layer.succeed(Logger, Logger.make(mockLogger)),
            Layer.succeed(MqttClient, mockMqttClient as never)
        );

    const testLayer = makeTestLayer(createConfig());

    const ruuviPeripheral = {
        advertisement: {
            manufacturerData: Buffer.from("99040512FC5394C37C0004FFFC040CAC364200CDCBB8334C884F", "hex"),
            serviceData: [],
        },
        address: "aa:aa",
        rssi: 23,
        uuid: "aa:aa",
    };

    const invalidRuuviPeripheral = {
        advertisement: {
            manufacturerData: Buffer.from("990400", "hex"),
            serviceData: [],
        },
        address: "ff:ff",
        rssi: 10,
        uuid: "ff:ff",
    };

    const getMiFloraPeripheralWithServiceData = (data: string, uuid: string) => ({
        uuid,
        address: `c4:7c:8d:00:00:${uuid}`,
        rssi: 43,
        advertisement: {
            localName: "Flower care",
            serviceData: [{ uuid: "fe95", data: Buffer.from(data, "hex") }],
        },
    });

    const mifloraMoisturePeripheral = getMiFloraPeripheralWithServiceData("71209800a864aed0a8654c0d08100112", "bb");
    const mifloraTemperaturePeripheral = getMiFloraPeripheralWithServiceData(
        "71209800239c066e8d7cc40d0410020401",
        "bb"
    );
    const mifloraIlluminancePeripheral = getMiFloraPeripheralWithServiceData(
        "71209800c3cf076e8d7cc40d071003370000",
        "bb"
    );
    const mifloraSoilConductivityPeripheral = getMiFloraPeripheralWithServiceData(
        "71209800b1cf076e8d7cc40d091002c600",
        "bb"
    );

    const oralbPeripheral = {
        advertisement: {
            manufacturerData: Buffer.from([0xdc, 0x00, 0x08, 0x36, 0x03, 0x03, 0x90, 0x01, 0x1e, 0x01, 0x02]),
            serviceData: [],
        },
        address: "aa:bb:cc:dd:ee:ff",
        rssi: -70,
        uuid: "aa:bb:cc:dd:ee:ff",
    };

    interface PublishedMessage {
        topic: string;
        payload: string;
        retain: boolean;
    }

    const hasTopics = (topics: string[]) => (publishedMessages: PublishedMessage[]) =>
        topics.every((topic) => publishedMessages.some((message) => message.topic === topic));

    const hasTopicCount = (topic: string, expectedCount: number) => (publishedMessages: PublishedMessage[]) =>
        publishedMessages.filter((message) => message.topic === topic).length >= expectedCount;

    const runGatewayUntil = async ({
        stopWhen,
        layer = testLayer,
        timeoutMs = 1000,
        publishError,
    }: {
        stopWhen: (publishedMessages: PublishedMessage[]) => boolean;
        layer?: typeof testLayer;
        timeoutMs?: number;
        publishError?: (message: PublishedMessage) => Error | undefined;
    }): Promise<PublishedMessage[]> => {
        const publishedMessages: PublishedMessage[] = [];
        let resolveDone: (() => void) | undefined;
        const done = new Promise<void>((resolve) => {
            resolveDone = resolve;
        });

        mockMqttClient.publish.mockImplementation((_topic, _payload, _options, callback) => {
            const message = {
                topic: _topic as string,
                payload: _payload as string,
                retain: (_options as { retain: boolean }).retain,
            } satisfies PublishedMessage;

            publishedMessages.push(message);

            if (stopWhen(publishedMessages)) {
                resolveDone?.();
            }

            callback(publishError?.(message));
        });

        const controller = new AbortController();
        const run = Effect.runPromise(Effect.provide(Effect.scoped(gateway), layer), { signal: controller.signal });

        let timeout: NodeJS.Timeout | undefined;
        await Promise.race([
            done,
            new Promise<never>((_, reject) => {
                timeout = setTimeout(() => {
                    reject(
                        new Error(
                            `Timed out waiting for topics: ${publishedMessages.map((message) => message.topic).join(", ")}`
                        )
                    );
                }, timeoutMs);
            }),
        ]).finally(() => {
            clearTimeout(timeout);
        });

        controller.abort();
        await expect(run).rejects.toBeDefined();

        return publishedMessages;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockScan.mockReset();
        mockMqttClient.publish.mockReset();
        Settings.now = () => new Date("2019-10-10T00:00:00.000Z").valueOf();
        Settings.defaultZone = "UTC";
        mockedUuid.mockReturnValue("mock-uuid");
    });

    afterEach(() => {
        jest.useRealTimers();
        Settings.now = originalNow;
    });

    it("publishes mqtt messages for ruuvitag, miflora and oralb messages", async () => {
        mockScan.mockReturnValue(
            Stream.fromIterable([
                ruuviPeripheral,
                mifloraMoisturePeripheral,
                oralbPeripheral,
                mifloraTemperaturePeripheral,
                mifloraIlluminancePeripheral,
                mifloraSoilConductivityPeripheral,
            ])
        );
        const publishedMessages = await runGatewayUntil({
            stopWhen: hasTopics([
                "test/ruuvitag/aa:aa/state",
                "test/miflora/bb/state",
                "test/oralb/aa:bb:cc:dd:ee:ff/state",
            ]),
        });

        const availabilityMessage = publishedMessages.find(
            (message) => message.topic === "test/ruuvitag/aa:aa/availability"
        );
        const stateMessage = publishedMessages.find((message) => message.topic === "test/ruuvitag/aa:aa/state");

        expect(availabilityMessage).toEqual({
            topic: "test/ruuvitag/aa:aa/availability",
            payload: JSON.stringify({ state: "online" }),
            retain: true,
        });
        expect(stateMessage?.topic).toBe("test/ruuvitag/aa:aa/state");
        expect(stateMessage?.retain).toBe(false);
        expect(stateMessage ? JSON.parse(stateMessage.payload) : undefined).toEqual({
            absoluteHumidity: 11.84,
            accelerationX: 0,
            accelerationY: 0,
            accelerationZ: 1.04,
            batteryVoltage: 2.98,
            breezeIndoorClimateIndex: 3,
            breezeIndoorClimateIndexDescription: "moderate",
            dewPoint: 14.2,
            heatIndex: 26,
            humidex: 28,
            macAddress: "CB:B8:33:4C:88:4F",
            measurementSequence: 205,
            movementCounter: 66,
            pressure: 100044,
            relativeHumidityPercentage: 53.49,
            temperature: 24.3,
            txPower: 4,
            type: "environmental",
            time: "2019-10-10T00:00:00.000Z",
            id: "mock-uuid",
        });
        expect(publishedMessages.some((call) => call.topic === "test/sensor/aa:aa/fridge_temperature/config")).toBe(
            true
        );
        expect(mockLogger.info).toHaveBeenCalledWith("Starting BLE2MQTT Gateway");
        expect(mockLogger.info).toHaveBeenCalledWith("Shutting down BLE2MQTT Gateway");
        expect(mockLogger.error).not.toHaveBeenCalled();

        const mifloraAvailabilityMessage = publishedMessages.find(
            (message) => message.topic === "test/miflora/bb/availability"
        );
        const mifloraStateMessage = publishedMessages.find((message) => message.topic === "test/miflora/bb/state");
        const oralbAvailabilityMessage = publishedMessages.find(
            (message) => message.topic === "test/oralb/aa:bb:cc:dd:ee:ff/availability"
        );
        const oralbStateMessage = publishedMessages.find(
            (message) => message.topic === "test/oralb/aa:bb:cc:dd:ee:ff/state"
        );

        expect(mifloraAvailabilityMessage).toEqual({
            topic: "test/miflora/bb/availability",
            payload: JSON.stringify({ state: "online" }),
            retain: true,
        });
        expect(mifloraStateMessage?.retain).toBe(false);
        expect(mifloraStateMessage ? JSON.parse(mifloraStateMessage.payload) : undefined).toEqual({
            illuminance: 55,
            moisture: 18,
            soilConductivity: 198,
            temperature: 26,
            lowBatteryWarning: false,
            time: "2019-10-10T00:00:00.000Z",
            id: "mock-uuid",
        });
        expect(oralbAvailabilityMessage).toEqual({
            topic: "test/oralb/aa:bb:cc:dd:ee:ff/availability",
            payload: JSON.stringify({ state: "online" }),
            retain: true,
        });
        expect(oralbStateMessage?.retain).toBe(false);
        expect(oralbStateMessage ? JSON.parse(oralbStateMessage.payload) : undefined).toEqual(
            expect.objectContaining({
                state: "running",
                brushingMode: "sensitive",
                isBrushing: true,
                pressure: "high",
                sector: "sector_2",
                brushingTimeSeconds: 90,
                time: "2019-10-10T00:00:00.000Z",
                id: "mock-uuid",
            })
        );
    });

    it("logs gateway errors and continues with later messages", async () => {
        mockScan.mockReturnValue(Stream.fromIterable([invalidRuuviPeripheral, ruuviPeripheral]));
        const publishedMessages = await runGatewayUntil({
            stopWhen: hasTopics(["test/ruuvitag/aa:aa/availability", "test/ruuvitag/aa:aa/state"]),
        });

        expect(mockLogger.error).toHaveBeenCalledWith(
            "BLE Gateway error",
            expect.objectContaining({
                peripheral: invalidRuuviPeripheral,
                message: expect.stringContaining("Unsupported Ruuvi data format"),
            })
        );
        expect(publishedMessages.some((message) => message.topic === "test/ruuvitag/aa:aa/state")).toBe(true);
    });

    it("logs truncated packets from configured devices and continues with later messages", async () => {
        const truncatedRuuviPeripheral = {
            ...ruuviPeripheral,
            advertisement: { ...ruuviPeripheral.advertisement, manufacturerData: Buffer.from("99040512FC", "hex") },
        };
        const truncatedMifloraPeripheral = getMiFloraPeripheralWithServiceData("71209800239c066e8d7cc40d0410", "bb");

        mockScan.mockReturnValue(
            Stream.fromIterable([truncatedRuuviPeripheral, truncatedMifloraPeripheral, ruuviPeripheral])
        );
        const publishedMessages = await runGatewayUntil({
            stopWhen: hasTopics(["test/ruuvitag/aa:aa/state"]),
        });

        expect(mockLogger.error).toHaveBeenCalledWith(
            "BLE Gateway error",
            expect.objectContaining({
                peripheral: truncatedRuuviPeripheral,
                message: expect.stringContaining("Invalid Ruuvi data length"),
            })
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
            "BLE Gateway error",
            expect.objectContaining({
                peripheral: truncatedMifloraPeripheral,
                message: expect.stringContaining("Invalid MiFlora data length"),
            })
        );
        expect(publishedMessages.some((message) => message.topic === "test/ruuvitag/aa:aa/state")).toBe(true);
    });

    it("logs missing Home Assistant configuration and continues with sensor state publishing", async () => {
        const invalidConfig = createConfig();
        const ruuvitagConfig = invalidConfig.gateways.ruuvitag;

        if (ruuvitagConfig === undefined) {
            throw new Error("RuuviTag config is required for this test");
        }

        invalidConfig.gateways.ruuvitag = {
            ...ruuvitagConfig,
            devices: [
                {
                    id: "aa:aa",
                    name: "fridge",
                    model: "invalid-model" as never,
                },
            ],
        };

        mockScan.mockReturnValue(Stream.fromIterable([ruuviPeripheral]));
        const publishedMessages = await runGatewayUntil({
            stopWhen: hasTopics(["test/ruuvitag/aa:aa/state"]),
            layer: makeTestLayer(invalidConfig),
        });

        expect(mockLogger.error).toHaveBeenCalledWith(
            "Encountered a device message that does not have corresponding Home Assistant configuration",
            expect.objectContaining({
                message: expect.objectContaining({
                    device: expect.objectContaining({
                        type: "ruuvitag",
                        model: "invalid-model",
                    }),
                }),
            })
        );
        expect(publishedMessages.some((message) => message.topic === "test/ruuvitag/aa:aa/availability")).toBe(false);
        expect(publishedMessages.some((message) => message.topic === "test/ruuvitag/aa:aa/state")).toBe(true);
    });

    const recordPublishes = (
        failPublish: (message: PublishedMessage, attempt: number) => boolean
    ): PublishedMessage[] => {
        const publishedMessages: PublishedMessage[] = [];
        const attempts = new Map<string, number>();

        mockMqttClient.publish.mockImplementation((topic, payload, options, callback) => {
            const message = {
                topic: topic as string,
                payload: payload as string,
                retain: (options as { retain: boolean }).retain,
            } satisfies PublishedMessage;
            const attempt = (attempts.get(message.payload + message.topic) ?? 0) + 1;
            attempts.set(message.payload + message.topic, attempt);

            if (failPublish(message, attempt)) {
                callback(new Error("temporary network error"));
                return;
            }

            publishedMessages.push(message);
            callback(undefined);
        });

        return publishedMessages;
    };

    const runGatewayFor = async (durationMs: number, layer = testLayer) => {
        const controller = new AbortController();
        const run = Effect.runPromise(Effect.provide(Effect.scoped(gateway), layer), { signal: controller.signal });
        await jest.advanceTimersByTimeAsync(durationMs);
        controller.abort();
        await expect(run).rejects.toBeDefined();
    };

    it("does not retry state messages and logs the publish failure with its cause", async () => {
        jest.useFakeTimers();
        mockScan.mockReturnValue(Stream.fromIterable([ruuviPeripheral]));
        recordPublishes((message) => message.topic === "test/ruuvitag/aa:aa/state");

        await runGatewayFor(10_000);

        const stateAttempts = mockMqttClient.publish.mock.calls.filter(
            ([topic]) => topic === "test/ruuvitag/aa:aa/state"
        );
        expect(stateAttempts).toHaveLength(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            "Error publishing MQTT message",
            expect.objectContaining({
                topic: "test/ruuvitag/aa:aa/state",
                retain: false,
                cause: new Error("temporary network error"),
            })
        );
    });

    it("retries retained messages a bounded number of times", async () => {
        jest.useFakeTimers();
        mockScan.mockReturnValue(Stream.fromIterable([ruuviPeripheral]));
        recordPublishes((message) => message.topic === "test/ruuvitag/aa:aa/availability");

        await runGatewayFor(60_000);

        const availabilityAttempts = mockMqttClient.publish.mock.calls.filter(
            ([topic]) => topic === "test/ruuvitag/aa:aa/availability"
        );
        expect(availabilityAttempts).toHaveLength(4);
        expect(mockLogger.error).toHaveBeenCalledWith(
            "Error publishing MQTT message",
            expect.objectContaining({ topic: "test/ruuvitag/aa:aa/availability", retain: true })
        );
    });

    it("does not let a retried message overwrite a newer message on the same topic", async () => {
        jest.useFakeTimers();
        Settings.now = () => Date.now();
        const config = createConfig();
        config.unavailable_devices_check_interval_ms = 100;
        mockScan.mockReturnValue(Stream.fromIterable([ruuviPeripheral]));

        // The online message fails until its 4th attempt (~3.5 s), after the device has timed out (1 s).
        const publishedMessages = recordPublishes(
            (message, attempt) =>
                message.topic === "test/ruuvitag/aa:aa/availability" &&
                message.payload === JSON.stringify({ state: "online" }) &&
                attempt < 4
        );

        await runGatewayFor(10_000, makeTestLayer(config));

        const availabilityPayloads = publishedMessages
            .filter((message) => message.topic === "test/ruuvitag/aa:aa/availability")
            .map((message) => message.payload);
        expect(availabilityPayloads).toEqual([
            JSON.stringify({ state: "online" }),
            JSON.stringify({ state: "offline" }),
        ]);
    });

    it("re-sends availability and discovery with the heartbeat after the availability publish was dropped", async () => {
        jest.useFakeTimers();
        Settings.now = () => Date.now();
        const config = createConfig();
        const ruuvitagConfig = config.gateways.ruuvitag;
        if (ruuvitagConfig === undefined) {
            throw new Error("Test config is missing ruuvitag gateway configuration");
        }
        config.gateways.ruuvitag = { ...ruuvitagConfig, timeout: 60_000 };
        const peripheralWithDistinctMac = { ...ruuviPeripheral, address: "c4:00:00:00:00:aa" };
        mockScan.mockReturnValue(
            Stream.repeatValue(peripheralWithDistinctMac).pipe(Stream.schedule(Schedule.spaced(Duration.seconds(20))))
        );

        // All 4 attempts of the first online message fail, so it is dropped. The heartbeat is the 5th attempt.
        const publishedMessages = recordPublishes(
            (message, attempt) => message.topic === "test/ruuvitag/aa:aa/availability" && attempt <= 4
        );

        await runGatewayFor(5 * 60_000 + 1_000, makeTestLayer(config));

        expect(publishedMessages.filter((message) => message.topic === "test/ruuvitag/aa:aa/availability")).toEqual([
            { topic: "test/ruuvitag/aa:aa/availability", payload: JSON.stringify({ state: "online" }), retain: true },
        ]);
        const temperatureConfigs = publishedMessages.filter(
            (message) => message.topic === "test/sensor/aa:aa/fridge_temperature/config"
        );
        expect(temperatureConfigs).toHaveLength(2);
        expect(JSON.parse(temperatureConfigs[1]?.payload ?? "{}")).toEqual(
            expect.objectContaining({
                device: expect.objectContaining({
                    connections: [["mac", "c4:00:00:00:00:aa"]],
                    identifiers: ["aa:aa", "c4:00:00:00:00:aa"],
                }),
            })
        );
    });

    it("restarts the scanner after a scanner failure and logs it", async () => {
        jest.useFakeTimers();
        let scanAttempts = 0;
        mockScan.mockReturnValue(
            Stream.suspend(() => {
                scanAttempts += 1;
                return scanAttempts === 1
                    ? Stream.fail(new ScannerError({ message: "adapter not powered on" }))
                    : Stream.make(ruuviPeripheral);
            })
        );
        const publishedMessages = recordPublishes(() => false);

        await runGatewayFor(5_000);

        expect(scanAttempts).toBe(2);
        expect(mockLogger.error).toHaveBeenCalledWith(
            "BLE scanner failed, restarting scanner",
            expect.objectContaining({ error: new ScannerError({ message: "adapter not powered on" }) })
        );
        expect(publishedMessages.some((message) => message.topic === "test/ruuvitag/aa:aa/state")).toBe(true);
    });

    it("processes multiple BLE elements", async () => {
        mockScan.mockReturnValue(Stream.fromIterable([ruuviPeripheral, ruuviPeripheral]));
        const publishedMessages = await runGatewayUntil({
            stopWhen: hasTopicCount("test/ruuvitag/aa:aa/state", 2),
        });

        expect(publishedMessages.filter((message) => message.topic === "test/ruuvitag/aa:aa/state")).toHaveLength(2);
    });
});
