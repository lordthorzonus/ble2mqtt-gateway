jest.mock("./calculators/absolute-humidity-calculator");
jest.mock("./calculators/dew-point-calculator");
jest.mock("./calculators/heat-index-calculator");
jest.mock("./calculators/humidex-calculator");

import { RuuviTagSensorData, RuuviTagAirQualitySensorData } from "../ruuvitag-parser";
import {
    decorateRuuviTagEnvironmentalSensorDataWithCalculatedValues,
    decorateRuuviTagAirQualitySensorDataWithCalculatedValues,
} from "./index";
import { calculateAbsoluteHumidity } from "./calculators/absolute-humidity-calculator";
import { calculateDewPoint } from "./calculators/dew-point-calculator";
import { calculateHeatIndex } from "./calculators/heat-index-calculator";
import { calculateHumidex } from "./calculators/humidex-calculator";

const calculateAbsoluteHumidityMock = calculateAbsoluteHumidity as jest.Mock;
const calculateDewPointMock = calculateDewPoint as jest.Mock;
const calculateHeatIndexMock = calculateHeatIndex as jest.Mock;
const calculateHumidexMock = calculateHumidex as jest.Mock;

describe("RuuviTag sensor data decorator", () => {
    describe("Environmental sensor data", () => {
        it("should enhance the given ruuvitag environmental sensor data with calculations", () => {
            const ruuviTagSensorData: RuuviTagSensorData = {
                type: "environmental",
                macAddress: "",
                measurementSequence: 1,
                movementCounter: 1,
                txPower: 1,
                accelerationX: 1,
                accelerationY: 2,
                accelerationZ: 3,
                batteryVoltage: 100,
                pressure: 5000,
                relativeHumidityPercentage: 80,
                temperature: 20,
            };
            const dewPoint = 1;
            const absoluteHumidity = 2;
            const humidex = 30;
            const heatIndex = 27;

            calculateAbsoluteHumidityMock.mockReturnValue(absoluteHumidity);
            calculateDewPointMock.mockReturnValue(dewPoint);
            calculateHeatIndexMock.mockReturnValue(heatIndex);
            calculateHumidexMock.mockReturnValue(humidex);

            expect(decorateRuuviTagEnvironmentalSensorDataWithCalculatedValues(ruuviTagSensorData)).toEqual({
                ...ruuviTagSensorData,
                absoluteHumidity,
                dewPoint,
                humidex,
                heatIndex,
            });

            expect(calculateAbsoluteHumidityMock).toHaveBeenCalledWith(
                ruuviTagSensorData.temperature,
                ruuviTagSensorData.relativeHumidityPercentage
            );
            expect(calculateDewPointMock).toHaveBeenCalledWith(
                ruuviTagSensorData.temperature,
                ruuviTagSensorData.relativeHumidityPercentage
            );
            expect(calculateHeatIndexMock).toHaveBeenCalledWith(
                ruuviTagSensorData.temperature,
                ruuviTagSensorData.relativeHumidityPercentage
            );
            expect(calculateHumidexMock).toHaveBeenCalledWith(ruuviTagSensorData.temperature, dewPoint);
        });
    });

    describe("Air quality sensor data", () => {
        it("should enhance the given ruuvitag air quality sensor data with calculations", () => {
            const ruuviTagAirQualitySensorData: RuuviTagAirQualitySensorData = {
                type: "air-quality",
                macAddress: "4C:88:4F",
                measurementSequence: 205,
                temperature: 29.5,
                relativeHumidityPercentage: 55.3,
                pressure: 101102,
                pm25: 11.2,
                co2: 201,
                voc: 10,
                nox: 2,
                luminosity: 13026.67,
                calibrationInProgress: false,
            };
            const dewPoint = 15.2;
            const absoluteHumidity = 14.8;
            const humidex = 32.1;
            const heatIndex = 30.5;

            calculateAbsoluteHumidityMock.mockReturnValue(absoluteHumidity);
            calculateDewPointMock.mockReturnValue(dewPoint);
            calculateHeatIndexMock.mockReturnValue(heatIndex);
            calculateHumidexMock.mockReturnValue(humidex);

            expect(decorateRuuviTagAirQualitySensorDataWithCalculatedValues(ruuviTagAirQualitySensorData)).toEqual({
                ...ruuviTagAirQualitySensorData,
                absoluteHumidity,
                dewPoint,
                humidex,
                heatIndex,
            });

            expect(calculateAbsoluteHumidityMock).toHaveBeenCalledWith(
                ruuviTagAirQualitySensorData.temperature,
                ruuviTagAirQualitySensorData.relativeHumidityPercentage
            );
            expect(calculateDewPointMock).toHaveBeenCalledWith(
                ruuviTagAirQualitySensorData.temperature,
                ruuviTagAirQualitySensorData.relativeHumidityPercentage
            );
            expect(calculateHeatIndexMock).toHaveBeenCalledWith(
                ruuviTagAirQualitySensorData.temperature,
                ruuviTagAirQualitySensorData.relativeHumidityPercentage
            );
            expect(calculateHumidexMock).toHaveBeenCalledWith(ruuviTagAirQualitySensorData.temperature, dewPoint);
        });
    });
});
