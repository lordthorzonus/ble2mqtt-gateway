import { DeviceRegistry, DeviceRegistryEntry } from "../device-registry";
import { Peripheral } from "../../infra/ble-scanner";
import { DeviceType, MessageType, OralBSensorMessage } from "../../types";
import { OralBGatewayConfiguration } from "../../config";
import { handleBleAdvertisement, DeviceRegistryService } from "../gateway-helpers";
import { Data, Effect, Option } from "effect";
import { GatewayError, MapMessage } from "../ble-gateway";
import { parse, parseOralBModel, OralBParsingError } from "./oralb-parser";
import { decorateOralBSensorData } from "./oralb-sensor-data-decorator";
import { OralBModel } from "./oralb-sensor-data";
import { v4 as uuid } from "uuid";
import { DateTime } from "luxon";

export interface PeripheralWithManufacturerData extends Peripheral {
    advertisement: Omit<Peripheral["advertisement"], "manufacturerData"> & {
        manufacturerData: Buffer;
    };
}

export class DeviceNotFoundError extends Data.TaggedError("DeviceNotFoundError")<{
    id: string;
}> {}

export class PeripheralWithoutManufacturerDataError extends Data.TaggedError("PeripheralWithoutManufacturerDataError")<{
    peripheral: Peripheral;
}> {}

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
            model: device.model ?? "auto",
        },
        timeout: device.timeout,
    }));

    return new DeviceRegistry(deviceSettings, oralbSettings.timeout, globalDefaults.defaultDecimalPrecision);
};

const validatePeripheral = (
    peripheral: Peripheral
): Effect.Effect<PeripheralWithManufacturerData, PeripheralWithoutManufacturerDataError> => {
    if (peripheral.advertisement.manufacturerData === undefined) {
        return new PeripheralWithoutManufacturerDataError({ peripheral });
    }

    return Effect.succeed(peripheral as PeripheralWithManufacturerData);
};

const resolveDeviceModel = (peripheral: PeripheralWithManufacturerData): Effect.Effect<OralBModel, OralBParsingError> =>
    parseOralBModel(peripheral.advertisement.manufacturerData);

const makeTransformPeripheralToSensorMessage =
    (modelOverride: OralBModel | undefined) =>
    (
        peripheral: PeripheralWithManufacturerData,
        deviceRegistryEntry: DeviceRegistryEntry
    ): Effect.Effect<Option.Option<OralBSensorMessage>, OralBParsingError> =>
        Effect.gen(function* () {
            const sensorData = yield* parse(peripheral.advertisement.manufacturerData, modelOverride);
            const decoratedSensorData = decorateOralBSensorData(sensorData);

            const message: OralBSensorMessage = {
                id: uuid(),
                device: {
                    macAddress: peripheral.address,
                    rssi: peripheral.rssi,
                    id: deviceRegistryEntry.device.id,
                    type: DeviceType.OralB,
                    friendlyName: deviceRegistryEntry.device.friendlyName,
                    model: deviceRegistryEntry.device.model,
                    timeout: deviceRegistryEntry.timeout,
                },
                time: DateTime.now(),
                type: MessageType.SensorData,
                payload: decoratedSensorData,
            };

            return Option.some(message);
        });

export const makeOralbGateway =
    (oralbSettings: NonNullable<OralBGatewayConfiguration>): MapMessage =>
    (peripheral) =>
        Effect.gen(function* () {
            const validPeripheral = yield* validatePeripheral(peripheral);
            const deviceRegistry = yield* DeviceRegistryService;
            const deviceEntry = deviceRegistry.get(validPeripheral.uuid);
            const modelOverride =
                deviceEntry && deviceEntry.device.model !== "auto"
                    ? (deviceEntry.device.model as OralBModel)
                    : undefined;

            return yield* handleBleAdvertisement(
                validPeripheral,
                DeviceType.OralB,
                oralbSettings.allow_unknown,
                resolveDeviceModel,
                makeTransformPeripheralToSensorMessage(modelOverride)
            );
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
                UnknownOralBModelError: (error) =>
                    new GatewayError({
                        peripheral,
                        message: `Unknown OralB model: ${error.modelBytes}`,
                    }),
            })
        );
