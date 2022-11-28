import { DateTime } from "luxon";
import { DeviceType } from "../../types";
import { interval, map, Observable } from "rxjs";

enum AnalyticEventType {
    BLEAdvertisement = "ble-advertisement",
    DeviceMessage = "device-message",
}

type AnalyticsEvent =
    | {
          type: AnalyticEventType.BLEAdvertisement;
          date: DateTime;
      }
    | {
          type: AnalyticEventType.DeviceMessage;
          date: DateTime;
          deviceType: DeviceType;
      };

const filterEventsInLastHour = (event: AnalyticsEvent) => event.date.diffNow("hours").hours > -1;
const filterEventsInLastMinute = (event: AnalyticsEvent) => event.date.diffNow("minutes").minutes > -1;
const filterEventsInLastSecond = (event: AnalyticsEvent) => event.date.diffNow("seconds").seconds > -1;

interface Statistics {
    perHour: number;
    perMinute: number;
    perSecond: number;
}
export type AnalyticsStatistics = {
    [K in DeviceType]: Statistics;
} & {
    bleAdvertisements: Statistics;
    deviceMessages: Statistics;
};

type EventsGroupedByType = {
    [K in DeviceType]: AnalyticsEvent[];
} & { bleAdvertisements: AnalyticsEvent[] };

export class GatewayAnalytics {
    private events: AnalyticsEvent[];

    public constructor() {
        this.events = [];
    }

    public recordBluetoothAdvertisement(): void {
        this.events.push({
            date: DateTime.now(),
            type: AnalyticEventType.BLEAdvertisement,
        });
    }

    public recordDeviceMessage(deviceType: DeviceType): void {
        this.events.push({
            date: DateTime.now(),
            type: AnalyticEventType.DeviceMessage,
            deviceType,
        });
    }

    private clearTooOldEvents() {
        this.events = this.events.filter(filterEventsInLastHour);
    }

    private static calculateStatistics(eventsInHour: AnalyticsEvent[]): Statistics {
        const eventsInMinutes = eventsInHour.filter(filterEventsInLastMinute);
        const eventsInSeconds = eventsInHour.filter(filterEventsInLastSecond);

        return {
            perHour: eventsInHour.length,
            perMinute: eventsInMinutes.length,
            perSecond: eventsInSeconds.length,
        };
    }

    private groupEventsByType(events: AnalyticsEvent[]): EventsGroupedByType {
        const eventsGroupedByType: EventsGroupedByType = {
            [DeviceType.MiFlora]: [],
            [DeviceType.Ruuvitag]: [],
            bleAdvertisements: [],
        };

        return events.reduce((acc, event) => {
            if (event.type === AnalyticEventType.BLEAdvertisement) {
                acc.bleAdvertisements.push(event);
            }

            if (event.type === AnalyticEventType.DeviceMessage) {
                acc[event.deviceType].push(event);
            }
            return acc;
        }, eventsGroupedByType);
    }

    private measureEvents(): AnalyticsStatistics {
        this.clearTooOldEvents();
        const eventsLastHour = this.events;
        const eventsGroupedByType = this.groupEventsByType(eventsLastHour);
        const { bleAdvertisements, ...deviceMessages } = eventsGroupedByType;

        const ruuviTagStatistics = GatewayAnalytics.calculateStatistics(deviceMessages.ruuvitag);
        const miFloraStatistics = GatewayAnalytics.calculateStatistics(deviceMessages.miflora);
        const deviceMessageStatistics: Statistics = {
            perHour: ruuviTagStatistics.perHour + miFloraStatistics.perHour,
            perMinute: ruuviTagStatistics.perMinute + miFloraStatistics.perMinute,
            perSecond: ruuviTagStatistics.perSecond + miFloraStatistics.perSecond,
        };

        return {
            bleAdvertisements: GatewayAnalytics.calculateStatistics(bleAdvertisements),
            [DeviceType.Ruuvitag]: ruuviTagStatistics,
            [DeviceType.MiFlora]: miFloraStatistics,
            deviceMessages: deviceMessageStatistics,
        };
    }

    public observeAnalytics(): Observable<AnalyticsStatistics> {
        return interval(10000).pipe(map(() => this.measureEvents()));
    }
}
