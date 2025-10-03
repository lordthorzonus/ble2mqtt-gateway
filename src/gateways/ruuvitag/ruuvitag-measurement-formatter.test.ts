import { EnhancedRuuviTagEnvironmentalSensorData, EnhancedRuuviAirSensorData } from "./ruuvitag-sensor-data-decorator";
import { formatEnvironmentalSensorValues, formatAirQualitySensorValues } from "./ruuvitag-measurement-formatter";
import {
    asCelsius,
    asCO2Ppm,
    asLux,
    asNOXIndex,
    asPascal,
    asPM1,
    asPM10,
    asPM2_5,
    asPM4,
    asRelativeHumidity,
    asVOCIndex,
} from "../units";

describe("RuuviTag measurement formatter", () => {
    describe("Environmental sensor data formatting", () => {
        it("should format environmental sensor values with specified decimal precision", () => {
            const sensorData: EnhancedRuuviTagEnvironmentalSensorData = {
                type: "environmental",
                temperature: asCelsius(24.31234),
                relativeHumidityPercentage: asRelativeHumidity(53.49876),
                pressure: asPascal(100044.789),
                accelerationX: 0.004567,
                accelerationY: -0.009876,
                accelerationZ: 1.036543,
                batteryVoltage: 2.977654,
                txPower: 4,
                movementCounter: 66,
                measurementSequence: 205,
                macAddress: "CB:B8:33:4C:88:4F",
                dewPoint: 15.23456,
                heatIndex: 27.89012,
                humidex: 30.45678,
                absoluteHumidity: 12.34567,
            };

            const formatted = formatEnvironmentalSensorValues(sensorData, 2);

            expect(formatted).toEqual({
                type: "environmental",
                temperature: 24.31,
                relativeHumidityPercentage: 53.5,
                pressure: 100044.79,
                accelerationX: 0,
                accelerationY: -0.01,
                accelerationZ: 1.04,
                batteryVoltage: 2.98,
                txPower: 4,
                movementCounter: 66,
                measurementSequence: 205,
                macAddress: "CB:B8:33:4C:88:4F",
                dewPoint: 15.23,
                heatIndex: 27.89012,
                humidex: 30.45678,
                absoluteHumidity: 12.35,
            });
        });

        it("should handle null values in environmental sensor data", () => {
            const sensorData: EnhancedRuuviTagEnvironmentalSensorData = {
                type: "environmental",
                temperature: null,
                relativeHumidityPercentage: null,
                pressure: null,
                accelerationX: null,
                accelerationY: null,
                accelerationZ: null,
                batteryVoltage: null,
                txPower: null,
                movementCounter: null,
                measurementSequence: null,
                macAddress: null,
                dewPoint: null,
                heatIndex: null,
                humidex: null,
                absoluteHumidity: null,
            };

            const formatted = formatEnvironmentalSensorValues(sensorData, 2);

            expect(formatted).toEqual(sensorData);
        });
    });

    describe("Air quality sensor data formatting", () => {
        it("should format air quality sensor values with specified decimal precision", () => {
            const sensorData: EnhancedRuuviAirSensorData = {
                type: "air-quality",
                temperature: asCelsius(29.50123),
                relativeHumidityPercentage: asRelativeHumidity(55.30456),
                pressure: asPascal(101102.789),
                pm1: asPM1(9.87654),
                pm2_5: asPM2_5(11.23456),
                pm4: asPM4(15.65432),
                pm10: asPM10(25.98765),
                co2: asCO2Ppm(201),
                voc: asVOCIndex(10),
                nox: asNOXIndex(2),
                luminosity: asLux(13026.6789),
                measurementSequence: 205,
                macAddress: "4C:88:4F",
                calibrationInProgress: false,
                dewPoint: 15.23456,
                heatIndex: 30.54321,
                humidex: 32.10987,
                absoluteHumidity: 14.87654,
                ruuviAQI: null,
                ruuviAQIDescription: null,
                atmoTubeAQI: null,
                atmoTubeAQIDescription: null,
            };

            const formatted = formatAirQualitySensorValues(sensorData, 2);

            expect(formatted).toEqual({
                type: "air-quality",
                temperature: 29.5,
                relativeHumidityPercentage: 55.3,
                pressure: 101102.79,
                pm1: 9.88,
                pm2_5: 11.23,
                pm4: 15.65,
                pm10: 25.99,
                co2: 201,
                voc: 10,
                nox: 2,
                luminosity: 13026.68,
                measurementSequence: 205,
                macAddress: "4C:88:4F",
                calibrationInProgress: false,
                dewPoint: 15.23,
                heatIndex: 30.54321,
                humidex: 32.10987,
                absoluteHumidity: 14.88,
                ruuviAQI: null,
                ruuviAQIDescription: null,
                atmoTubeAQI: null,
                atmoTubeAQIDescription: null,
            });
        });

        it("should handle null values in air quality sensor data", () => {
            const sensorData: EnhancedRuuviAirSensorData = {
                type: "air-quality",
                temperature: null,
                relativeHumidityPercentage: null,
                pressure: null,
                pm1: null,
                pm2_5: null,
                pm4: null,
                pm10: null,
                co2: null,
                voc: null,
                nox: null,
                luminosity: null,
                measurementSequence: 255,
                macAddress: null,
                calibrationInProgress: true,
                dewPoint: null,
                heatIndex: null,
                humidex: null,
                absoluteHumidity: null,
                ruuviAQI: null,
                ruuviAQIDescription: null,
                atmoTubeAQI: null,
                atmoTubeAQIDescription: null,
            };

            const formatted = formatAirQualitySensorValues(sensorData, 2);

            expect(formatted).toEqual({
                type: "air-quality",
                temperature: null,
                relativeHumidityPercentage: null,
                pressure: null,
                pm1: null,
                pm2_5: null,
                pm4: null,
                pm10: null,
                co2: null,
                voc: null,
                nox: null,
                luminosity: null,
                measurementSequence: 255,
                macAddress: null,
                calibrationInProgress: true,
                dewPoint: null,
                heatIndex: null,
                humidex: null,
                absoluteHumidity: null,
                ruuviAQI: null,
                ruuviAQIDescription: null,
                atmoTubeAQI: null,
                atmoTubeAQIDescription: null,
            });
        });

        it("should format air quality sensor values with different decimal precision", () => {
            const sensorData: EnhancedRuuviAirSensorData = {
                type: "air-quality",
                temperature: asCelsius(29.50123),
                relativeHumidityPercentage: asRelativeHumidity(55.30456),
                pressure: asPascal(101102.789),
                pm1: asPM1(9.87654),
                pm2_5: asPM2_5(11.23456),
                pm4: asPM4(15.65432),
                pm10: asPM10(25.98765),
                co2: asCO2Ppm(201),
                voc: asVOCIndex(10),
                nox: asNOXIndex(2),
                luminosity: asLux(13026.6789),
                measurementSequence: 205,
                macAddress: "4C:88:4F",
                calibrationInProgress: false,
                dewPoint: 15.23456,
                heatIndex: 30.54321,
                humidex: 32.10987,
                absoluteHumidity: 14.87654,
                ruuviAQI: null,
                ruuviAQIDescription: null,
                atmoTubeAQI: null,
                atmoTubeAQIDescription: null,
            };

            const formatted = formatAirQualitySensorValues(sensorData, 0);

            expect(formatted).toEqual({
                type: "air-quality",
                temperature: 30,
                relativeHumidityPercentage: 55,
                pressure: 101103,
                pm1: 10,
                pm2_5: 11,
                pm4: 16,
                pm10: 26,
                co2: 201,
                voc: 10,
                nox: 2,
                luminosity: 13027,
                measurementSequence: 205,
                macAddress: "4C:88:4F",
                calibrationInProgress: false,
                dewPoint: 15,
                heatIndex: 30.54321,
                humidex: 32.10987,
                absoluteHumidity: 15,
                ruuviAQI: null,
                ruuviAQIDescription: null,
                atmoTubeAQI: null,
                atmoTubeAQIDescription: null,
            });
        });
    });
});
