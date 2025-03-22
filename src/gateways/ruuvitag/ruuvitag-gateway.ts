import { DeviceRegistry } from "../device-registry";
import { Peripheral, PeripheralWithManufacturerData } from "@abandonware/noble";
import { DeviceType, RuuvitagSensorMessage } from "../../types";
import { transformPeripheralAdvertisementToSensorDataDeviceMessage } from "./ruuvitag-measurement-transformer";
import { Observable } from "rxjs";
import { Config } from "../../config";
import { Gateway } from "../ble-gateway";
import { ruuviTagManufacturerId } from "./ruuvitag-parser/ruuvitag-validator";
import {
    AbstractGateway,
    DeviceRegistryService,
    handleBleAdvertisement,
    DeviceNotFoundError,
    DeviceMessage,
} from "../abstract-gateway";
import { Data, Effect } from "effect";
import { RuuviParsingError } from "./ruuvitag-parser";
type ConfiguredRuuviTags = Required<Config["gateways"]>["ruuvitag"]["devices"];

export class PeripheralWithoutManufacturerDataError extends Data.TaggedError("PeripheralWithoutManufacturerData")<{
    peripheral: Peripheral;
}> {}

const validatePeripheral = (
    peripheral: Peripheral
): Effect.Effect<PeripheralWithManufacturerData, PeripheralWithoutManufacturerDataError> => {
    if (peripheral.advertisement.manufacturerData === undefined) {
        return Effect.fail(new PeripheralWithoutManufacturerDataError({ peripheral }));
    }

    return Effect.succeed(peripheral as PeripheralWithManufacturerData);
};

export const makeRuuviTagGateway = (ruuviTagSettings: Required<Config["gateways"]>["ruuvitag"]) => {
    const deviceSettings = ruuviTagSettings.devices.map((tag) => ({
        device: {
            id: tag.id,
            type: DeviceType.Ruuvitag,
            friendlyName: tag.name,
        },
        timeout: tag.timeout,
    }));

    const deviceRegistry = new DeviceRegistry(deviceSettings, ruuviTagSettings.timeout);

    return (
        peripheral: Peripheral
    ): Effect.Effect<
        Iterable<DeviceMessage>,
        RuuviParsingError | DeviceNotFoundError | PeripheralWithoutManufacturerDataError
    > =>
        Effect.gen(function* () {
            const peripheralWithManufacturerData = yield* validatePeripheral(peripheral);

            return yield* Effect.provideService(
                DeviceRegistryService,
                deviceRegistry
            )(
                handleBleAdvertisement(
                    peripheralWithManufacturerData,
                    DeviceType.Ruuvitag,
                    ruuviTagSettings.allow_unknown,
                    (peripheral, deviceRegistryEntry) =>
                        transformPeripheralAdvertisementToSensorDataDeviceMessage(peripheral, deviceRegistryEntry)
                )
            );
        });
};

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
