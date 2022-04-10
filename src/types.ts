import { EnhancedRuuviTagSensorData } from "./gateways/ruuvitag/ruuvitag-sensor-data-decorator";
import { DateTime } from "luxon";

export enum DeviceType {
    Ruuvitag = "ruuvitag",
}

export enum DeviceMessageType {
    Availability = "availability",
    SensorData = "sensor-data",
}

export interface Device {
    id: string;
    friendlyName: string;
    type: DeviceType;
}

export interface DeviceMessage {
    device: {
        macAddress: string;
        id: string;
        rssi: number | null;
        friendlyName: string;
        type: DeviceType;
    };
    id: string;
    time: DateTime;
    type: DeviceMessageType;
    payload: Record<string, string | number | boolean | null>;
}

export interface DeviceAvailabilityMessage extends DeviceMessage {
    type: DeviceMessageType.Availability;
    payload: {
        state: "online" | "offline";
    };
}

export interface MqttMessage {
    topic: string;
    payload: string;
    retain: boolean;
}

export enum HomeAssistantDeviceClass {
    Temperature = "temperature",
    Humidity = "humidity",
    Pressure = "pressure",
    Battery = "battery",
    None = "none",
    Illuminance = "illuminance",
}

export enum HomeAssistantMQTTComponent {
    Sensor = "sensor",
    BinarySensor = "binary_sensor",
}

export interface HomeAssistantSensorConfiguration {
    name: string;
    deviceClass: HomeAssistantDeviceClass;
    unitOfMeasurement: string;
    valueTemplate?: string;
    uniqueId: string;
    device: {
        manufacturer: string;
        model: string;
    };
}

export type HomeAssistantSensorConfigurationForDevice<T> = {
    [K in keyof T]: HomeAssistantSensorConfiguration;
};

export type HomeAssistantSensorConfigurationForDeviceType<T> = T extends DeviceType.Ruuvitag
    ? HomeAssistantSensorConfigurationForDevice<EnhancedRuuviTagSensorData>
    : never;
