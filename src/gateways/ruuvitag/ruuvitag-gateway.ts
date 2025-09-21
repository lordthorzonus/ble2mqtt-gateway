import { DeviceRegistry } from "../device-registry";
import { Peripheral } from "@abandonware/noble";
import { DeviceType } from "../../types";
import {
    resolveDeviceModel,
    transformPeripheralAdvertisementToSensorDataDeviceMessage,
} from "./ruuvitag-measurement-transformer";
import { RuuviTagGatewayConfiguration } from "../../config";
import { handleBleAdvertisement } from "../gateway-helpers";
import { Data, Effect } from "effect";
import { GatewayError, MapMessage } from "../ble-gateway";
import { parseRuuviDataFormat, RuuvitagSensorProtocolDataFormat } from "./ruuvitag-parser";
import { RuuvitagDataFormatDeviceFilter } from "./ruuvitag-data-format-device-filter";

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
            model: tag.model,
        },
        timeout: tag.timeout,
    }));
    const defaultDecimalPrecision = ruuviTagSettings.decimal_precision ?? globalDefaults.defaultDecimalPrecision;

    return new DeviceRegistry(deviceSettings, ruuviTagSettings.timeout, defaultDecimalPrecision);
};

export const makeRuuvitagGateway =
    (
        ruuviTagSettings: NonNullable<RuuviTagGatewayConfiguration>,
        ruuvitagDataFormatDeviceFilter: RuuvitagDataFormatDeviceFilter = new RuuvitagDataFormatDeviceFilter()
    ): MapMessage =>
    (peripheral) =>
        Effect.gen(function* () {
            const validPeripheral = yield* validatePeripheral(peripheral);
            const dataFormat = yield* parseRuuviDataFormat(validPeripheral.advertisement.manufacturerData);

            const deviceId = validPeripheral.uuid;

            if (dataFormat === RuuvitagSensorProtocolDataFormat.DataFormatE1) {
                ruuvitagDataFormatDeviceFilter.markE1FormatSeen(deviceId);
            }

            if (ruuvitagDataFormatDeviceFilter.shouldDiscardPeripheral(deviceId, dataFormat)) {
                return yield* Effect.succeed([]);
            }

            return yield* handleBleAdvertisement(
                validPeripheral,
                DeviceType.Ruuvitag,
                ruuviTagSettings.allow_unknown,
                resolveDeviceModel,
                transformPeripheralAdvertisementToSensorDataDeviceMessage
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
