import { Celsius, RelativeHumidity } from "../../../units";
import { Match } from "effect";

export type BreezeIndoorClimateIndexDescription = "excellent" | "fine" | "moderate" | "poor" | "very-poor" | "severe";

export interface BreezeIndoorClimateIndexCalculationResult {
    index: number;
    description: BreezeIndoorClimateIndexDescription;
}

/**
 * Lookup table from Breeze Technologies for indoor climate index based on temperature and relative humidity.
 * Keys represent humidity levels (10% to 90%), nested keys represent temperatures (15°C to 28°C).
 *
 * @see https://www.breeze-technologies.de/blog/calculating-an-actionable-indoor-air-quality-index/
 */
const CLIMATE_INDEX_LOOKUP = {
    10: { 15: 6, 16: 6, 17: 6, 18: 6, 19: 6, 20: 6, 21: 6, 22: 6, 23: 6, 24: 6, 25: 6, 26: 6, 27: 6, 28: 6 },
    20: { 15: 6, 16: 5, 17: 5, 18: 5, 19: 5, 20: 5, 21: 5, 22: 5, 23: 5, 24: 5, 25: 5, 26: 5, 27: 5, 28: 6 },
    30: { 15: 6, 16: 5, 17: 5, 18: 4, 19: 4, 20: 4, 21: 4, 22: 4, 23: 4, 24: 4, 25: 4, 26: 5, 27: 5, 28: 6 },
    40: { 15: 6, 16: 5, 17: 5, 18: 4, 19: 3, 20: 3, 21: 3, 22: 2, 23: 2, 24: 3, 25: 4, 26: 5, 27: 5, 28: 6 },
    50: { 15: 5, 16: 5, 17: 4, 18: 3, 19: 2, 20: 1, 21: 1, 22: 1, 23: 2, 24: 3, 25: 4, 26: 5, 27: 5, 28: 6 },
    60: { 15: 5, 16: 4, 17: 3, 18: 2, 19: 1, 20: 1, 21: 1, 22: 2, 23: 2, 24: 3, 25: 4, 26: 5, 27: 5, 28: 6 },
    70: { 15: 5, 16: 4, 17: 3, 18: 2, 19: 1, 20: 1, 21: 1, 22: 2, 23: 3, 24: 4, 25: 5, 26: 5, 27: 5, 28: 6 },
    80: { 15: 5, 16: 4, 17: 2, 18: 2, 19: 2, 20: 2, 21: 2, 22: 3, 23: 4, 24: 5, 25: 5, 26: 5, 27: 5, 28: 6 },
    90: { 15: 6, 16: 5, 17: 4, 18: 3, 19: 3, 20: 3, 21: 3, 22: 4, 23: 5, 24: 5, 25: 6, 26: 6, 27: 6, 28: 6 },
} as const;

type HumidityLevel = keyof typeof CLIMATE_INDEX_LOOKUP;
type TemperatureLevel = keyof (typeof CLIMATE_INDEX_LOOKUP)[HumidityLevel];

const HUMIDITY_LEVELS: readonly HumidityLevel[] = Object.keys(CLIMATE_INDEX_LOOKUP)
    .map(Number)
    .sort((a, b) => a - b) as HumidityLevel[];

const TEMPERATURE_LEVELS: readonly TemperatureLevel[] = Object.keys(CLIMATE_INDEX_LOOKUP[10])
    .map(Number)
    .sort((a, b) => a - b) as TemperatureLevel[];

const toDescription = Match.type<number>().pipe(
    Match.withReturnType<BreezeIndoorClimateIndexDescription>(),
    Match.when(
        (index) => index === 1,
        () => "excellent"
    ),
    Match.when(
        (index) => index === 2,
        () => "fine"
    ),
    Match.when(
        (index) => index === 3,
        () => "moderate"
    ),
    Match.when(
        (index) => index === 4,
        () => "poor"
    ),
    Match.when(
        (index) => index === 5,
        () => "very-poor"
    ),
    Match.orElse(() => "severe")
);

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const findBracketIndex = (value: number, levels: readonly number[]): number => {
    const index = levels.findIndex((level, i) => {
        const nextLevel = levels[i + 1];
        return i < levels.length - 1 && nextLevel !== undefined && value >= level && value <= nextLevel;
    });
    return index === -1 ? 0 : index;
};

