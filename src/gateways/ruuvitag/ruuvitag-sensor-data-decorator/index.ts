import { RuuviTagAirQualitySensorData, RuuviTagEnvironmentalSensorData } from "../ruuvitag-parser";
import { calculateAbsoluteHumidity } from "./calculators/absolute-humidity-calculator";
import { calculateDewPoint } from "./calculators/dew-point-calculator";
import { calculateHeatIndex } from "./calculators/heat-index-calculator";
import { calculateHumidex } from "./calculators/humidex-calculator";

interface SharedEnhancedRuuviTagSensorData {
    humidex: number | null;
    heatIndex: number | null;
    dewPoint: number | null;
    absoluteHumidity: number | null;
}

export type EnhancedRuuviTagEnvironmentalSensorData = SharedEnhancedRuuviTagSensorData &
    RuuviTagEnvironmentalSensorData;

export type EnhancedRuuviTagAirQualitySensorData = SharedEnhancedRuuviTagSensorData & RuuviTagAirQualitySensorData;

export type EnhancedRuuviTagSensorData = EnhancedRuuviTagEnvironmentalSensorData | EnhancedRuuviTagAirQualitySensorData;

export const decorateRuuviTagAirQualitySensorDataWithCalculatedValues = (
    ruuviTagAirQualitySensorData: RuuviTagAirQualitySensorData
): EnhancedRuuviTagAirQualitySensorData => {
    const dewPoint = calculateDewPoint(
        ruuviTagAirQualitySensorData.temperature,
        ruuviTagAirQualitySensorData.relativeHumidityPercentage
    );
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
