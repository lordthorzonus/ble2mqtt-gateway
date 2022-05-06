import {
    HomeAssistantDeviceClass,
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
        deviceClass: HomeAssistantDeviceClass.None,
        name: "Absolute Humidity",
        unitOfMeasurement: "g/m^3",
        uniqueId: "absolute_humidity",
        device: ruuviTagDeviceConfiguration,
    },
    temperature: {
        deviceClass: HomeAssistantDeviceClass.Temperature,
        name: "Temperature",
        unitOfMeasurement: "°C",
        uniqueId: "temperature",
        device: ruuviTagDeviceConfiguration,
    },
    batteryVoltage: {
        deviceClass: HomeAssistantDeviceClass.None,
        name: "Battery Voltage",
        unitOfMeasurement: "mV",
        uniqueId: "battery_voltage",
        device: ruuviTagDeviceConfiguration,
        icon: "mdi:battery",
    },
    relativeHumidityPercentage: {
        deviceClass: HomeAssistantDeviceClass.Humidity,
        name: "Humidity",
        unitOfMeasurement: "%",
        uniqueId: "humidity",
        device: ruuviTagDeviceConfiguration,
        valueTemplate: "{{ value_json.relativeHumidityPercentage | float(2) }}",
        icon: "mdi:gauge",
    },
    dewPoint: {
        deviceClass: HomeAssistantDeviceClass.None,
        name: "Dew Point",
        unitOfMeasurement: "°C",
        uniqueId: "dew_point",
        device: ruuviTagDeviceConfiguration,
    },
    pressure: {
        deviceClass: HomeAssistantDeviceClass.Pressure,
        name: "Pressure",
        unitOfMeasurement: "hPa",
        uniqueId: "pressure",
        device: ruuviTagDeviceConfiguration,
    },
    txPower: {
        deviceClass: HomeAssistantDeviceClass.None,
        name: "TX Power",
        unitOfMeasurement: "dBm",
        uniqueId: "txPower",
        device: ruuviTagDeviceConfiguration,
        icon: "mdi:signal",
    },
    accelerationX: {
        deviceClass: HomeAssistantDeviceClass.None,
        name: "Acceleration X",
        unitOfMeasurement: "mG",
        uniqueId: "acceleration_x",
        device: ruuviTagDeviceConfiguration,
    },
    accelerationY: {
        deviceClass: HomeAssistantDeviceClass.None,
        name: "Acceleration Y",
        unitOfMeasurement: "mG",
        uniqueId: "acceleration_y",
        device: ruuviTagDeviceConfiguration,
    },
    accelerationZ: {
        deviceClass: HomeAssistantDeviceClass.None,
        name: "Acceleration Z",
        unitOfMeasurement: "mG",
        uniqueId: "acceleration_z",
        device: ruuviTagDeviceConfiguration,
    },
    humidex: {
        deviceClass: HomeAssistantDeviceClass.None,
        name: "Humidex",
        unitOfMeasurement: "",
        uniqueId: "humidex",
        device: ruuviTagDeviceConfiguration,
    },
    heatIndex: {
        deviceClass: HomeAssistantDeviceClass.None,
        name: "Heat Index",
        unitOfMeasurement: "°C",
        uniqueId: "heat_index",
        device: ruuviTagDeviceConfiguration,
    },
    macAddress: {
        deviceClass: HomeAssistantDeviceClass.None,
        name: "Mac Address",
        unitOfMeasurement: "",
        uniqueId: "mac_address",
        device: ruuviTagDeviceConfiguration,
    },
    measurementSequence: {
        deviceClass: HomeAssistantDeviceClass.None,
        name: "Measurement Sequence",
        unitOfMeasurement: "",
        uniqueId: "measurement_sequence",
        device: ruuviTagDeviceConfiguration,
    },
    movementCounter: {
        deviceClass: HomeAssistantDeviceClass.None,
        name: "Movement Counter",
        unitOfMeasurement: "",
        uniqueId: "movement_counter",
        device: ruuviTagDeviceConfiguration,
    },
};
