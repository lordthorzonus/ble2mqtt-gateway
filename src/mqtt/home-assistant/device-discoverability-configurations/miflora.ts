import {
    HomeAssistantDeviceClass,
    HomeAssistantMQTTComponent,
    HomeAssistantSensorConfiguration,
    HomeAssistantSensorConfigurationForDevice,
} from "../../../types";
import { MiFloraSensorData } from "../../../gateways/miflora/miflora-measurement-transformer";

const miFloraDeviceConfiguration: HomeAssistantSensorConfiguration["device"] = {
    manufacturer: "Xiaomi Inc.",
    model: "MiFlora Plant Sensor HHCCJCV01",
};

export const miFloraSensorConfiguration: HomeAssistantSensorConfigurationForDevice<MiFloraSensorData> = {
    temperature: {
        component: HomeAssistantMQTTComponent.Sensor,
        deviceClass: HomeAssistantDeviceClass.Temperature,
        name: "Temperature",
        unitOfMeasurement: "°C",
        uniqueId: "temperature",
        device: miFloraDeviceConfiguration,
    },
    illuminance: {
        component: HomeAssistantMQTTComponent.Sensor,
        deviceClass: HomeAssistantDeviceClass.Illuminance,
        name: "Illuminance",
        uniqueId: "illuminance",
        unitOfMeasurement: "lx",
        device: miFloraDeviceConfiguration,
    },
    moisture: {
        component: HomeAssistantMQTTComponent.Sensor,
        deviceClass: HomeAssistantDeviceClass.None,
        icon: "mdi:water-percent",
        name: "Soil Moisture",
        uniqueId: "soil_moisture",
        unitOfMeasurement: "%",
        device: miFloraDeviceConfiguration,
    },
    soilConductivity: {
        component: HomeAssistantMQTTComponent.Sensor,
        deviceClass: HomeAssistantDeviceClass.None,
        icon: "mdi:flower",
        uniqueId: "soil_conductivity",
        name: "Soil Conductivity",
        unitOfMeasurement: "µS/cm",
        device: miFloraDeviceConfiguration,
    },
    lowBatteryWarning: {
        component: HomeAssistantMQTTComponent.BinarySensor,
        deviceClass: HomeAssistantDeviceClass.Battery,
        icon: "mdi:battery-alert",
        name: "Battery Low",
        uniqueId: "battery_low",
        valueTemplate: "{{ 'on' if value_json.lowBatteryWarning else 'off' }}",
        device: miFloraDeviceConfiguration,
    },
};
