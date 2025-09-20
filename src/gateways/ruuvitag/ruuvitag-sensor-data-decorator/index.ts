import { RuuviTagAirQualitySensorData, RuuviTagEnvironmentalSensorData } from "../ruuvitag-parser";
import { calculateAbsoluteHumidity } from "./calculators/absolute-humidity-calculator";
import { RuuviAQIDescription, calculateRuuviAQI } from "./calculators/ruuvi-aqi-calculator";
import { calculateDewPoint } from "./calculators/dew-point-calculator";
import { calculateHeatIndex } from "./calculators/heat-index-calculator";
import { calculateHumidex } from "./calculators/humidex-calculator";
import { AQI } from "../../units";

interface SharedEnhancedRuuviTagSensorData {
    humidex: number | null;
    heatIndex: number | null;
    dewPoint: number | null;
    absoluteHumidity: number | null;
}

export type EnhancedRuuviTagEnvironmentalSensorData = SharedEnhancedRuuviTagSensorData &
    RuuviTagEnvironmentalSensorData;

export type EnhancedRuuviTagAirQualitySensorData = SharedEnhancedRuuviTagSensorData &
    RuuviTagAirQualitySensorData & { ruuviAQI: AQI | null; ruuviAQIDescription: RuuviAQIDescription | null };

export type EnhancedRuuviTagSensorData = EnhancedRuuviTagEnvironmentalSensorData | EnhancedRuuviTagAirQualitySensorData;

export const decorateRuuviTagAirQualitySensorDataWithCalculatedValues = (
    ruuviTagAirQualitySensorData: RuuviTagAirQualitySensorData
): EnhancedRuuviTagAirQualitySensorData => {
    const dewPoint = calculateDewPoint(
        ruuviTagAirQualitySensorData.temperature,
        ruuviTagAirQualitySensorData.relativeHumidityPercentage
    );
    const ruuviAQICalculationResult = calculateRuuviAQI({
        pm25: ruuviTagAirQualitySensorData.pm2_5,
        co2: ruuviTagAirQualitySensorData.co2,
        voc: ruuviTagAirQualitySensorData.voc,
        nox: ruuviTagAirQualitySensorData.nox,
    });

    return {
        ...ruuviTagAirQualitySensorData,
        humidex: calculateHumidex(ruuviTagAirQualitySensorData.temperature, dewPoint),
        heatIndex: calculateHeatIndex(
            ruuviTagAirQualitySensorData.temperature,
            ruuviTagAirQualitySensorData.relativeHumidityPercentage
        ),
        dewPoint,
        absoluteHumidity: calculateAbsoluteHumidity(
            ruuviTagAirQualitySensorData.temperature,
            ruuviTagAirQualitySensorData.relativeHumidityPercentage
        ),
        ruuviAQI: ruuviAQICalculationResult?.index ?? null,
        ruuviAQIDescription: ruuviAQICalculationResult?.description ?? null,
    };
};

export const decorateRuuviTagEnvironmentalSensorDataWithCalculatedValues = (
    ruuviTagSensorData: RuuviTagEnvironmentalSensorData
): EnhancedRuuviTagEnvironmentalSensorData => {
    const dewPoint = calculateDewPoint(ruuviTagSensorData.temperature, ruuviTagSensorData.relativeHumidityPercentage);
    return {
        ...ruuviTagSensorData,
        humidex: calculateHumidex(ruuviTagSensorData.temperature, dewPoint),
        heatIndex: calculateHeatIndex(ruuviTagSensorData.temperature, ruuviTagSensorData.relativeHumidityPercentage),
        dewPoint,
        absoluteHumidity: calculateAbsoluteHumidity(
            ruuviTagSensorData.temperature,
            ruuviTagSensorData.relativeHumidityPercentage
        ),
    };
};
