jest.mock("../../config", () => ({
    __esModule: true,
    getConfiguration: jest.fn().mockImplementation(() => {
        return {
            decimal_precision: 2,
        };
    }),
}));

import { RuuviTagGateway } from "./ruuvitag-gateway";
import { Peripheral } from "@abandonware/noble";
import { take, toArray } from "rxjs";
import { DeviceAvailabilityMessage, DeviceSensorMessage, MessageType } from "../../types";
import { DateTime, Settings } from "luxon";
import { v4 as uuid } from "uuid";
import { TestScheduler } from "rxjs/testing";

const ruuviTagUuid = "a1:b2";
const defaultTimeout = 30000;
const makeRuuviTagGateway = (allowUnkownRuuviTags = false) => {
    return new RuuviTagGateway(
        [
            {
                id: ruuviTagUuid,
                name: "my_ruuvitag",
            },
        ],
        defaultTimeout,
        allowUnkownRuuviTags
    );
};

jest.mock("uuid");
const mockedUuid = uuid as jest.Mock;

describe("RuuviTag Gateway", () => {
    const originalNow = Settings.now;
    const peripheral = {
        advertisement: {
            manufacturerData: Buffer.from("99040512FC5394C37C0004FFFC040CAC364200CDCBB8334C884F", "hex"),
        },
        address: ruuviTagUuid,
        rssi: 23,
        uuid: ruuviTagUuid,
    } as Peripheral;

    describe("handleBleAdvertisement()", () => {
        beforeEach(() => {
            Settings.now = () => new Date("2019-10-10T00:00:00.000Z").valueOf();
            Settings.defaultZone = "UTC";
            mockedUuid.mockReturnValue("mock-uuid");
        });

        afterEach(() => {
            Settings.now = originalNow;
            jest.resetAllMocks();
        });

        it("should produce a availability and a payload message for a found ruuvitag advertisement", (done) => {
            const gateway = makeRuuviTagGateway();

            gateway
                .handleBleAdvertisement(peripheral)
                .pipe(toArray())
                .subscribe((messages) => {
                    expect(messages).toMatchSnapshot();
                    done();
                });
        });

        it("should complete if unknown ruuvitags arent allowed and the ruuvitag that is advertising is not configured", (done) => {
            const gateway = makeRuuviTagGateway();
            const testScheduler = new TestScheduler((actual, expected) => {
                expect(actual).toEqual(expected);
            });

            testScheduler.run((helpers) => {
                helpers
                    .expectObservable(
                        gateway.handleBleAdvertisement({ ...peripheral, uuid: "no-such-ruuvitag" } as Peripheral)
                    )
                    .toBe("|");
                done();
            });

            return;
        });

        it("should not produce the availability message twice if the ruuvitag availability has not changed", () => {
            const gateway = makeRuuviTagGateway();
            const observedMessages: (DeviceSensorMessage | DeviceAvailabilityMessage | null)[] = [];

            gateway.handleBleAdvertisement(peripheral).subscribe((message) => {
                observedMessages.push(message);
            });

            gateway.handleBleAdvertisement(peripheral).subscribe((message) => {
                observedMessages.push(message);
            });

            expect(observedMessages).toHaveLength(3);
            expect(observedMessages[0]?.type).toEqual(MessageType.Availability);
            expect(observedMessages[1]?.type).toEqual(MessageType.SensorData);
            expect(observedMessages[2]?.type).toEqual(MessageType.SensorData);
        });

        it("should handle unknown ruuvitags normally if unknown ruuvitags are allowed", () => {
            const unknownPeripheral = {
                ...peripheral,
                uuid: "unknown",
            } as Peripheral;

            const gateway = makeRuuviTagGateway(true);
            const observedMessages: (DeviceSensorMessage | DeviceAvailabilityMessage | null)[] = [];

            gateway.handleBleAdvertisement(unknownPeripheral).subscribe((message) => {
                observedMessages.push(message);
            });

            gateway.handleBleAdvertisement(unknownPeripheral).subscribe((message) => {
                observedMessages.push(message);
            });

            expect(observedMessages).toMatchSnapshot();
        });
    });

    describe("observeUnavailableDevices()", () => {
        beforeEach(() => {
            jest.useFakeTimers();
            mockedUuid.mockReturnValue("mock-uuid");
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it("should produce unavailability messages for ruuvitags that haven't been observed inside timeout", (done) => {
            const gateway = makeRuuviTagGateway();
            gateway
                .handleBleAdvertisement(peripheral)
                .pipe(toArray())
                .subscribe((messages) => {
                    expect(messages).toHaveLength(2);
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
