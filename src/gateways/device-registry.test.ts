import { DeviceRegistry, DeviceSettings } from "./device-registry";
import { DeviceType } from "../types";
import { Settings } from "luxon";
import { Peripheral } from "@abandonware/noble";

const defaultRuuviTagId = "da21045d81a8";
const defaultTimeout = 30000;
function makeDeviceRegistry(settings: DeviceSettings[] = []) {
    return new DeviceRegistry(
        [
            {
                device: {
                    id: defaultRuuviTagId,
                    type: DeviceType.Ruuvitag,
                    friendlyName: "fridge_ruuvitag",
                },
            },
            ...settings,
        ],
        defaultTimeout,
        2
    );
}

describe("Device Registry", () => {
    describe("has()", () => {
        const deviceRegistry = makeDeviceRegistry();

        it("should return boolean based on does the device with given id exist", () => {
            expect(deviceRegistry.has(defaultRuuviTagId)).toBe(true);
            expect(deviceRegistry.has("da21045d81a9")).toBe(false);
        });
    });

    describe("get()", () => {
        const deviceRegistry = makeDeviceRegistry();

        it("should return the given deviceRegistry entry with given id", () => {
            expect(deviceRegistry.get(defaultRuuviTagId)).toEqual({
                availability: "offline",
                decimalPrecision: 2,
                device: {
                    friendlyName: "fridge_ruuvitag",
                    id: defaultRuuviTagId,
                    type: DeviceType.Ruuvitag,
                },
                lastPublishedAvailability: "offline",
                lastSeen: null,
                timeout: 30000,
            });
        });

        it("should return null if the given entry does not exists", () => {
            expect(deviceRegistry.get("da21045d81a9")).toBeNull();
        });
    });

    describe("registerFoundAdvertisement()", () => {
        const deviceRegistry = makeDeviceRegistry();
        const originalNow = Settings.now;

        beforeEach(() => {
            Settings.now = () => new Date("2019-10-10T00:00:00.000Z").valueOf();
        });

        afterEach(() => {
            Settings.now = originalNow;
        });

        it("should mark the device online", () => {
            expect(deviceRegistry.get(defaultRuuviTagId)?.availability).toBe("offline");
            expect(deviceRegistry.get(defaultRuuviTagId)?.lastPublishedAvailability).toBe("offline");
            expect(deviceRegistry.get(defaultRuuviTagId)?.lastSeen).toBeNull();

            deviceRegistry.registerFoundAdvertisement(defaultRuuviTagId);

            expect(deviceRegistry.get(defaultRuuviTagId)?.availability).toBe("online");
            expect(deviceRegistry.get(defaultRuuviTagId)?.lastPublishedAvailability).toBe("offline");
            expect(deviceRegistry.get(defaultRuuviTagId)?.lastSeen?.toUTC().toString()).toBe(
                "2019-10-10T00:00:00.000Z"
            );
        });

        it("should not do anything for non existing device", () => {
            deviceRegistry.registerFoundAdvertisement("123");
            expect(deviceRegistry.get("123")).toBeNull();
        });
    });

    describe("registerDeviceStatusPublished()", () => {
        const deviceRegistry = makeDeviceRegistry();
        const originalNow = Settings.now;

        beforeEach(() => {
            Settings.now = () => new Date("2019-10-10T00:00:00.000Z").valueOf();
        });

        afterEach(() => {
            Settings.now = originalNow;
        });

        it("should mark the devices last status as published", () => {
            expect(deviceRegistry.get(defaultRuuviTagId)?.lastPublishedAvailability).toBe("offline");
            deviceRegistry.registerFoundAdvertisement(defaultRuuviTagId);
            deviceRegistry.registerDeviceStatusPublished(defaultRuuviTagId);

            expect(deviceRegistry.get(defaultRuuviTagId)?.lastPublishedAvailability).toBe("online");
        });

        it("should not do anything for non existing device", () => {
            deviceRegistry.registerDeviceStatusPublished("123");
            expect(deviceRegistry.get("123")).toBeNull();
        });
    });

    describe("getUnavailableDevices()", () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it("should publish the device registry entry after the default timeout", () => {
            const deviceRegistry = makeDeviceRegistry();

            expect(deviceRegistry.get(defaultRuuviTagId)?.availability).toBe("offline");
            deviceRegistry.registerFoundAdvertisement(defaultRuuviTagId);
            expect(deviceRegistry.get(defaultRuuviTagId)?.availability).toBe("online");

            jest.advanceTimersByTime(defaultTimeout + 10000);

            const unavailableDevices = deviceRegistry.getUnavailableDevices();
            const deviceRegistryEntry = unavailableDevices[0];
            expect(deviceRegistryEntry?.device.id).toEqual(defaultRuuviTagId);
            expect(deviceRegistryEntry?.lastPublishedAvailability).toBe("offline");
            expect(deviceRegistryEntry?.availability).toBe("offline");
        });

        it("should respect the timeout given to individual devices", () => {
            const customTimeoutDeviceId = "da21045d81a9";
            const deviceRegistryWithIndividualTimeouts = makeDeviceRegistry([
                {
                    device: {
                        id: customTimeoutDeviceId,
                        type: DeviceType.Ruuvitag,
                        friendlyName: "living_room_ruuvitag",
                    },
                    timeout: 10000,
                },
            ]);

            expect(deviceRegistryWithIndividualTimeouts.get(customTimeoutDeviceId)?.availability).toBe("offline");
            deviceRegistryWithIndividualTimeouts.registerFoundAdvertisement(customTimeoutDeviceId);
            expect(deviceRegistryWithIndividualTimeouts.get(customTimeoutDeviceId)?.availability).toBe("online");

            jest.advanceTimersByTime(20000);
            const unavailableDevices = deviceRegistryWithIndividualTimeouts.getUnavailableDevices();
            const deviceRegistry = unavailableDevices[0];
            expect(deviceRegistry?.device.id).toEqual(customTimeoutDeviceId);
            expect(deviceRegistry?.lastPublishedAvailability).toBe("offline");
            expect(deviceRegistry?.availability).toBe("offline");
        });

        it("should work correctly with multiple devices", () => {
            const deviceRegistry = makeDeviceRegistry([
                {
                    device: {
                        id: "a",
                        type: DeviceType.Ruuvitag,
                        friendlyName: "a",
                    },
                },
                {
                    device: {
                        id: "b",
                        type: DeviceType.Ruuvitag,
                        friendlyName: "b",
                    },
                },
            ]);

            deviceRegistry.registerFoundAdvertisement("a");
            deviceRegistry.registerFoundAdvertisement("b");

            jest.advanceTimersByTime(defaultTimeout + 10000);
            const unavailableDevices = deviceRegistry.getUnavailableDevices();
            expect(unavailableDevices).toHaveLength(2);
            expect(unavailableDevices[0]?.device.id).toBe("a");
            expect(unavailableDevices[1]?.device.id).toBe("b");
        });
    });

    describe("registerUnknownDevice()", () => {
        it("should register the given peripheral as DeviceRegistryEntry", () => {
            const deviceRegistry = makeDeviceRegistry();
            const id = "my-uuid";

            expect(deviceRegistry.get(id)).toBeNull();
            const peripheral = {
                uuid: id,
            };

            deviceRegistry.registerUnknownDevice(peripheral as Peripheral, DeviceType.Ruuvitag);

            expect(deviceRegistry.get(id)?.device.id).toEqual(id);
            expect(deviceRegistry.get(id)?.device.type).toEqual(DeviceType.Ruuvitag);
            expect(deviceRegistry.get(id)?.timeout).toEqual(defaultTimeout);
            expect(deviceRegistry.get(id)?.availability).toBe("offline");
            expect(deviceRegistry.get(id)?.lastPublishedAvailability).toBe("offline");
            expect(deviceRegistry.get(id)?.lastSeen).toBeNull();
        });
    });
});
