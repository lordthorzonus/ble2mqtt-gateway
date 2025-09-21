import { Effect, Layer } from "effect";
import { makeRuuvitagDeviceRegistry, makeRuuvitagGateway } from "./ruuvitag-gateway";
import { RuuvitagDataFormatDeviceFilter } from "./ruuvitag-data-format-device-filter";
import { Settings } from "luxon";
import { v4 as uuid } from "uuid";
import { Peripheral } from "@abandonware/noble";
import { Logger } from "../../infra/logger";
import { Config, GlobalConfiguration, RuuviTagGatewayConfiguration } from "../../config";
import { DeviceRegistryService } from "../gateway-helpers";
import { getTestConfig } from "../../test/test-context";

jest.mock("uuid");
const mockedUuid = uuid as jest.Mock;
const defaultTimeout = 30000;

const validGatewayConfiguration: GlobalConfiguration["gateways"] = {
    base_topic: "test",
    ruuvitag: {
        timeout: defaultTimeout,
        allow_unknown: false,
        devices: [
            {
                id: "a1:b2",
                name: "my_ruuvitag",
                model: "environmental",
            },
        ],
    },
};

const ruuviTagSettings = validGatewayConfiguration.ruuvitag;

if (!ruuviTagSettings) {
    throw new Error("RuuviTag configuration is required for this test");
}

const TestLayer = Layer.provideMerge(
    Logger.DefaultWithoutDependencies,
    Layer.succeed(
        Config,
        getTestConfig({
            gateways: validGatewayConfiguration,
        })
    )
);

