import { DeviceRegistry } from "../device-registry";
import { Peripheral } from "@abandonware/noble";
import { DeviceType } from "../../types";
import { transformPeripheralAdvertisementToSensorDataDeviceMessage } from "./ruuvitag-measurement-transformer";
import { RuuviTagGatewayConfiguration } from "../../config";
import { handleBleAdvertisement } from "../gateway-helpers";
import { Data, Effect } from "effect";
import { GatewayError, MapMessage } from "../ble-gateway";

export interface PeripheralWithManufacturerData extends Peripheral {
    advertisement: Omit<Peripheral["advertisement"], "manufacturerData"> & {
        manufacturerData: Buffer;
    };
}

export class PeripheralWithoutManufacturerDataError extends Data.TaggedError("PeripheralWithoutManufacturerDataError")<{
    peripheral: Peripheral;
}> {}

const validatePeripheral = (
    peripheral: Peripheral
): Effect.Effect<PeripheralWithManufacturerData, PeripheralWithoutManufacturerDataError> => {
    if (peripheral.advertisement.manufacturerData === undefined) {
        return new PeripheralWithoutManufacturerDataError({ peripheral });
    }

    return Effect.succeed(peripheral as PeripheralWithManufacturerData);
};

export const makeRuuvitagDeviceRegistry = (
    ruuviTagSettings: NonNullable<RuuviTagGatewayConfiguration>,
    globalDefaults: {
        defaultDecimalPrecision: number;
    }
): DeviceRegistry => {
    const deviceSettings = ruuviTagSettings.devices.map((tag) => ({
        device: {
            id: tag.id,
            type: DeviceType.Ruuvitag,
            friendlyName: tag.name,
        },
        timeout: tag.timeout,
    }));
    const defaultDecimalPrecision = ruuviTagSettings.decimal_precision ?? globalDefaults.defaultDecimalPrecision;

    return new DeviceRegistry(deviceSettings, ruuviTagSettings.timeout, defaultDecimalPrecision);
};

export const makeRuuvitagGateway =
    (ruuviTagSettings: NonNullable<RuuviTagGatewayConfiguration>): MapMessage =>
    (peripheral) =>
        Effect.flatMap(validatePeripheral(peripheral), (p) =>
            handleBleAdvertisement(
                p,
                DeviceType.Ruuvitag,
                ruuviTagSettings.allow_unknown,
                transformPeripheralAdvertisementToSensorDataDeviceMessage
            )
        ).pipe(
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
                NotValidRuuviManufacturerIdError: (error) =>
                    new GatewayError({
                        peripheral,
                        message: `Invalid Ruuvi manufacturer ID: ${error.manufacturerId}`,
                    }),
                UnsupportedDataFormatError: (error) =>
                    new GatewayError({
                        peripheral,
                        message: `Unsupported Ruuvi data format: ${error.dataFormat}`,
                    }),
            })
        );
