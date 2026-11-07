import { DeviceRegistry, DeviceRegistryEntry } from "../device-registry.js";
import { DeviceType, MessageType, OralBSensorMessage } from "../../types.js";
import { OralBGatewayConfiguration } from "../../config.js";
import { handleBleAdvertisement, PeripheralWithManufacturerData, requireManufacturerData } from "../gateway-helpers.js";
import { Effect, Option } from "effect";
import { GatewayError, MapMessage } from "../ble-gateway.js";
import { OralBAdvertisement, parseOralBAdvertisement, toOralBSensorData } from "./oralb-parser.js";
import { OralBModel, ResolvedOralBModel, UNKNOWN_ORALB_MODEL } from "./oralb-sensor-data.js";
import { v4 as uuid } from "uuid";
import { DateTime } from "luxon";

/**
 * Devices without a configured model are registered with the unknown model. Sensor messages carry the
 * model resolved for each advertisement instead.
 */
export const makeOralbDeviceRegistry = (
    oralbSettings: NonNullable<OralBGatewayConfiguration>,
    globalDefaults: {
        defaultDecimalPrecision: number;
    }
): DeviceRegistry => {
    const deviceSettings = oralbSettings.devices.map((device) => ({
        device: {
            id: device.id,
            type: DeviceType.OralB,
            friendlyName: device.name,
            model: device.model ?? UNKNOWN_ORALB_MODEL,
        },
        timeout: device.timeout,
    }));

    return new DeviceRegistry(deviceSettings, oralbSettings.timeout, globalDefaults.defaultDecimalPrecision);
};

const makeResolveDeviceModel =
    (modelOverrides: ReadonlyMap<string, OralBModel>) =>
    (peripheral: PeripheralWithManufacturerData, advertisement: OralBAdvertisement): ResolvedOralBModel =>
        modelOverrides.get(peripheral.uuid) ?? advertisement.detectedModel;

const makeTransformAdvertisementToSensorMessage =
    (resolveDeviceModel: ReturnType<typeof makeResolveDeviceModel>) =>
    (
        peripheral: PeripheralWithManufacturerData,
        deviceRegistryEntry: DeviceRegistryEntry,
        advertisement: OralBAdvertisement
    ): Option.Option<OralBSensorMessage> => {
        const model = resolveDeviceModel(peripheral, advertisement);

        return Option.some({
            id: uuid(),
            device: {
                macAddress: peripheral.address,
                rssi: peripheral.rssi,
                id: deviceRegistryEntry.device.id,
                type: DeviceType.OralB,
                friendlyName: deviceRegistryEntry.device.friendlyName,
                model,
                timeout: deviceRegistryEntry.timeout,
            },
            time: DateTime.now(),
            type: MessageType.SensorData,
            payload: toOralBSensorData(advertisement.rawData, model),
        });
    };

/**
 * A configured model overrides the model detected from the advertisement. The model decides the brushing
 * mode names.
 */
export const makeOralbGateway = (oralbSettings: NonNullable<OralBGatewayConfiguration>): MapMessage => {
    const modelOverrides = new Map(
        oralbSettings.devices.flatMap((device) =>
            device.model === undefined ? [] : ([[device.id, device.model]] as const)
        )
    );

    const resolveDeviceModel = makeResolveDeviceModel(modelOverrides);
    const transformAdvertisementToSensorMessage = makeTransformAdvertisementToSensorMessage(resolveDeviceModel);

    return (peripheral) =>
        Effect.gen(function* () {
            const validPeripheral = yield* requireManufacturerData(peripheral);

            return yield* handleBleAdvertisement(validPeripheral, {
                deviceType: DeviceType.OralB,
                unknownDevices: oralbSettings.allow_unknown ? "allow" : "ignore",
                parseAdvertisement: (peripheralWithData) =>
                    parseOralBAdvertisement(peripheralWithData.advertisement.manufacturerData),
                resolveDeviceModel,
                handleDeviceSensorData: (peripheralWithData, deviceRegistryEntry, advertisement) =>
                    Effect.succeed(
                        transformAdvertisementToSensorMessage(peripheralWithData, deviceRegistryEntry, advertisement)
                    ),
            });
        }).pipe(
            Effect.catchTags({
                PeripheralWithoutManufacturerDataError: (error) =>
                    new GatewayError({
                        peripheral: error.peripheral,
                        message: `Peripheral without manufacturer data: ${peripheral.uuid}`,
                    }),
                DeviceNotFoundError: (error) =>
                    new GatewayError({
                        peripheral,
                        message: `Device not found: ${error.id}`,
                    }),
                NotValidOralBManufacturerIdError: (error) =>
                    new GatewayError({
                        peripheral,
                        message: `Invalid OralB manufacturer ID: ${error.manufacturerId}`,
                    }),
                InvalidOralBDataLengthError: (error) =>
                    new GatewayError({
                        peripheral,
                        message: `Invalid OralB data length: ${error.length}`,
                    }),
            })
        );
};
