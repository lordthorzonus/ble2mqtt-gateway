import { DateTime, DurationLike, Settings } from "luxon";
import { TestScheduler } from "rxjs/testing";
import { AnalyticsStatistics, GatewayAnalytics } from "./gateway-analytics";
import { take } from "rxjs";
import { DeviceType } from "../../types";

const getTestScheduler = () =>
    new TestScheduler((actual, expected) => {
        expect(actual).toEqual(expected);
    });

describe("Gateway analytics", () => {
    const originalNow = Settings.now;
    const now = DateTime.utc(2022, 1, 1, 1, 1, 1);

    beforeEach(() => {
        Settings.defaultZone = "UTC";
    });

    afterEach(() => {
        Settings.now = originalNow;
    });

    const bleTestCases: [string, DurationLike, AnalyticsStatistics["bleAdvertisements"]][] = [
        ["perSecond", { seconds: 1 }, { perSecond: 2, perMinute: 4, perHour: 4 }],
        [
            "perSecond when events occur every millisecond",
            { millisecond: 1 },
            { perSecond: 4, perMinute: 4, perHour: 4 },
        ],
        ["perMinute", { minutes: 1 }, { perSecond: 2, perMinute: 2, perHour: 4 }],
        ["perHour", { hour: 1 }, { perSecond: 2, perMinute: 2, perHour: 2 }],
    ];

    it.each(bleTestCases)(
        "should record bluetooth advertisement event statistics correctly %s",
        (_, duration, expected) => {
            const testScheduler = getTestScheduler();
            const analytics = new GatewayAnalytics();

            Settings.now = () => now.valueOf();
            analytics.recordBluetoothAdvertisement();
            analytics.recordBluetoothAdvertisement();

            Settings.now = () => now.plus(duration).valueOf();
            analytics.recordBluetoothAdvertisement();
            analytics.recordBluetoothAdvertisement();

            return testScheduler.run((helpers) => {
                const expectedStatistics = expect.objectContaining({
                    bleAdvertisements: expected,
                });
                helpers.expectObservable(analytics.observeAnalytics().pipe(take(2))).toBe("10000ms a 9999ms (b|)", {
                    a: expectedStatistics,
                    b: expectedStatistics,
                });
            });
        }
    );

    const deviceMessageTestCases: [string, DurationLike, Pick<AnalyticsStatistics, "deviceMessages" | DeviceType>][] = [
        [
            "perSecond",
            { seconds: 1 },
            {
                deviceMessages: {
                    perHour: 6,
                    perMinute: 6,
                    perSecond: 3,
                },
                [DeviceType.Ruuvitag]: {
                    perHour: 2,
                    perMinute: 2,
                    perSecond: 1,
                },
                [DeviceType.MiFlora]: {
                    perHour: 4,
                    perMinute: 4,
                    perSecond: 2,
                },
            },
        ],
        [
            "perSecond when events occur every millisecond",
            { millisecond: 1 },
            {
                deviceMessages: {
                    perHour: 6,
                    perMinute: 6,
                    perSecond: 6,
                },
                [DeviceType.Ruuvitag]: {
                    perHour: 2,
                    perMinute: 2,
                    perSecond: 2,
                },
                [DeviceType.MiFlora]: {
                    perHour: 4,
                    perMinute: 4,
                    perSecond: 4,
                },
            },
        ],
        [
            "perMinute",
            { minutes: 1 },
            {
                deviceMessages: {
                    perHour: 6,
                    perMinute: 3,
                    perSecond: 3,
                },
                [DeviceType.Ruuvitag]: {
                    perHour: 2,
                    perMinute: 1,
                    perSecond: 1,
                },
                [DeviceType.MiFlora]: {
                    perHour: 4,
                    perMinute: 2,
                    perSecond: 2,
                },
            },
        ],
        [
            "perHour",
            { hour: 1 },
            {
                deviceMessages: {
                    perHour: 3,
                    perMinute: 3,
                    perSecond: 3,
                },
                [DeviceType.Ruuvitag]: {
                    perHour: 1,
                    perMinute: 1,
                    perSecond: 1,
                },
                [DeviceType.MiFlora]: {
                    perHour: 2,
                    perMinute: 2,
                    perSecond: 2,
                },
            },
        ],
    ];

    it.each(deviceMessageTestCases)("should record deviceMessage analytics correctly %2", (_, duration, expected) => {
        const testScheduler = getTestScheduler();
        const analytics = new GatewayAnalytics();

        Settings.now = () => now.valueOf();
        analytics.recordDeviceMessage(DeviceType.Ruuvitag);
        analytics.recordDeviceMessage(DeviceType.MiFlora);
        analytics.recordDeviceMessage(DeviceType.MiFlora);

        Settings.now = () => now.plus(duration).valueOf();
        analytics.recordDeviceMessage(DeviceType.Ruuvitag);
        analytics.recordDeviceMessage(DeviceType.MiFlora);
        analytics.recordDeviceMessage(DeviceType.MiFlora);

        return testScheduler.run((helpers) => {
            const expectedStatistics = expect.objectContaining(expected);
            helpers.expectObservable(analytics.observeAnalytics().pipe(take(2))).toBe("10000ms a 9999ms (b|)", {
                a: expectedStatistics,
                b: expectedStatistics,
            });
        });
    });
});
