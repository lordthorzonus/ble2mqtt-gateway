import {
    HomeAssistantDeviceClass,
    HomeAssistantEntityCategory,
    HomeAssistantMQTTComponent,
    HomeAssistantSensorConfiguration,
    HomeAssistantSensorConfigurationForDevice,
} from "../../../types";
import {
    EnhancedRuuviAirSensorData,
    EnhancedRuuviTagEnvironmentalSensorData,
} from "../../../gateways/ruuvitag/ruuvitag-sensor-data-decorator";

const ruuviTagDeviceConfiguration: HomeAssistantSensorConfiguration["device"] = {
    manufacturer: "Ruuvi Innovations Oy",
    model: "RuuviTag",
};

const ruuviAirDeviceConfiguration: HomeAssistantSensorConfiguration["device"] = {
    manufacturer: "Ruuvi Innovations Oy",
    model: "Ruuvi Air",
};

const absoluteHumiditySensorConfiguration: HomeAssistantSensorConfiguration = {
    component: HomeAssistantMQTTComponent.Sensor,
    deviceClass: HomeAssistantDeviceClass.None,
    name: "Absolute Humidity",
    unitOfMeasurement: "g/m^3",
    uniqueId: "absolute_humidity",
    icon: "mdi:water-percent",
    device: ruuviTagDeviceConfiguration,
};

const temperatureSensorConfiguration: HomeAssistantSensorConfiguration = {
    component: HomeAssistantMQTTComponent.Sensor,
    deviceClass: HomeAssistantDeviceClass.Temperature,
    name: "Temperature",
    unitOfMeasurement: "°C",
    uniqueId: "temperature",
    device: ruuviTagDeviceConfiguration,
};

const relativeHumidityPercentageSensorConfiguration: HomeAssistantSensorConfiguration = {
    component: HomeAssistantMQTTComponent.Sensor,
    deviceClass: HomeAssistantDeviceClass.Humidity,
    name: "Humidity",
    unitOfMeasurement: "%",
    uniqueId: "humidity",
    device: ruuviTagDeviceConfiguration,
    valueTemplate: "{{ value_json.relativeHumidityPercentage | float(2) }}",
    icon: "mdi:water-percent",
};

const dewPointSensorConfiguration: HomeAssistantSensorConfiguration = {
    component: HomeAssistantMQTTComponent.Sensor,
    deviceClass: HomeAssistantDeviceClass.None,
    name: "Dew Point",
    unitOfMeasurement: "°C",
    uniqueId: "dew_point",
    device: ruuviTagDeviceConfiguration,
};

const pressureSensorConfiguration: HomeAssistantSensorConfiguration = {
    component: HomeAssistantMQTTComponent.Sensor,
    deviceClass: HomeAssistantDeviceClass.Pressure,
    name: "Pressure",
    unitOfMeasurement: "hPa",
    uniqueId: "pressure",
    device: ruuviTagDeviceConfiguration,
};

const humidexSensorConfiguration: HomeAssistantSensorConfiguration = {
    component: HomeAssistantMQTTComponent.Sensor,
    deviceClass: HomeAssistantDeviceClass.None,
    name: "Humidex",
    unitOfMeasurement: "",
    uniqueId: "humidex",
    stateClass: "measurement",
    device: ruuviTagDeviceConfiguration,
};

const heatIndexSensorConfiguration: HomeAssistantSensorConfiguration = {
    component: HomeAssistantMQTTComponent.Sensor,
    deviceClass: HomeAssistantDeviceClass.None,
    name: "Heat Index",
    unitOfMeasurement: "°C",
    uniqueId: "heat_index",
    device: ruuviTagDeviceConfiguration,
};

const breezeIndoorClimateIndexSensorConfiguration: HomeAssistantSensorConfiguration = {
    component: HomeAssistantMQTTComponent.Sensor,
    deviceClass: HomeAssistantDeviceClass.None,
    name: "Breeze Indoor Climate Index",
    unitOfMeasurement: "",
    uniqueId: "breeze_indoor_climate_index",
    stateClass: "measurement",
    device: ruuviTagDeviceConfiguration,
    icon: "mdi:home-thermometer-outline",
};

const breezeIndoorClimateIndexDescriptionSensorConfiguration: HomeAssistantSensorConfiguration = {
    component: HomeAssistantMQTTComponent.Sensor,
    deviceClass: HomeAssistantDeviceClass.None,
    name: "Breeze Indoor Climate Index Description",
    unitOfMeasurement: "",
    uniqueId: "breeze_indoor_climate_index_description",
    device: ruuviTagDeviceConfiguration,
    icon: "mdi:home-thermometer-outline",
    suggestedDecimalPrecision: null,
};

