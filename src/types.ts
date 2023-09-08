import { EnhancedRuuviTagSensorData } from "./gateways/ruuvitag/ruuvitag-sensor-data-decorator";
import { DateTime } from "luxon";
import { MiFloraSensorData } from "./gateways/miflora/miflora-measurement-transformer";

export enum DeviceType {
    Ruuvitag = "ruuvitag",
    MiFlora = "miflora",
}

export enum MessageType {
    Availability = "availability",
    SensorData = "sensor-data",
    Analytics = "analytics",
}

export interface Device {
    id: string;
    friendlyName: string;
    type: DeviceType;
}

export interface DeviceSensorMessage {
    device: {
        macAddress: string;
        id: string;
        rssi: number | null;
        friendlyName: string;
        type: DeviceType;
        timeout: number;
    };
    id: string;
    time: DateTime;
    type: MessageType.SensorData;
    payload: Record<string, unknown>;
}

export interface DeviceAvailabilityMessage {
    device: {
        macAddress: string;
        id: string;
        rssi: number | null;
        friendlyName: string;
        type: DeviceType;
        timeout: number;
    };
    id: string;
    time: DateTime;
    type: MessageType.Availability;
    payload: {
        state: "online" | "offline";
    };
}

export type DeviceMessage = DeviceAvailabilityMessage | DeviceSensorMessage;
export type BleGatewayMessage = DeviceMessage;

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
    icon?: string;
    stateClass?: string;
    suggestedDecimalPrecision?: number | null;
    device: {
        manufacturer: string;
        model: string;
    };
}

export type HomeAssistantSensorConfigurationForDevice<T> =
    | {
          [K in keyof T]: HomeAssistantSensorConfiguration;
      }
    | Record<string, HomeAssistantSensorConfiguration & { valueTemplate: string }>;

export type HomeAssistantSensorConfigurationForDeviceType<T> = T extends DeviceType.Ruuvitag
    ? HomeAssistantSensorConfigurationForDevice<EnhancedRuuviTagSensorData>
    : T extends DeviceType.MiFlora
    ? HomeAssistantSensorConfigurationForDevice<MiFloraSensorData>
    : never;
