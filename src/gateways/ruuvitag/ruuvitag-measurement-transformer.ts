import { Peripheral } from "@abandonware/noble";
import { flow } from "lodash";
import { v4 as uuid } from "uuid";
import parse from "./ruuvitag-parser";
import decorateRuuviTagSensorDataWithCalculatedValues, {
    EnhancedRuuviTagSensorData,
} from "./ruuvitag-sensor-data-decorator";
import { Device, DeviceMessage, DeviceMessageType, DeviceType } from "../../types";
import { DateTime } from "luxon";

export interface RuuviTag {
    macAddress: string;
    id: string;
    rssi: number;
}

export type RuuviTagMeasurement = {
    id: string;
    peripheral: RuuviTag;
    time: Date;
    sensorData: EnhancedRuuviTagSensorData;
};

const getSensorData = flow(parse, decorateRuuviTagSensorDataWithCalculatedValues);

export const transformPeripheralAdvertisementToSensorDataDeviceMessage = (
    peripheral: Peripheral,
    device: Device
): DeviceMessage => {
    const sensorData = getSensorData(peripheral.advertisement.manufacturerData);
    const macAddress = sensorData.macAddress || peripheral.address;
    return {
        id: uuid(),
        device: {
            macAddress,
            rssi: peripheral.rssi,
            id: peripheral.id,
            type: DeviceType.Ruuvitag,
            friendlyName: device.friendlyName,
        },
        time: DateTime.now(),
        type: DeviceMessageType.SensorData,
        payload: sensorData,
    };
};