const macAddressSensorConfiguration: HomeAssistantSensorConfiguration = {
    component: HomeAssistantMQTTComponent.Sensor,
    deviceClass: HomeAssistantDeviceClass.None,
    entityCategory: HomeAssistantEntityCategory.Diagnostic,
    name: "Mac Address",
    unitOfMeasurement: undefined,
    uniqueId: "mac_address",
    device: ruuviTagDeviceConfiguration,
    suggestedDecimalPrecision: null,
};

const measurementSequenceSensorConfiguration: HomeAssistantSensorConfiguration = {
    component: HomeAssistantMQTTComponent.Sensor,
    deviceClass: HomeAssistantDeviceClass.None,
    name: "Measurement Sequence",
    unitOfMeasurement: "",
    uniqueId: "measurement_sequence",
    stateClass: "total",
    device: ruuviTagDeviceConfiguration,
};

export const ruuviTagAirQualitySensorConfiguration: HomeAssistantSensorConfigurationForDevice<EnhancedRuuviAirSensorData> =
    {
        absoluteHumidity: { ...absoluteHumiditySensorConfiguration, device: ruuviAirDeviceConfiguration },
        temperature: { ...temperatureSensorConfiguration, device: ruuviAirDeviceConfiguration },
        pressure: { ...pressureSensorConfiguration, device: ruuviAirDeviceConfiguration },
        pm1: {
            component: HomeAssistantMQTTComponent.Sensor,
            deviceClass: HomeAssistantDeviceClass.PM1,
            name: "PM1.0",
            unitOfMeasurement: "µg/m³",
            uniqueId: "pm1",
            device: ruuviAirDeviceConfiguration,
        },
        pm2_5: {
            component: HomeAssistantMQTTComponent.Sensor,
            deviceClass: HomeAssistantDeviceClass.PM25,
            name: "PM2.5",
            unitOfMeasurement: "µg/m³",
            uniqueId: "pm2_5",
            device: ruuviAirDeviceConfiguration,
        },
        pm4: {
            component: HomeAssistantMQTTComponent.Sensor,
            deviceClass: HomeAssistantDeviceClass.None,
            name: "PM4.0",
            unitOfMeasurement: "µg/m³",
            uniqueId: "pm4",
            device: ruuviAirDeviceConfiguration,
        },
        pm10: {
            component: HomeAssistantMQTTComponent.Sensor,
            deviceClass: HomeAssistantDeviceClass.PM10,
            name: "PM10.0",
            unitOfMeasurement: "µg/m³",
            uniqueId: "pm10",
            device: ruuviAirDeviceConfiguration,
        },
        co2: {
            component: HomeAssistantMQTTComponent.Sensor,
            deviceClass: HomeAssistantDeviceClass.CarbonDioxide,
            name: "CO2",
            unitOfMeasurement: "ppm",
            uniqueId: "co2",
            device: ruuviAirDeviceConfiguration,
        },
        voc: {
            component: HomeAssistantMQTTComponent.Sensor,
            deviceClass: HomeAssistantDeviceClass.None,
            name: "VOC",
            unitOfMeasurement: "",
            uniqueId: "voc",
            stateClass: "measurement",
            device: ruuviAirDeviceConfiguration,
        },
        nox: {
            component: HomeAssistantMQTTComponent.Sensor,
            deviceClass: HomeAssistantDeviceClass.None,
            name: "NOx",
            unitOfMeasurement: "",
            uniqueId: "nox",
            stateClass: "measurement",
            device: ruuviAirDeviceConfiguration,
        },
        luminosity: {
            component: HomeAssistantMQTTComponent.Sensor,
            deviceClass: HomeAssistantDeviceClass.Illuminance,
            name: "Luminosity",
            unitOfMeasurement: "lux",
            uniqueId: "luminosity",
            device: ruuviAirDeviceConfiguration,
        },
        calibrationInProgress: {
            component: HomeAssistantMQTTComponent.Sensor,
            deviceClass: HomeAssistantDeviceClass.None,
            entityCategory: HomeAssistantEntityCategory.Diagnostic,
            name: "Calibration in progress",
            unitOfMeasurement: "",
            uniqueId: "calibration_in_progress",
            device: ruuviAirDeviceConfiguration,
            suggestedDecimalPrecision: null,
        },
        measurementSequence: measurementSequenceSensorConfiguration,
        macAddress: macAddressSensorConfiguration,
        dewPoint: dewPointSensorConfiguration,
        heatIndex: heatIndexSensorConfiguration,
        humidex: humidexSensorConfiguration,
        ruuviIAQS: {
            component: HomeAssistantMQTTComponent.Sensor,
            deviceClass: HomeAssistantDeviceClass.AQI,
            name: "Ruuvi Indoor Air Quality Score (IAQS)",
            unitOfMeasurement: "",
            uniqueId: "ruuvi_iaqs",
            stateClass: "measurement",
            device: ruuviAirDeviceConfiguration,
            icon: "mdi:air-filter",
        },
        ruuviIAQSDescription: {
            component: HomeAssistantMQTTComponent.Sensor,
            deviceClass: HomeAssistantDeviceClass.None,
            name: "Ruuvi IAQS Description",
            unitOfMeasurement: "",
            uniqueId: "ruuvi_iaqs_description",
            device: ruuviAirDeviceConfiguration,
            icon: "mdi:air-filter",
            suggestedDecimalPrecision: null,
        },
        atmoTubeAQI: {
            component: HomeAssistantMQTTComponent.Sensor,
            deviceClass: HomeAssistantDeviceClass.AQI,
            name: "AtmoTube AQI",
            unitOfMeasurement: "",
            uniqueId: "atmotube_aqi",
            stateClass: "measurement",
            device: ruuviAirDeviceConfiguration,
            icon: "mdi:air-filter",
        },
        atmoTubeAQIDescription: {
            component: HomeAssistantMQTTComponent.Sensor,
            deviceClass: HomeAssistantDeviceClass.None,
            name: "AtmoTube AQI Description",
            unitOfMeasurement: "",
            uniqueId: "atmotube_aqi_description",
            device: ruuviAirDeviceConfiguration,
            icon: "mdi:air-filter",
            suggestedDecimalPrecision: null,
        },
        breezeIndoorClimateIndex: {
            ...breezeIndoorClimateIndexSensorConfiguration,
            device: ruuviAirDeviceConfiguration,
        },
        breezeIndoorClimateIndexDescription: {
            ...breezeIndoorClimateIndexDescriptionSensorConfiguration,
            device: ruuviAirDeviceConfiguration,
        },
    };

