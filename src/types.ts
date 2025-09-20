import { EnhancedRuuviTagAirQualitySensorData, EnhancedRuuviTagEnvironmentalSensorData, EnhancedRuuviTagSensorData } from "./gateways/ruuvitag/ruuvitag-sensor-data-decorator";
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

interface CommonDeviceSensorMessage {
    device: {
        macAddress: string;
        id: string;
        type: DeviceType;
        rssi: number | null;
        friendlyName: string;
        timeout: number;
    };
    id: string;
    time: DateTime;
    type: MessageType.SensorData;
}

export type MifloraSensorMessage = CommonDeviceSensorMessage & {
    deviceType: DeviceType.MiFlora;
    device: CommonDeviceSensorMessage["device"] & {
        type: DeviceType.MiFlora;
    };
    payload: MiFloraSensorData;
};

export type RuuvitagSensorMessage = CommonDeviceSensorMessage & {
    deviceType: DeviceType.Ruuvitag;
    device: CommonDeviceSensorMessage["device"] & {
        type: DeviceType.Ruuvitag;
    };
    payload: EnhancedRuuviTagSensorData;
};

export type DeviceSensorMessage = MifloraSensorMessage | RuuvitagSensorMessage;

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
export enum HomeAssistantEntityCategory {
    Diagnostic = "diagnostic",
}

export interface HomeAssistantSensorConfiguration {
    name: string;
    deviceClass: HomeAssistantDeviceClass;
    component: HomeAssistantMQTTComponent;
    unitOfMeasurement?: string;
    valueTemplate?: string;
    uniqueId: string;
    icon?: string;
    stateClass?: string;
    entityCategory?: HomeAssistantEntityCategory;
    suggestedDecimalPrecision?: number | null;
    payloadOn?: string | boolean;
    payloadOff?: string | boolean;
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
    ? HomeAssistantSensorConfigurationForDevice<EnhancedRuuviTagEnvironmentalSensorData>
    : T extends DeviceType.MiFlora
      ? HomeAssistantSensorConfigurationForDevice<MiFloraSensorData>
      : never;
