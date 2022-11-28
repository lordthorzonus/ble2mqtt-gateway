import { DeviceRegistryEntry } from "./device-registry";
import { Peripheral } from "@abandonware/noble";
import { AnalyticsMessage, DeviceAvailabilityMessage, MessageType } from "../types";
import { v4 as uuid } from "uuid";
import { DateTime } from "luxon";
import { AnalyticsStatistics } from "./analytics/gateway-analytics";

export const generateAvailabilityMessage = (
    deviceRegistryEntry: DeviceRegistryEntry,
    state: "online" | "offline",
    peripheral?: Peripheral
): DeviceAvailabilityMessage => {
    const { id, friendlyName } = deviceRegistryEntry.device;
    return {
        id: uuid(),
        type: MessageType.Availability,
        device: {
            macAddress: peripheral?.address || id,
            id: id,
            friendlyName: friendlyName,
            type: deviceRegistryEntry.device.type,
            rssi: peripheral?.rssi || null,
            timeout: deviceRegistryEntry.timeout,
        },
        time: DateTime.now(),
        payload: {
            state,
        },
    };
};

export const generateAnalyticsMessage = (analytics: AnalyticsStatistics): AnalyticsMessage => {
    return {
        type: MessageType.Analytics,
        time: DateTime.now(),
        payload: analytics,
        id: uuid(),
    };
};
