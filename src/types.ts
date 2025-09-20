import {
    EnhancedRuuviTagAirQualitySensorData,
    EnhancedRuuviTagEnvironmentalSensorData,
} from "./gateways/ruuvitag/ruuvitag-sensor-data-decorator";
import { DateTime } from "luxon";
import { MiFloraSensorData } from "./gateways/miflora/miflora-measurement-transformer";

export enum DeviceType {
    Ruuvitag = "ruuvitag",
    MiFlora = "miflora",
}

export enum MessageType {
    Availability = "availability",
    SensorData = "sensor-data",
}

export interface Device {
    id: string;
    friendlyName: string;
    type: DeviceType;
    model: string;
}

export interface SensorMessageForType<TDeviceType extends DeviceType, TModel extends string, TPayload> {
    device: {
        macAddress: string;
        id: string;
        rssi: number | null;
        friendlyName: string;
        type: TDeviceType;
        model: TModel;
        timeout: number;
    };
    id: string;
    time: DateTime;
    type: MessageType.SensorData;
    payload: TPayload;
}

export type RuuvitagSensorMessage =
    | SensorMessageForType<DeviceType.Ruuvitag, "environmental", EnhancedRuuviTagEnvironmentalSensorData>
    | SensorMessageForType<DeviceType.Ruuvitag, "air-quality", EnhancedRuuviTagAirQualitySensorData>;
export type MifloraSensorMessage = SensorMessageForType<DeviceType.MiFlora, "miflora", MiFloraSensorData>;

export type DeviceSensorMessage = MifloraSensorMessage | RuuvitagSensorMessage;

export type RuuviModel = "environmental" | "air-quality";

export interface DeviceAvailabilityMessage {
    device: {
        macAddress: string;
        id: string;
        rssi: number | null;
        friendlyName: string;
        type: DeviceType;
        model: string;
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
    PM1 = "pm1",
    PM25 = "pm25",
    PM10 = "pm10",
    CarbonDioxide = "carbon_dioxide",
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
    | Record<string, HomeAssistantSensorConfiguration>;
