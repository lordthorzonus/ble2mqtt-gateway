import { getStubPeripheral } from "./miflora-parser/index.test";
import { MiFloraGateway } from "./miflora-gateway";
import { DateTime, Settings } from "luxon";
import { v4 as uuid } from "uuid";
import { take, toArray } from "rxjs";
import { TestScheduler } from "rxjs/testing";
import { Peripheral } from "@abandonware/noble";

jest.mock("uuid");
const mockedUuid = uuid as jest.Mock;
const defaultTimeout = 30000;

const makeMiFloraGateway = () => {
    return new MiFloraGateway([{ id: "a", name: "flower" }], defaultTimeout);
};

describe("MiFlora Gateway", () => {
    const originalNow = Settings.now;
    const moisturePeripheralAdvertisement = getStubPeripheral("71209800a864aed0a8654c0d08100112", "a");
    const soilConductivityPeripheralAdvertisement = getStubPeripheral("71209800b1cf076e8d7cc40d091002c600", "a");
    const temperaturePeripheralAdvertisement = getStubPeripheral("71209800239c066e8d7cc40d0410020401", "a");
    const illuminancePeripheralAdvertisement = getStubPeripheral("71209800c3cf076e8d7cc40d071003370000", "a");

    describe("handleBleAdvertisement()", () => {
        const testScheduler = new TestScheduler((actual, expected) => {
            expect(actual).toEqual(expected);
        });

        beforeEach(() => {
            Settings.now = () => new Date("2019-10-10T00:00:00.000Z").valueOf();
            Settings.defaultZone = "UTC";
            mockedUuid.mockReturnValue("mock-uuid");
        });

        afterEach(() => {
            Settings.now = originalNow;
            jest.resetAllMocks();
        });

        it.each([
            ["Moisture event", moisturePeripheralAdvertisement],
            ["Soil Conductivity event", soilConductivityPeripheralAdvertisement],
            ["Temperature event", temperaturePeripheralAdvertisement],
            ["Illuminance event", illuminancePeripheralAdvertisement],
        ])(
            "should produce an availability message when receiving %s as the first advertisement from the sensor",
            (_, advertisement) => {
                const gateway = makeMiFloraGateway();

                return new Promise((resolve) => {
                    gateway
                        .handleBleAdvertisement(advertisement)
                        .pipe(toArray())
                        .subscribe((messages) => {
                            expect(messages).toMatchSnapshot();
                            resolve(null);
                        });
                });
            }
        );

        it("should complete without emiting messages if unknown miflora advertisement is received ", (done) => {
            const gateway = makeMiFloraGateway();

            testScheduler.run((helpers) => {
                helpers
                    .expectObservable(
                        gateway.handleBleAdvertisement({
                            ...moisturePeripheralAdvertisement,
                            uuid: "no-such-miflora",
                        } as Peripheral)
                    )
                    .toBe("|");
                done();
            });
        });

        it("should not emit the device message until all sensor events are received once", (done) => {
            const gateway = makeMiFloraGateway();
            testScheduler.run((helpers) => {
                helpers.expectObservable(gateway.handleBleAdvertisement(moisturePeripheralAdvertisement)).toBe("(a|)", {
                    a: expect.objectContaining({ type: "availability" }),
                });
                helpers.expectObservable(gateway.handleBleAdvertisement(temperaturePeripheralAdvertisement)).toBe("|");
                helpers.expectObservable(gateway.handleBleAdvertisement(illuminancePeripheralAdvertisement)).toBe("|");
                helpers.expectObservable(gateway.handleBleAdvertisement(illuminancePeripheralAdvertisement)).toBe("|");
                helpers
                    .expectObservable(gateway.handleBleAdvertisement(soilConductivityPeripheralAdvertisement))
                    .toBe("(a|)", {
                        a: expect.objectContaining({
                            device: expect.objectContaining({ friendlyName: "flower", id: "a" }),
                            type: "sensor-data",
                            id: "mock-uuid",
                            payload: {
                                illuminance: 55,
                                moisture: 18,
                                soilConductivity: 198,
                                temperature: 26,
                            },
                        }),
                    });
                done();
            });
        });
    });
    describe("isMiFloraPeripheral()", () => {});
    describe("observeUnavailableDevices()", () => {
        beforeEach(() => {
            jest.useFakeTimers();
            mockedUuid.mockReturnValue("mock-uuid");
        });

        afterEach(() => {
            jest.useRealTimers();
            jest.resetAllMocks();
        });

        it("should produce unavailability messages for ruuvitags that haven't been observed inside timeout", (done) => {
            const gateway = makeMiFloraGateway();
            gateway
                .handleBleAdvertisement(moisturePeripheralAdvertisement)
                .pipe(toArray())
                .subscribe((messages) => {
                    expect(messages.length).toEqual(1);
                });

            gateway
                .observeUnavailableDevices()
                .pipe(take(1))
                .subscribe((message) => {
                    expect(message).toMatchSnapshot({
                        time: expect.any(DateTime),
                    });
                    done();
                });

            jest.advanceTimersByTime(defaultTimeout + 10000);
        });
    });
});
