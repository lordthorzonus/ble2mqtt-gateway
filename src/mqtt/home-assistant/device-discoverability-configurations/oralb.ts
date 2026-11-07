import {
    HomeAssistantDeviceClass,
    HomeAssistantMQTTComponent,
    HomeAssistantSensorConfiguration,
    HomeAssistantSensorConfigurationForDevice,
} from "../../../types.js";
import { OralBSensorData } from "../../../gateways/oralb/oralb-sensor-data.js";

const oralbDeviceConfiguration: HomeAssistantSensorConfiguration["device"] = {
    manufacturer: "Oral-B",
    model: "Smart Toothbrush",
};

/** Home Assistant discovery configuration for Oral-B toothbrush entities. */
export const oralbSensorConfiguration: HomeAssistantSensorConfigurationForDevice<OralBSensorData> = {
    state: {
        component: HomeAssistantMQTTComponent.Sensor,
        deviceClass: HomeAssistantDeviceClass.None,
        name: "State",
        unitOfMeasurement: undefined,
        uniqueId: "state",
        device: oralbDeviceConfiguration,
        suggestedDecimalPrecision: null,
    },
    pressure: {
        component: HomeAssistantMQTTComponent.Sensor,
        deviceClass: HomeAssistantDeviceClass.None,
        name: "Pressure",
        unitOfMeasurement: undefined,
        uniqueId: "pressure",
        device: oralbDeviceConfiguration,
        suggestedDecimalPrecision: null,
    },
    brushingTimeSeconds: {
        component: HomeAssistantMQTTComponent.Sensor,
        deviceClass: HomeAssistantDeviceClass.Duration,
        name: "Brushing Time",
        unitOfMeasurement: "s",
        uniqueId: "brushing_time_seconds",
        device: oralbDeviceConfiguration,
        icon: "mdi:timer-outline",
        suggestedDecimalPrecision: null,
    },
    brushingMode: {
        component: HomeAssistantMQTTComponent.Sensor,
        deviceClass: HomeAssistantDeviceClass.None,
        name: "Brushing Mode",
        unitOfMeasurement: undefined,
        uniqueId: "brushing_mode",
        device: oralbDeviceConfiguration,
        icon: "mdi:toothbrush-electric",
        suggestedDecimalPrecision: null,
    },
    sector: {
        component: HomeAssistantMQTTComponent.Sensor,
        deviceClass: HomeAssistantDeviceClass.None,
        name: "Sector",
        unitOfMeasurement: undefined,
        uniqueId: "sector",
        device: oralbDeviceConfiguration,
        icon: "mdi:grid",
        suggestedDecimalPrecision: null,
    },
    sectorTimer: {
        component: HomeAssistantMQTTComponent.Sensor,
        deviceClass: HomeAssistantDeviceClass.Duration,
        name: "Sector Timer",
        unitOfMeasurement: "s",
        uniqueId: "sector_timer",
        device: oralbDeviceConfiguration,
        icon: "mdi:timer-outline",
        suggestedDecimalPrecision: null,
    },
    numberOfSectors: {
        component: HomeAssistantMQTTComponent.Sensor,
        deviceClass: HomeAssistantDeviceClass.None,
        name: "Number of Sectors",
        unitOfMeasurement: undefined,
        uniqueId: "number_of_sectors",
        device: oralbDeviceConfiguration,
        icon: "mdi:numeric",
        suggestedDecimalPrecision: null,
    },
    isBrushing: {
        component: HomeAssistantMQTTComponent.BinarySensor,
        deviceClass: HomeAssistantDeviceClass.Running,
        name: "Brushing",
        uniqueId: "is_brushing",
        device: oralbDeviceConfiguration,
        icon: "mdi:toothbrush",
        payloadOn: true,
        payloadOff: false,
    },
};