describe("RuuviTag Gateway", () => {
    const originalNow = Settings.now;
    const peripheral = {
        advertisement: {
            manufacturerData: Buffer.from("99040512FC5394C37C0004FFFC040CAC364200CDCBB8334C884F", "hex"),
        },
        address: "a1:b2",
        rssi: 23,
        uuid: "a1:b2",
    } as Peripheral;

    // Data format 6 peripheral (air quality sensor)
    const format6Peripheral = {
        advertisement: {
            manufacturerData: Buffer.from("990406170C5668C79E007000C90A02D900CD004C884F", "hex"),
        },
        address: "a1:b2",
        rssi: 23,
        uuid: "a1:b2",
    } as Peripheral;

    // Data format E1 peripheral (extended air quality sensor)
    const formatE1Peripheral = {
        advertisement: {
            manufacturerData: Buffer.from(
                "9904E1170C5668C79E0065007004BD11CA00C9140413E0AC3FFFFFFECDEE11FFFFFFFFFFFFCBB8334C884F",
                "hex"
            ),
        },
        address: "a1:b2",
        rssi: 23,
        uuid: "a1:b2",
    } as Peripheral;

    beforeEach(() => {
        Settings.now = () => new Date("2019-10-10T00:00:00.000Z").valueOf();
        Settings.defaultZone = "UTC";
        mockedUuid.mockReturnValue("mock-uuid");
    });

    afterEach(() => {
        Settings.now = originalNow;
        jest.resetAllMocks();
    });

    const testWithFreshDeviceRegistry = <A, E, R extends Config | Logger | DeviceRegistryService>(
        settings: NonNullable<RuuviTagGatewayConfiguration> = ruuviTagSettings,
        program: Effect.Effect<A, E, R>
    ) => {
        const deviceRegistry = makeRuuvitagDeviceRegistry(settings, {
            defaultDecimalPrecision: 2,
        });

        const TestLayerWithDeviceRegistry = Layer.merge(
            TestLayer,
            Layer.succeed(DeviceRegistryService, deviceRegistry)
        );

        return Effect.provide(
            Effect.gen(function* () {
                return yield* program;
            }),
            TestLayerWithDeviceRegistry
        );
    };

    describe("ruuvitagGateway()", () => {
        it("should produce a availability and a payload message for a found ruuvitag advertisement", async () => {
            const program = Effect.gen(function* () {
                const gateway = makeRuuvitagGateway(ruuviTagSettings);
                const messages = yield* gateway(peripheral);
                return Array.from(messages);
            });

            const messages = await Effect.runPromise(testWithFreshDeviceRegistry(ruuviTagSettings, program));
            expect(messages).toMatchSnapshot();
        });

        it("should support air quality ruuvitags", async () => {
            const airQualitySettings = {
                ...ruuviTagSettings,
                devices: [
                    {
                        id: "a1:b2",
                        name: "my_air_quality_ruuvitag",
                        model: "air-quality" as const,
                    },
                ],
            };
            const program = Effect.gen(function* () {
                const gateway = makeRuuvitagGateway(airQualitySettings);
                const messages = yield* gateway(format6Peripheral);
                return Array.from(messages);
            });
            const messages = await Effect.runPromise(testWithFreshDeviceRegistry(airQualitySettings, program));
            expect(messages).toMatchSnapshot();
        });

        it("should complete without emitting messages if unknown ruuvitag advertisement is received", async () => {
            const program = Effect.gen(function* () {
                const gateway = makeRuuvitagGateway(ruuviTagSettings);
                const messages = yield* gateway({
                    ...peripheral,
                    uuid: "no-such-ruuvitag",
                } as Peripheral);
                return Array.from(messages);
            });

            const messages = await Effect.runPromise(testWithFreshDeviceRegistry(ruuviTagSettings, program));
            expect(messages).toHaveLength(0);
        });

        it("should not emit the device message until all sensor events are received once", async () =>
            Effect.runPromise(
                testWithFreshDeviceRegistry(
                    ruuviTagSettings,
                    Effect.gen(function* () {
                        const gateway = makeRuuvitagGateway(ruuviTagSettings);

                        // First message should be availability
                        const firstMessages = yield* gateway(peripheral);
                        const firstMessage = Array.from(firstMessages)[0];
                        expect(firstMessage).toEqual(expect.objectContaining({ type: "availability" }));

                        // Subsequent messages should be sensor data
                        const secondMessages = yield* gateway(peripheral);
                        const secondMessage = Array.from(secondMessages)[0];
                        expect(secondMessage).toEqual(expect.objectContaining({ type: "sensor-data" }));
                    })
                )
            ));

        it("should handle unknown ruuvitags normally if unknown ruuvitags are allowed", async () => {
            const unknownPeripheral = {
                ...peripheral,
                uuid: "unknown",
            } as Peripheral;

            const program = Effect.gen(function* () {
                const gateway = makeRuuvitagGateway({ ...ruuviTagSettings, allow_unknown: true });
                // First call to get availability message
                const firstMessages = yield* gateway(unknownPeripheral);

                // Second call to get sensor data
                const secondMessages = yield* gateway(unknownPeripheral);
                return [...Array.from(firstMessages), ...Array.from(secondMessages)];
            });

            const messages = await Effect.runPromise(testWithFreshDeviceRegistry(ruuviTagSettings, program));
            expect(messages).toMatchSnapshot();
        });
    });

    describe("packet deduplication", () => {
        let cache: RuuvitagDataFormatDeviceFilter;

        const airQualitySettings = {
            ...ruuviTagSettings,
            allow_unknown: true,
            devices: [
                {
                    id: "a1:b2",
                    name: "my_air_quality_ruuvitag",
                    model: "air-quality" as const,
                },
            ],
        };

        beforeEach(() => {
            cache = new RuuvitagDataFormatDeviceFilter();
        });

        it("should process data format E1 packets normally", async () => {
            const program = Effect.gen(function* () {
                const gateway = makeRuuvitagGateway(airQualitySettings, cache);
                const messages = yield* gateway(formatE1Peripheral);
                return Array.from(messages);
            });

            const messages = await Effect.runPromise(testWithFreshDeviceRegistry(airQualitySettings, program));
            expect(messages).toHaveLength(2);
            expect(messages).toEqual([
                expect.objectContaining({ type: "availability" }),
                expect.objectContaining({ type: "sensor-data" }),
            ]);
        });

        it("should process data format 6 packets when no E1 has been seen", async () => {
            const program = Effect.gen(function* () {
                const gateway = makeRuuvitagGateway(airQualitySettings, cache);
                const messages = yield* gateway(format6Peripheral);
                return Array.from(messages);
            });

            const deviceRegistry = makeRuuvitagDeviceRegistry(airQualitySettings, {
                defaultDecimalPrecision: 2,
            });

            const TestLayerWithDeviceRegistry = Layer.merge(
                TestLayer,
                Layer.succeed(DeviceRegistryService, deviceRegistry)
            );

            const messages = await Effect.runPromise(Effect.provide(program, TestLayerWithDeviceRegistry));
            expect(messages).toHaveLength(2);
            expect(messages).toEqual([
                expect.objectContaining({ type: "availability" }),
                expect.objectContaining({ type: "sensor-data" }),
            ]);
        });

        it("should discard data format 6 packets after E1 packet is received", async () => {
            const program = Effect.gen(function* () {
                const gateway = makeRuuvitagGateway(airQualitySettings, cache);

                const e1Messages = yield* gateway(formatE1Peripheral);
                expect(Array.from(e1Messages)).toHaveLength(2);

                const format6Messages = yield* gateway(format6Peripheral);
                return Array.from(format6Messages);
            });

            const messages = await Effect.runPromise(testWithFreshDeviceRegistry(airQualitySettings, program));
            expect(messages).toHaveLength(0);
        });

        it("should process data format 6 packets after E1 cache expires", async () => {
            const program = Effect.gen(function* () {
                const gateway = makeRuuvitagGateway(airQualitySettings, cache);

                const e1Messages = yield* gateway(formatE1Peripheral);
                expect(Array.from(e1Messages)).toHaveLength(2);

                // Advance time by 6 minutes (past 5-minute TTL)
                Settings.now = () => new Date("2019-10-10T00:06:00.000Z").valueOf();

                const format6Messages = yield* gateway(format6Peripheral);
                return Array.from(format6Messages);
            });

            const messages = await Effect.runPromise(testWithFreshDeviceRegistry(airQualitySettings, program));
            expect(messages).toHaveLength(1);
            expect(messages).toEqual([expect.objectContaining({ type: "sensor-data" })]);
        });

        it("should handle different devices independently", async () => {
            const multiDeviceSettings = {
                ...airQualitySettings,
                devices: [
                    {
                        id: "a1:b2",
                        name: "ruuvi_1",
                        model: "air-quality" as const,
                    },
                    {
                        id: "c3:d4",
                        name: "ruuvi_2",
                        model: "air-quality" as const,
                    },
                ],
            };

            const device2FormatE1 = {
                ...formatE1Peripheral,
                address: "c3:d4",
                uuid: "c3:d4",
            } as Peripheral;

            const device2Format6 = {
                ...format6Peripheral,
                address: "c3:d4",
                uuid: "c3:d4",
            } as Peripheral;

            const program = Effect.gen(function* () {
                const gateway = makeRuuvitagGateway(multiDeviceSettings, cache);

                const device1E1Messages = yield* gateway(formatE1Peripheral);
                expect(Array.from(device1E1Messages)).toHaveLength(2);

                const device2Format6Messages = yield* gateway(device2Format6);
                expect(Array.from(device2Format6Messages)).toHaveLength(2);

                const device1Format6Messages = yield* gateway(format6Peripheral);
                expect(Array.from(device1Format6Messages)).toHaveLength(0);

                const device2E1Messages = yield* gateway(device2FormatE1);
                return Array.from(device2E1Messages);
            });

            const deviceRegistry = makeRuuvitagDeviceRegistry(multiDeviceSettings, {
                defaultDecimalPrecision: 2,
            });

            const TestLayerWithDeviceRegistry = Layer.merge(
                TestLayer,
                Layer.succeed(DeviceRegistryService, deviceRegistry)
            );

            const messages = await Effect.runPromise(Effect.provide(program, TestLayerWithDeviceRegistry));
            expect(messages).toHaveLength(1);
            expect(messages).toEqual([expect.objectContaining({ type: "sensor-data" })]);
        });
    });

    describe("getUnavailableDevices()", () => {
        beforeEach(() => {
            jest.useFakeTimers();
            mockedUuid.mockReturnValue("mock-uuid");
            Settings.now = () => new Date("2019-10-10T00:00:00.000Z").valueOf();
        });

        afterEach(() => {
            jest.useRealTimers();
            Settings.now = originalNow;
        });

        it("should produce unavailability messages for ruuvitags that haven't been observed inside timeout", async () => {
            const deviceRegistry = makeRuuvitagDeviceRegistry(ruuviTagSettings, {
                defaultDecimalPrecision: 2,
            });

            const program = Effect.gen(function* () {
                const gateway = makeRuuvitagGateway(ruuviTagSettings);
                const messages = yield* gateway(peripheral);
                expect(Array.from(messages)).toHaveLength(2);
            });

            const TestLayerWithDeviceRegistry = Layer.merge(
                TestLayer,
                Layer.succeed(DeviceRegistryService, deviceRegistry)
            );

            await Effect.runPromise(Effect.provide(program, TestLayerWithDeviceRegistry));

            Settings.now = () => new Date("2019-10-10T00:01:00.000Z").valueOf(); // Advance 1 minute
            const unavailableDevices = deviceRegistry.getUnavailableDevices();
            expect(unavailableDevices).toMatchSnapshot();
        });
    });
});
