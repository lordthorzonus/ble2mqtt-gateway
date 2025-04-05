import { Effect, Layer } from "effect";
import { makeRuuvitagDeviceRegistry, makeRuuvitagGateway } from "./ruuvitag-gateway";
import { Settings } from "luxon";
import { v4 as uuid } from "uuid";
import { Peripheral } from "@abandonware/noble";
import { Logger } from "../../infra/logger";
import { Config, GlobalConfiguration } from "../../config";
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
        program: Effect.Effect<A, E, R>
    ) => {
        const deviceRegistry = makeRuuvitagDeviceRegistry(ruuviTagSettings, {
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

            const messages = await Effect.runPromise(testWithFreshDeviceRegistry(program));
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

            const messages = await Effect.runPromise(testWithFreshDeviceRegistry(program));
            expect(messages).toHaveLength(0);
        });

        it("should not emit the device message until all sensor events are received once", async () =>
            Effect.runPromise(
                testWithFreshDeviceRegistry(
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

            const messages = await Effect.runPromise(testWithFreshDeviceRegistry(program));
            expect(messages).toMatchSnapshot();
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
