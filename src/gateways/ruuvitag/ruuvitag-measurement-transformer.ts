import { PeripheralWithManufacturerData } from "@abandonware/noble";
import { flow } from "lodash";
import { v4 as uuid } from "uuid";
import parse from "./ruuvitag-parser";
import decorateRuuviTagSensorDataWithCalculatedValues from "./ruuvitag-sensor-data-decorator";
import { DeviceSensorMessage, MessageType, DeviceType } from "../../types";
import { DateTime } from "luxon";
import { DeviceRegistryEntry } from "../device-registry";

export interface RuuviTag {
    macAddress: string;
    id: string;
    rssi: number;
}
const getSensorData = flow(parse, decorateRuuviTagSensorDataWithCalculatedValues);

export const transformPeripheralAdvertisementToSensorDataDeviceMessage = (
    peripheral: PeripheralWithManufacturerData,
    deviceRegistryEntry: DeviceRegistryEntry
): DeviceSensorMessage => {
    const sensorData = getSensorData(peripheral.advertisement.manufacturerData);
    const macAddress = sensorData.macAddress ?? peripheral.address;
    return {
        id: uuid(),
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
};