export const ruuviTagEnvironmentalSensorConfiguration: HomeAssistantSensorConfigurationForDevice<EnhancedRuuviTagEnvironmentalSensorData> =
    {
        absoluteHumidity: absoluteHumiditySensorConfiguration,
        temperature: temperatureSensorConfiguration,
        batteryVoltage: {
            component: HomeAssistantMQTTComponent.Sensor,
            deviceClass: HomeAssistantDeviceClass.None,
            entityCategory: HomeAssistantEntityCategory.Diagnostic,
            name: "Battery Voltage",
            unitOfMeasurement: "V",
            uniqueId: "battery_voltage",
            device: ruuviTagDeviceConfiguration,
            icon: "mdi:battery",
        },
        relativeHumidityPercentage: relativeHumidityPercentageSensorConfiguration,
        dewPoint: dewPointSensorConfiguration,
        pressure: pressureSensorConfiguration,
        txPower: {
            component: HomeAssistantMQTTComponent.Sensor,
            deviceClass: HomeAssistantDeviceClass.None,
            entityCategory: HomeAssistantEntityCategory.Diagnostic,
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
        humidex: humidexSensorConfiguration,
        heatIndex: heatIndexSensorConfiguration,
        macAddress: macAddressSensorConfiguration,
        measurementSequence: measurementSequenceSensorConfiguration,
        movementCounter: {
            component: HomeAssistantMQTTComponent.Sensor,
            deviceClass: HomeAssistantDeviceClass.None,
            name: "Movement Counter",
            unitOfMeasurement: "",
            uniqueId: "movement_counter",
            stateClass: "total",
            device: ruuviTagDeviceConfiguration,
        },
        /**
         * This is still quite inaccurate, but it's better than nothing.
         * @see https://ruuvi.com/ruuvitag-battery-and-how-to-change/#Ruuvi%20Station%20app%20battery%20indicator
         */
        batteryPercentage: {
            component: HomeAssistantMQTTComponent.Sensor,
            device: ruuviTagDeviceConfiguration,
            entityCategory: HomeAssistantEntityCategory.Diagnostic,
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
        /**
         * @see https://ruuvi.com/ruuvitag-battery-and-how-to-change/#Ruuvi%20Station%20app%20battery%20indicator
         */
        lowBatteryWarning: {
            component: HomeAssistantMQTTComponent.BinarySensor,
            deviceClass: HomeAssistantDeviceClass.Battery,
            entityCategory: HomeAssistantEntityCategory.Diagnostic,
            icon: "mdi:battery",
            name: "Battery",
            uniqueId: "battery_low",
            device: ruuviTagDeviceConfiguration,
            payloadOn: true,
            payloadOff: false,
            valueTemplate: `
{% set temperature = value_json.temperature | float %}
{% set batteryVoltage = value_json.batteryVoltage | float %}
{% if temperature < -20 %}
    {{ batteryVoltage < 2 }}
{% elif temperature < 0 %}
    {{ batteryVoltage < 2.3 }}
{% else %}
    {{ batteryVoltage < 2.5 }}
{% endif %}
        `,
        },
        breezeIndoorClimateIndex: breezeIndoorClimateIndexSensorConfiguration,
        breezeIndoorClimateIndexDescription: breezeIndoorClimateIndexDescriptionSensorConfiguration,
    };
