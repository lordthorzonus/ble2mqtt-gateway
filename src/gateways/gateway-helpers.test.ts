import { Data, Effect, Option } from "effect";
import { DeviceRegistry } from "./device-registry";
import { DeviceRegistryService, handleBleAdvertisement } from "./gateway-helpers";
import { Peripheral } from "../infra/ble-scanner";
import { DeviceType, MessageType } from "../types";

class TestParsingError extends Data.TaggedError("TestParsingError")<Record<never, never>> {}

const peripheral: Peripheral = {
    uuid: "aa:aa",
    address: "aa:aa",
    rssi: -50,
    advertisement: { serviceData: [] },
};

const makeRegistry = () =>
    new DeviceRegistry(
        [{ device: { id: "aa:aa", type: DeviceType.Ruuvitag, friendlyName: "fridge", model: "environmental" } }],
        60_000,
        2
    );

const handle = (registry: DeviceRegistry, parseAdvertisement: () => Effect.Effect<string, TestParsingError>) =>
    handleBleAdvertisement(peripheral, {
        deviceType: DeviceType.Ruuvitag,
        unknownDevices: "ignore",
        parseAdvertisement,
        resolveDeviceModel: () => "environmental",
        handleDeviceSensorData: () => Effect.succeed(Option.none()),
    }).pipe(Effect.provideService(DeviceRegistryService, registry), Effect.either, Effect.runSync);

describe("handleBleAdvertisement()", () => {
    it("parses the advertisement once and passes the result to model resolution and sensor handling", () => {
        const parseAdvertisement = jest.fn(() => Effect.succeed("parsed"));
        const resolveDeviceModel = jest.fn(() => "environmental");
        const handleDeviceSensorData = jest.fn(() => Effect.succeed(Option.none()));

        handleBleAdvertisement(peripheral, {
            deviceType: DeviceType.Ruuvitag,
            unknownDevices: "allow",
            parseAdvertisement,
            resolveDeviceModel,
            handleDeviceSensorData,
        }).pipe(Effect.provideService(DeviceRegistryService, makeRegistry()), Effect.runSync);

        expect(parseAdvertisement).toHaveBeenCalledTimes(1);
        expect(handleDeviceSensorData).toHaveBeenCalledWith(peripheral, expect.anything(), "parsed");
    });

    it("does not mark availability published when parsing fails, so the next advertisement sends it", () => {
        const registry = makeRegistry();

        handle(registry, () => Effect.fail(new TestParsingError()));
        expect(registry.get("aa:aa")?.lastPublishedAvailability).toBe("offline");

        const result = handle(registry, () => Effect.succeed("parsed"));
        expect(result._tag === "Right" ? Array.from(result.right) : []).toEqual([
            expect.objectContaining({ type: MessageType.Availability, payload: { state: "online" } }),
        ]);
        expect(registry.get("aa:aa")?.lastPublishedAvailability).toBe("online");
    });

    it("ignores unconfigured devices without parsing when unknown devices are not allowed", () => {
        const parseAdvertisement = jest.fn(() => Effect.succeed("parsed"));

        handleBleAdvertisement(
            { ...peripheral, uuid: "bb:bb" },
            {
                deviceType: DeviceType.Ruuvitag,
                unknownDevices: "ignore",
                parseAdvertisement,
                resolveDeviceModel: () => "environmental",
                handleDeviceSensorData: () => Effect.succeed(Option.none()),
            }
        ).pipe(Effect.provideService(DeviceRegistryService, makeRegistry()), Effect.runSync);

        expect(parseAdvertisement).not.toHaveBeenCalled();
    });
});
