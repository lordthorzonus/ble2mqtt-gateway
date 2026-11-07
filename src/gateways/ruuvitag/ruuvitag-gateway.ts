import { DeviceRegistry } from "../device-registry.js";
import { DeviceType } from "../../types.js";
import { transformRuuviTagSensorDataToDeviceMessage } from "./ruuvitag-measurement-transformer.js";
import { RuuviTagGatewayConfiguration } from "../../config.js";
import { handleBleAdvertisement, requireManufacturerData } from "../gateway-helpers.js";
import { Effect } from "effect";
import { GatewayError, MapMessage } from "../ble-gateway.js";
import { parse, parseRuuviDataFormat, RuuvitagSensorProtocolDataFormat } from "./ruuvitag-parser/index.js";
import { RuuvitagDataFormatDeviceFilter } from "./ruuvitag-data-format-device-filter.js";

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
            const validPeripheral = yield* requireManufacturerData(peripheral);
            const dataFormat = yield* parseRuuviDataFormat(validPeripheral.advertisement.manufacturerData);

            const deviceId = validPeripheral.uuid;

            if (dataFormat === RuuvitagSensorProtocolDataFormat.DataFormatE1) {
                ruuvitagDataFormatDeviceFilter.markE1FormatSeen(deviceId);
            }

            if (ruuvitagDataFormatDeviceFilter.shouldDiscardPeripheral(deviceId, dataFormat)) {
                return yield* Effect.succeed([]);
            }

            return yield* handleBleAdvertisement(validPeripheral, {
                deviceType: DeviceType.Ruuvitag,
                unknownDevices: ruuviTagSettings.allow_unknown ? "allow" : "ignore",
                parseAdvertisement: (peripheralWithData) => parse(peripheralWithData.advertisement.manufacturerData),
                resolveDeviceModel: (_peripheral, sensorData) => sensorData.type,
                handleDeviceSensorData: (peripheralWithData, deviceRegistryEntry, sensorData) =>
                    Effect.succeed(
                        transformRuuviTagSensorDataToDeviceMessage(peripheralWithData, deviceRegistryEntry, sensorData)
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
                InvalidRuuviDataLengthError: (error) =>
                    new GatewayError({
                        peripheral,
                        message: `Invalid Ruuvi data length for ${error.dataFormat === null ? "header" : `data format ${error.dataFormat}`}: ${error.length}, expected at least ${error.minimumLength}`,
                    }),
            })
        );
