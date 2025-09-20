import {
    EnhancedRuuviTagAirQualitySensorData,
    EnhancedRuuviTagEnvironmentalSensorData,
} from "./ruuvitag-sensor-data-decorator";
import { formatNumericSensorValue } from "../numeric-sensor-value-formatter";

export const formatAirQualitySensorValues = (
    sensorValues: EnhancedRuuviTagAirQualitySensorData,
    decimalPrecision: number
): EnhancedRuuviTagAirQualitySensorData => {
    return {
        type: "air-quality",
        humidex: sensorValues.humidex,
        heatIndex: sensorValues.heatIndex,
        dewPoint: formatNumericSensorValue(sensorValues.dewPoint, decimalPrecision),
        absoluteHumidity: formatNumericSensorValue(sensorValues.absoluteHumidity, decimalPrecision),
        calibrationInProgress: sensorValues.calibrationInProgress,
        macAddress: sensorValues.macAddress,
        measurementSequence: sensorValues.measurementSequence,
        temperature: formatNumericSensorValue(sensorValues.temperature, decimalPrecision),
        relativeHumidityPercentage: formatNumericSensorValue(sensorValues.relativeHumidityPercentage, decimalPrecision),
        pressure: formatNumericSensorValue(sensorValues.pressure, decimalPrecision),
        pm1: formatNumericSensorValue(sensorValues.pm1, decimalPrecision),
        pm2_5: formatNumericSensorValue(sensorValues.pm2_5, decimalPrecision),
        pm4: formatNumericSensorValue(sensorValues.pm4, decimalPrecision),
        pm10: formatNumericSensorValue(sensorValues.pm10, decimalPrecision),
        co2: sensorValues.co2,
        voc: sensorValues.voc,
        nox: sensorValues.nox,
        ruuviAQI: sensorValues.ruuviAQI,
        ruuviAQIDescription: sensorValues.ruuviAQIDescription,
        luminosity: formatNumericSensorValue(sensorValues.luminosity, decimalPrecision),
    };
};

export const formatEnvironmentalSensorValues = (
    sensorValues: EnhancedRuuviTagEnvironmentalSensorData,
    decimalPrecision: number
): EnhancedRuuviTagEnvironmentalSensorData => {
    return {
        type: "environmental",
        temperature: formatNumericSensorValue(sensorValues.temperature, decimalPrecision),
        relativeHumidityPercentage: formatNumericSensorValue(sensorValues.relativeHumidityPercentage, decimalPrecision),
        pressure: formatNumericSensorValue(sensorValues.pressure, decimalPrecision),
        accelerationX: formatNumericSensorValue(sensorValues.accelerationX, decimalPrecision),
        accelerationY: formatNumericSensorValue(sensorValues.accelerationY, decimalPrecision),
        accelerationZ: formatNumericSensorValue(sensorValues.accelerationZ, decimalPrecision),
        batteryVoltage: formatNumericSensorValue(sensorValues.batteryVoltage, decimalPrecision),
        dewPoint: formatNumericSensorValue(sensorValues.dewPoint, decimalPrecision),
        heatIndex: sensorValues.heatIndex,
        humidex: sensorValues.humidex,
        absoluteHumidity: formatNumericSensorValue(sensorValues.absoluteHumidity, decimalPrecision),
        macAddress: sensorValues.macAddress,
        txPower: sensorValues.txPower,
        movementCounter: sensorValues.movementCounter,
        measurementSequence: sensorValues.measurementSequence,
    };
};
