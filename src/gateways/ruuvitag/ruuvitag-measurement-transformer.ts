import { PeripheralWithManufacturerData } from "@abandonware/noble";
import { v4 as uuid } from "uuid";
import { parse, RuuviParsingError } from "./ruuvitag-parser";
import decorateRuuviTagSensorDataWithCalculatedValues, {
    EnhancedRuuviTagSensorData,
} from "./ruuvitag-sensor-data-decorator";
import { MessageType, DeviceType, RuuvitagSensorMessage } from "../../types";
import { DateTime } from "luxon";
import { DeviceRegistryEntry } from "../device-registry";
import { formatSensorValues } from "./ruuvitag-measurement-formatter";
import { Effect, pipe } from "effect";

export interface RuuviTag {
    macAddress: string;
    id: string;
    rssi: number;
}
const getSensorData = (data: Buffer): Effect.Effect<EnhancedRuuviTagSensorData, RuuviParsingError> =>
    pipe(data, parse, Effect.map(decorateRuuviTagSensorDataWithCalculatedValues), Effect.map(formatSensorValues));

export const transformPeripheralAdvertisementToSensorDataDeviceMessage = (
    peripheral: PeripheralWithManufacturerData,
    deviceRegistryEntry: DeviceRegistryEntry
): Effect.Effect<RuuvitagSensorMessage, RuuviParsingError> =>
    Effect.gen(function* () {
        const sensorData = yield* getSensorData(peripheral.advertisement.manufacturerData);
        const macAddress = sensorData.macAddress ?? peripheral.address;

        return {
            id: uuid(),
            deviceType: DeviceType.Ruuvitag,
            device: {
                macAddress,
                rssi: peripheral.rssi,
                id: deviceRegistryEntry.device.id,
                type: DeviceType.Ruuvitag,
                friendlyName: deviceRegistryEntry.device.friendlyName,
                timeout: deviceRegistryEntry.timeout,
            },
            time: DateTime.now(),
            type: MessageType.SensorData,
            payload: sensorData,
        };
    });
