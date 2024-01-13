import {
    HomeAssistantDeviceClass,
    HomeAssistantMQTTComponent,
    HomeAssistantSensorConfiguration,
    HomeAssistantSensorConfigurationForDevice,
} from "../../../types";
import { EnhancedRuuviTagSensorData } from "../../../gateways/ruuvitag/ruuvitag-sensor-data-decorator";

const ruuviTagDeviceConfiguration: HomeAssistantSensorConfiguration["device"] = {
    manufacturer: "Ruuvi Innovations Oy",
    model: "RuuviTag",
};

export const ruuviTagSensorConfiguration: HomeAssistantSensorConfigurationForDevice<EnhancedRuuviTagSensorData> = {
    absoluteHumidity: {
        component: HomeAssistantMQTTComponent.Sensor,
        deviceClass: HomeAssistantDeviceClass.None,
        name: "Absolute Humidity",
        unitOfMeasurement: "g/m^3",
        uniqueId: "absolute_humidity",
        icon: "mdi:water-percent",
        device: ruuviTagDeviceConfiguration,
    },
    temperature: {
        component: HomeAssistantMQTTComponent.Sensor,
        deviceClass: HomeAssistantDeviceClass.Temperature,
        name: "Temperature",
        unitOfMeasurement: "°C",
        uniqueId: "temperature",
        device: ruuviTagDeviceConfiguration,
    },
    batteryVoltage: {
        component: HomeAssistantMQTTComponent.Sensor,
        deviceClass: HomeAssistantDeviceClass.None,
        name: "Battery Voltage",
        unitOfMeasurement: "V",
        uniqueId: "battery_voltage",
        device: ruuviTagDeviceConfiguration,
        icon: "mdi:battery",
    },
    relativeHumidityPercentage: {
        component: HomeAssistantMQTTComponent.Sensor,
        deviceClass: HomeAssistantDeviceClass.Humidity,
        name: "Humidity",
        unitOfMeasurement: "%",
        uniqueId: "humidity",
        device: ruuviTagDeviceConfiguration,
        valueTemplate: "{{ value_json.relativeHumidityPercentage | float(2) }}",
        icon: "mdi:water-percent",
    },
    dewPoint: {
        component: HomeAssistantMQTTComponent.Sensor,
        deviceClass: HomeAssistantDeviceClass.None,
        name: "Dew Point",
        unitOfMeasurement: "°C",
        uniqueId: "dew_point",
        device: ruuviTagDeviceConfiguration,
    },
    pressure: {
        deviceClass: HomeAssistantDeviceClass.Pressure,
        component: HomeAssistantMQTTComponent.Sensor,
        name: "Pressure",
        unitOfMeasurement: "hPa",
        uniqueId: "pressure",
        device: ruuviTagDeviceConfiguration,
    },
    txPower: {
        component: HomeAssistantMQTTComponent.Sensor,
        deviceClass: HomeAssistantDeviceClass.None,
        name: "TX Power",
        unitOfMeasurement: "dBm",
        uniqueId: "txPower",
        device: ruuviTagDeviceConfiguration,
        icon: "mdi:signal",
    },
    accelerationX: {
        component: HomeAssistantMQTTComponent.Sensor,
        deviceClass: HomeAssistantDeviceClass.None,
        name: "Acceleration X",
        unitOfMeasurement: "mG",
        uniqueId: "acceleration_x",
        device: ruuviTagDeviceConfiguration,
    },
    accelerationY: {
        component: HomeAssistantMQTTComponent.Sensor,
        deviceClass: HomeAssistantDeviceClass.None,
        name: "Acceleration Y",
        unitOfMeasurement: "mG",
        uniqueId: "acceleration_y",
        device: ruuviTagDeviceConfiguration,
    },
    accelerationZ: {
        component: HomeAssistantMQTTComponent.Sensor,
        deviceClass: HomeAssistantDeviceClass.None,
        name: "Acceleration Z",
        unitOfMeasurement: "mG",
        uniqueId: "acceleration_z",
        device: ruuviTagDeviceConfiguration,
    },
    humidex: {
        component: HomeAssistantMQTTComponent.Sensor,
        deviceClass: HomeAssistantDeviceClass.None,
        name: "Humidex",
        unitOfMeasurement: "",
        uniqueId: "humidex",
        device: ruuviTagDeviceConfiguration,
    },
    heatIndex: {
        component: HomeAssistantMQTTComponent.Sensor,
        deviceClass: HomeAssistantDeviceClass.None,
        name: "Heat Index",
        unitOfMeasurement: "°C",
        uniqueId: "heat_index",
        device: ruuviTagDeviceConfiguration,
    },
    macAddress: {
        component: HomeAssistantMQTTComponent.Sensor,
        deviceClass: HomeAssistantDeviceClass.None,
        name: "Mac Address",
        unitOfMeasurement: undefined,
        uniqueId: "mac_address",
        device: ruuviTagDeviceConfiguration,
        suggestedDecimalPrecision: null,
    },
    measurementSequence: {
        component: HomeAssistantMQTTComponent.Sensor,
        deviceClass: HomeAssistantDeviceClass.None,
        name: "Measurement Sequence",
        unitOfMeasurement: "",
        uniqueId: "measurement_sequence",
        device: ruuviTagDeviceConfiguration,
    },
    movementCounter: {
        component: HomeAssistantMQTTComponent.Sensor,
        deviceClass: HomeAssistantDeviceClass.None,
        name: "Movement Counter",
        unitOfMeasurement: "",
        uniqueId: "movement_counter",
        device: ruuviTagDeviceConfiguration,
    },
    batteryPercentage: {
        component: HomeAssistantMQTTComponent.Sensor,
        device: ruuviTagDeviceConfiguration,
        deviceClass: HomeAssistantDeviceClass.Battery,
        unitOfMeasurement: "%",
        uniqueId: "battery_percentage",
        name: "Battery Percentage",
        valueTemplate: `
{% set temperature = value_json.temperature | float %}
{% set batteryVoltage = value_json.batteryVoltage | float %}
{% set maxBattery = 3 %}
{% set minBattery = iif(temperature < -20, 2, iif(temperature | float < 0, 2.3, 2.5)) %}
{{ (((batteryVoltage - minBattery) / (maxBattery - minBattery)) * 100) | round(2) }}
        `,
        icon: "mdi:battery",
    },
};
