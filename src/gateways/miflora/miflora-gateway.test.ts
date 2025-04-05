import { Effect, Layer } from "effect";
import { getStubPeripheralWithServiceData } from "./miflora-parser/index.test";
import { makeMiFloraGateway, isMiFloraPeripheral, makeMiFloraDeviceRegistry } from "./miflora-gateway";
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
    miflora: {
        timeout: defaultTimeout,
        devices: [
            {
                id: "a",
                name: "flower",
            },
        ],
    },
};

const mifloraSettings = validGatewayConfiguration.miflora;

if (!mifloraSettings) {
    throw new Error("MiFlora configuration is required for this test");
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

describe("MiFlora Gateway", () => {
    const originalNow = Settings.now;
    const moisturePeripheralAdvertisement = getStubPeripheralWithServiceData("71209800a864aed0a8654c0d08100112", "a");
    const soilConductivityPeripheralAdvertisement = getStubPeripheralWithServiceData(
        "71209800b1cf076e8d7cc40d091002c600",
        "a"
    );
    const temperaturePeripheralAdvertisement = getStubPeripheralWithServiceData(
        "71209800239c066e8d7cc40d0410020401",
        "a"
    );
    const illuminancePeripheralAdvertisement = getStubPeripheralWithServiceData(
        "71209800c3cf076e8d7cc40d071003370000",
        "a"
    );

    beforeEach(() => {
        Settings.now = () => new Date("2019-10-10T00:00:00.000Z").valueOf();
        Settings.defaultZone = "UTC";
        mockedUuid.mockReturnValue("mock-uuid");
    });

    afterEach(() => {
        Settings.now = originalNow;
        jest.resetAllMocks();
    });

    describe("handleBleAdvertisement()", () => {
        it.each([
            ["Moisture event", moisturePeripheralAdvertisement],
            ["Soil Conductivity event", soilConductivityPeripheralAdvertisement],
            ["Temperature event", temperaturePeripheralAdvertisement],
            ["Illuminance event", illuminancePeripheralAdvertisement],
        ])(
            "should produce an availability message when receiving %s as the first advertisement from the sensor",
            async (_, advertisement) => {
                const program = Effect.gen(function* () {
                    const gateway = makeMiFloraGateway(mifloraSettings);
                    const messages = yield* gateway(advertisement);
                    return Array.from(messages);
                });

                const TestLayerWithDeviceRegistry = Layer.merge(
                    TestLayer,
                    Layer.succeed(
                        DeviceRegistryService,
                        makeMiFloraDeviceRegistry(mifloraSettings, {
                            defaultDecimalPrecision: 2,
                        })
                    )
                );

                const messages = await Effect.runPromise(Effect.provide(program, TestLayerWithDeviceRegistry));
                expect(messages).toMatchSnapshot();
            }
        );

        it("should complete without emitting messages if unknown miflora advertisement is received", async () => {
            const TestLayerWithDeviceRegistry = Layer.merge(
                TestLayer,
                Layer.succeed(
                    DeviceRegistryService,
                    makeMiFloraDeviceRegistry(mifloraSettings, {
                        defaultDecimalPrecision: 2,
                    })
                )
            );

            const program = Effect.gen(function* () {
                const gateway = makeMiFloraGateway(mifloraSettings);
                const messages = yield* gateway({
                    ...moisturePeripheralAdvertisement,
                    uuid: "no-such-miflora",
                } as Peripheral);
                return Array.from(messages);
            });

            const messages = await Effect.runPromise(Effect.provide(program, TestLayerWithDeviceRegistry));
            expect(messages).toHaveLength(0);
        });

        it("should not emit the device message until all sensor events are received once", async () => {
            const program = Effect.gen(function* () {
                const gateway = makeMiFloraGateway(mifloraSettings);

                // First message should be availability
                const firstMessages = yield* gateway(moisturePeripheralAdvertisement);
                const firstMessage = Array.from(firstMessages)[0];
                expect(firstMessage).toEqual(expect.objectContaining({ type: "availability" }));

                // Subsequent messages should be empty until all sensors are received
                const secondMessages = yield* gateway(temperaturePeripheralAdvertisement);
                expect(Array.from(secondMessages)).toHaveLength(0);

                const thirdMessages = yield* gateway(illuminancePeripheralAdvertisement);
                expect(Array.from(thirdMessages)).toHaveLength(0);

                const fourthMessages = yield* gateway(illuminancePeripheralAdvertisement);
                expect(Array.from(fourthMessages)).toHaveLength(0);

                // Final message should contain all sensor data
                const finalMessages = yield* gateway(soilConductivityPeripheralAdvertisement);
                const finalMessage = Array.from(finalMessages)[0];
                expect(finalMessage).toEqual(
                    expect.objectContaining({
                        device: expect.objectContaining({ friendlyName: "flower", id: "a" }),
                        type: "sensor-data",
                        id: "mock-uuid",
                        payload: {
                            illuminance: 55,
                            moisture: 18,
                            soilConductivity: 198,
                            temperature: 26,
                            lowBatteryWarning: false,
                        },
                    })
                );
            });
            const TestLayerWithDeviceRegistry = Layer.merge(
                TestLayer,
                Layer.succeed(
                    DeviceRegistryService,
                    makeMiFloraDeviceRegistry(mifloraSettings, {
                        defaultDecimalPrecision: 2,
                    })
                )
            );

            await Effect.runPromise(Effect.provide(program, TestLayerWithDeviceRegistry));
        });
    });

    describe("isMiFloraPeripheral()", () => {
        it.each([
            [true, { advertisement: { localName: "Flower care" } }],
            [true, { advertisement: { localName: "Flower Care" } }],
            [true, { advertisement: { localName: "Flower mate" } }],
            [true, { address: "c4:7c:8d:6e:06:9c", advertisement: { localName: "" } }],
            [false, { address: "c6:2c:8d:6e:06:9c", advertisement: { localName: "" } }],
            [false, { address: "", advertisement: { localName: "Bro mate" } }],
        ])("should return %s for peripheral %j", (expectedValue, peripheral) => {
            expect(isMiFloraPeripheral(peripheral as Peripheral)).toEqual(expectedValue);
        });
    });
});
