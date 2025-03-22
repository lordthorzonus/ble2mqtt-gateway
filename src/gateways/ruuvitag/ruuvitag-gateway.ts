import { DeviceRegistry } from "../device-registry";
import { Peripheral, PeripheralWithManufacturerData } from "@abandonware/noble";
import { DeviceType, DeviceMessage } from "../../types";
import { transformPeripheralAdvertisementToSensorDataDeviceMessage } from "./ruuvitag-measurement-transformer";
import { Config } from "../../config";
import { DeviceRegistryService, handleBleAdvertisement, DeviceNotFoundError } from "../abstract-gateway";
import { Data, Effect } from "effect";
import { GatewayError } from "../ble-gateway";

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
    ruuviTagSettings: Required<Config["gateways"]>["ruuvitag"]
): DeviceRegistry => {
    const deviceSettings = ruuviTagSettings.devices.map((tag) => ({
        device: {
            id: tag.id,
            type: DeviceType.Ruuvitag,
            friendlyName: tag.name,
        },
        timeout: tag.timeout,
    }));

    return new DeviceRegistry(deviceSettings, ruuviTagSettings.timeout);
};

export const makeRuuvitagGateway =
    (ruuviTagSettings: Required<Config["gateways"]>["ruuvitag"]) =>
    (peripheral: Peripheral): Effect.Effect<Iterable<DeviceMessage>, GatewayError, DeviceRegistryService> =>
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

// export class RuuviTagGateway extends AbstractGateway implements Gateway {
//     constructor(ruuviTagSettings: ConfiguredRuuviTags, defaultTimeout: number, unknownRuuviTagsAllowed: boolean) {
//         const deviceSettings = ruuviTagSettings.map((tag) => ({
//             device: {
//                 id: tag.id,
//                 type: DeviceType.Ruuvitag,
//                 friendlyName: tag.name,
//             },
//             timeout: tag.timeout,
//         }));

//         super(new DeviceRegistry(deviceSettings, defaultTimeout), unknownRuuviTagsAllowed, DeviceType.Ruuvitag);
//     }

//     public getGatewayId(): number {
//         return ruuviTagManufacturerId;
//     }

//     private validatePeripheral(peripheral: Peripheral): asserts peripheral is PeripheralWithManufacturerData {
//         if (peripheral.advertisement.manufacturerData === undefined) {
//             throw new Error(
//                 `Somehow a peripheral without manufacturingData got into RuuviTagGateway: ${JSON.stringify(peripheral)}`
//             );
//         }
//     }

//     protected handleDeviceSensorData(peripheral: Peripheral): Observable<RuuvitagSensorMessage> {
//         const id = peripheral.uuid;
//         this.validatePeripheral(peripheral);
//         return new Observable((subscriber) => {
//             const device = this.getDeviceRegistryEntry(id);
//             subscriber.next(transformPeripheralAdvertisementToSensorDataDeviceMessage(peripheral, device));
//             subscriber.complete();
//         });
//     }
// }
