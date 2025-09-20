import { AQI, asAQI, CO2Ppm, NOXIndex, PM2_5, VOCIndex } from "../../../units";
import { Match } from "effect";

export type RuuviAQIDescription = "excellent" | "good" | "moderate" | "poor" | "unhealthy";

export interface RuuviAQICalculationResult {
    index: AQI;
    description: RuuviAQIDescription;
}

function roundHalfUp(value: number, decimals = 0): number {
    const factor = Math.pow(10, decimals);
    return value >= 0 ? Math.round(value * factor) / factor : -Math.round(Math.abs(value) * factor) / factor;
}

const calculatePm25IndexScore = (pm: PM2_5) => Math.max(0, (pm - 12) * 2);
const calculateVocIndexScore = (voc: VOCIndex) => Math.max(0, voc - 200);
const calculateNoxIndexScore = (nox: NOXIndex) => Math.max(0, nox - 200);
const calculateCO2IndexScore = (co2: CO2Ppm) => Math.max(0, (co2 - 600) / 10);

const toDescription = Match.type<AQI>().pipe(
    Match.withReturnType<RuuviAQIDescription>(),
    Match.when(
        (index) => index >= 80 && index <= 100,
        () => "excellent"
    ),
    Match.when(
        (index) => index >= 61 && index <= 79,
        () => "good"
    ),
    Match.when(
        (index) => index >= 41 && index <= 60,
        () => "moderate"
    ),
    Match.when(
        (index) => index >= 21 && index <= 40,
        () => "poor"
    ),
    Match.orElse(() => "unhealthy")
);

/**
 * Calculates the Air Quality Index (AQI) from the given values.
 * @see https://github.com/ruuvi/com.ruuvi.station/blob/master/app/src/main/java/com/ruuvi/station/units/domain/aqi/AQI.kt for how the formula is calculated.
 */
export function calculateRuuviAQI({
    co2,
    nox,
    pm25,
    voc,
}: {
    pm25: PM2_5 | null;
    co2: CO2Ppm | null;
    voc: VOCIndex | null;
    nox: NOXIndex | null;
}): RuuviAQICalculationResult | null {
    let sumSquares = 0;
    let count = 0;

    if (pm25 !== null) {
        const score = calculatePm25IndexScore(pm25);
        sumSquares += score * score;
        count++;
    }

    if (voc !== null) {
        const score = calculateVocIndexScore(voc);
        sumSquares += score * score;
        count++;
    }

    if (nox !== null) {
        const score = calculateNoxIndexScore(nox);
        sumSquares += score * score;
        count++;
    }

    if (co2 !== null) {
        const score = calculateCO2IndexScore(co2);
        sumSquares += score * score;
        count++;
    }

    if (count === 0) {
        return null;
    }

    const meanSquares = sumSquares / count;
    const distance = Math.sqrt(meanSquares);

    const index = asAQI(Math.max(0, 100 - roundHalfUp(distance, 0)));

    return { index, description: toDescription(index) };
}