/**
 * Performs bilinear interpolation to find the index value for a given temperature and humidity.
 * This provides smooth transitions between the discrete lookup table values.
 */
const interpolateIndex = (temperature: number, humidity: number): number | null => {
    const minTemp = TEMPERATURE_LEVELS.at(0);
    const maxTemp = TEMPERATURE_LEVELS.at(-1);
    const minHum = HUMIDITY_LEVELS.at(0);
    const maxHum = HUMIDITY_LEVELS.at(-1);

    if (minTemp === undefined || maxTemp === undefined || minHum === undefined || maxHum === undefined) {
        return null;
    }

    const clampedTemp = clamp(temperature, minTemp, maxTemp);
    const clampedHumidity = clamp(humidity, minHum, maxHum);

    const tempIdx = findBracketIndex(clampedTemp, TEMPERATURE_LEVELS);
    const humIdx = findBracketIndex(clampedHumidity, HUMIDITY_LEVELS);

    const lowerTemp = TEMPERATURE_LEVELS.at(tempIdx);
    const upperTemp = TEMPERATURE_LEVELS.at(tempIdx + 1);
    const lowerHumidity = HUMIDITY_LEVELS.at(humIdx);
    const upperHumidity = HUMIDITY_LEVELS.at(humIdx + 1);

    if (
        lowerTemp === undefined ||
        upperTemp === undefined ||
        lowerHumidity === undefined ||
        upperHumidity === undefined
    ) {
        return null;
    }

    const indexAtLowerHumidityLowerTemp = CLIMATE_INDEX_LOOKUP[lowerHumidity][lowerTemp];
    const indexAtUpperHumidityLowerTemp = CLIMATE_INDEX_LOOKUP[upperHumidity][lowerTemp];
    const indexAtLowerHumidityUpperTemp = CLIMATE_INDEX_LOOKUP[lowerHumidity][upperTemp];
    const indexAtUpperHumidityUpperTemp = CLIMATE_INDEX_LOOKUP[upperHumidity][upperTemp];

    const tempWeight = (clampedTemp - lowerTemp) / (upperTemp - lowerTemp);
    const humidityWeight = (clampedHumidity - lowerHumidity) / (upperHumidity - lowerHumidity);

    const indexAtLowerHumidity =
        indexAtLowerHumidityLowerTemp * (1 - tempWeight) + indexAtLowerHumidityUpperTemp * tempWeight;
    const indexAtUpperHumidity =
        indexAtUpperHumidityLowerTemp * (1 - tempWeight) + indexAtUpperHumidityUpperTemp * tempWeight;

    return indexAtLowerHumidity * (1 - humidityWeight) + indexAtUpperHumidity * humidityWeight;
};

/**
 * Calculates the Breeze Indoor Climate Index based on temperature and relative humidity.
 *
 * The index ranges from 1 (excellent) to 6 (severe), indicating the comfort level and
 * potential for mould growth. Values of 1-2 represent optimal indoor climate conditions,
 * while values above 3 require action to adjust temperature or humidity.
 *
 * @see https://www.breeze-technologies.de/blog/calculating-an-actionable-indoor-air-quality-index/
 */
export const calculateBreezeIndoorClimateIndex = (
    temperatureInCelsius: Celsius | null,
    relativeHumidityInPercents: RelativeHumidity | null
): BreezeIndoorClimateIndexCalculationResult | null => {
    if (temperatureInCelsius === null || relativeHumidityInPercents === null) {
        return null;
    }

    const rawIndex = interpolateIndex(temperatureInCelsius, relativeHumidityInPercents);

    if (rawIndex === null) {
        return null;
    }

    const index = clamp(Math.round(rawIndex), 1, 6);

    return {
        index,
        description: toDescription(index),
    };
};
