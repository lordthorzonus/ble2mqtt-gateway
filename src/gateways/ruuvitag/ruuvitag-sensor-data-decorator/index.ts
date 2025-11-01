import { RuuviAirSensorData, RuuviTagEnvironmentalSensorData } from "../ruuvitag-parser";
import { calculateAbsoluteHumidity } from "./calculators/absolute-humidity-calculator";
import { RuuviIAQSDescription, calculateRuuviIAQS } from "./calculators/ruuvi-iaqs-calculator";
import { AtmoTubeAQIDescription, calculateAtmoTubeIAQI } from "./calculators/atmotube-aqi-calculator";
import { calculateDewPoint } from "./calculators/dew-point-calculator";
import { calculateHeatIndex } from "./calculators/heat-index-calculator";
import { calculateHumidex } from "./calculators/humidex-calculator";
import {
    BreezeIndoorClimateIndexDescription,
    calculateBreezeIndoorClimateIndex,
} from "./calculators/breeze-indoor-climate-index-calculator";
import { AQI } from "../../units";

interface SharedEnhancedRuuviTagSensorData {
    humidex: number | null;
    heatIndex: number | null;
    dewPoint: number | null;
    absoluteHumidity: number | null;
    breezeIndoorClimateIndex: number | null;
    breezeIndoorClimateIndexDescription: BreezeIndoorClimateIndexDescription | null;
}

export type EnhancedRuuviTagEnvironmentalSensorData = SharedEnhancedRuuviTagSensorData &
    RuuviTagEnvironmentalSensorData;

export type EnhancedRuuviAirSensorData = SharedEnhancedRuuviTagSensorData &
    RuuviAirSensorData & {
        ruuviIAQS: AQI | null;
        ruuviIAQSDescription: RuuviIAQSDescription | null;
        atmoTubeAQI: AQI | null;
        atmoTubeAQIDescription: AtmoTubeAQIDescription | null;
    };

export type EnhancedRuuviTagSensorData = EnhancedRuuviTagEnvironmentalSensorData | EnhancedRuuviAirSensorData;

export const decorateRuuviTagAirQualitySensorDataWithCalculatedValues = (
    ruuviTagAirQualitySensorData: RuuviAirSensorData
): EnhancedRuuviAirSensorData => {
    const dewPoint = calculateDewPoint(
        ruuviTagAirQualitySensorData.temperature,
        ruuviTagAirQualitySensorData.relativeHumidityPercentage
    );
    const ruuviIAQSCalculationResult = calculateRuuviIAQS({
        pm25: ruuviTagAirQualitySensorData.pm2_5,
        co2: ruuviTagAirQualitySensorData.co2,
    });
    const atmoTubeAQICalculationResult = calculateAtmoTubeIAQI({
        pm2_5: ruuviTagAirQualitySensorData.pm2_5,
        co2: ruuviTagAirQualitySensorData.co2,
        voc: ruuviTagAirQualitySensorData.voc,
        nox: ruuviTagAirQualitySensorData.nox,
        pm10: ruuviTagAirQualitySensorData.pm10,
        pm1: ruuviTagAirQualitySensorData.pm1,
    });
    const breezeIndoorClimateIndexResult = calculateBreezeIndoorClimateIndex(
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
        ruuviIAQS: ruuviIAQSCalculationResult?.index ?? null,
        ruuviIAQSDescription: ruuviIAQSCalculationResult?.description ?? null,
        atmoTubeAQI: atmoTubeAQICalculationResult?.index ?? null,
        atmoTubeAQIDescription: atmoTubeAQICalculationResult?.description ?? null,
        breezeIndoorClimateIndex: breezeIndoorClimateIndexResult?.index ?? null,
        breezeIndoorClimateIndexDescription: breezeIndoorClimateIndexResult?.description ?? null,
    };
};

export const decorateRuuviTagEnvironmentalSensorDataWithCalculatedValues = (
    ruuviTagSensorData: RuuviTagEnvironmentalSensorData
): EnhancedRuuviTagEnvironmentalSensorData => {
    const dewPoint = calculateDewPoint(ruuviTagSensorData.temperature, ruuviTagSensorData.relativeHumidityPercentage);
    const breezeIndoorClimateIndexResult = calculateBreezeIndoorClimateIndex(
        ruuviTagSensorData.temperature,
        ruuviTagSensorData.relativeHumidityPercentage
    );

    return {
        ...ruuviTagSensorData,
        humidex: calculateHumidex(ruuviTagSensorData.temperature, dewPoint),
        heatIndex: calculateHeatIndex(ruuviTagSensorData.temperature, ruuviTagSensorData.relativeHumidityPercentage),
        dewPoint,
        absoluteHumidity: calculateAbsoluteHumidity(
            ruuviTagSensorData.temperature,
            ruuviTagSensorData.relativeHumidityPercentage
        ),
        breezeIndoorClimateIndex: breezeIndoorClimateIndexResult?.index ?? null,
        breezeIndoorClimateIndexDescription: breezeIndoorClimateIndexResult?.description ?? null,
    };
};
