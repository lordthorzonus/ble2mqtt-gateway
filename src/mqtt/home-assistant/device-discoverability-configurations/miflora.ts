import {
    HomeAssistantDeviceClass,
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
        deviceClass: HomeAssistantDeviceClass.Temperature,
        name: "Temperature",
        unitOfMeasurement: "°C",
        uniqueId: "temperature",
        device: miFloraDeviceConfiguration,
    },
    illuminance: {
        deviceClass: HomeAssistantDeviceClass.Illuminance,
        name: "Illuminance",
        uniqueId: "illuminance",
        unitOfMeasurement: "lx",
        device: miFloraDeviceConfiguration,
    },
    moisture: {
        deviceClass: HomeAssistantDeviceClass.None,
        icon: "mdi:water-percent",
        name: "Soil Moisture",
        uniqueId: "soil_moisture",
        unitOfMeasurement: "%",
        device: miFloraDeviceConfiguration,
    },
    soilConductivity: {
        deviceClass: HomeAssistantDeviceClass.None,
        icon: "mdi:flower",
        uniqueId: "soil_conductivity",
        name: "Soil Conductivity",
        unitOfMeasurement: "µS/cm",
        device: miFloraDeviceConfiguration,
    },
};
