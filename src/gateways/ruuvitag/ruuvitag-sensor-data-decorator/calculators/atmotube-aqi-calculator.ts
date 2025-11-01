import { AQI, asAQI, CO2Ppm, NOxIndex, PM1, PM10, PM2_5, VOCIndex } from "../../../units";
import { Match } from "effect";

export type AtmoTubeAQIDescription = "good" | "moderate" | "polluted" | "very-polluted" | "severely-polluted";

export interface AtmoTubeAQICalculationResult {
    index: AQI;
    description: AtmoTubeAQIDescription;
}

interface Breakpoint {
    aqiLow: number;
    aqiHigh: number;
    breakpointLow: number;
    breakpointHigh: number;
}

/**
 * Atmotube AQI breakpoints
 * @see https://web.archive.org/web/20250323170930/https://atmotube.com/blog/indoor-air-quality-index-iaqi
 */
const BREAKPOINTS = {
    co2: [
        { aqiLow: 100, aqiHigh: 81, breakpointLow: 400, breakpointHigh: 599 },
        { aqiLow: 80, aqiHigh: 61, breakpointLow: 599, breakpointHigh: 999 },
        { aqiLow: 60, aqiHigh: 41, breakpointLow: 999, breakpointHigh: 1499 },
        { aqiLow: 40, aqiHigh: 21, breakpointLow: 1499, breakpointHigh: 2499 },
        { aqiLow: 20, aqiHigh: 0, breakpointLow: 2499, breakpointHigh: 4000 },
    ] as Breakpoint[],

    voc: [
        { aqiLow: 100, aqiHigh: 81, breakpointLow: 1, breakpointHigh: 199 },
        { aqiLow: 80, aqiHigh: 61, breakpointLow: 199, breakpointHigh: 249 },
        { aqiLow: 60, aqiHigh: 41, breakpointLow: 249, breakpointHigh: 349 },
        { aqiLow: 40, aqiHigh: 21, breakpointLow: 349, breakpointHigh: 399 },
        { aqiLow: 20, aqiHigh: 0, breakpointLow: 399, breakpointHigh: 500 },
    ] as Breakpoint[],

    nox: [
        { aqiLow: 100, aqiHigh: 81, breakpointLow: 1, breakpointHigh: 49 },
        { aqiLow: 80, aqiHigh: 61, breakpointLow: 49, breakpointHigh: 99 },
        { aqiLow: 60, aqiHigh: 41, breakpointLow: 99, breakpointHigh: 299 },
        { aqiLow: 40, aqiHigh: 21, breakpointLow: 299, breakpointHigh: 349 },
        { aqiLow: 20, aqiHigh: 0, breakpointLow: 349, breakpointHigh: 500 },
    ] as Breakpoint[],

    ch20: [
        { aqiLow: 100, aqiHigh: 81, breakpointLow: 0, breakpointHigh: 0.05 },
        { aqiLow: 80, aqiHigh: 61, breakpointLow: 0.05, breakpointHigh: 0.1 },
        { aqiLow: 60, aqiHigh: 41, breakpointLow: 0.1, breakpointHigh: 0.3 },
        { aqiLow: 40, aqiHigh: 21, breakpointLow: 0.3, breakpointHigh: 0.75 },
        { aqiLow: 20, aqiHigh: 0, breakpointLow: 0.75, breakpointHigh: 1.0 },
    ] as Breakpoint[],

    pm1: [
        { aqiLow: 100, aqiHigh: 81, breakpointLow: 0, breakpointHigh: 14 },
        { aqiLow: 80, aqiHigh: 61, breakpointLow: 14, breakpointHigh: 34 },
        { aqiLow: 60, aqiHigh: 41, breakpointLow: 34, breakpointHigh: 61 },
        { aqiLow: 40, aqiHigh: 21, breakpointLow: 61, breakpointHigh: 95 },
        { aqiLow: 20, aqiHigh: 0, breakpointLow: 95, breakpointHigh: 150 },
    ] as Breakpoint[],

    pm2_5: [
        { aqiLow: 100, aqiHigh: 81, breakpointLow: 0, breakpointHigh: 20 },
        { aqiLow: 80, aqiHigh: 61, breakpointLow: 20, breakpointHigh: 50 },
        { aqiLow: 60, aqiHigh: 41, breakpointLow: 50, breakpointHigh: 90 },
        { aqiLow: 40, aqiHigh: 21, breakpointLow: 90, breakpointHigh: 140 },
        { aqiLow: 20, aqiHigh: 0, breakpointLow: 140, breakpointHigh: 200 },
    ] as Breakpoint[],

    pm10: [
        { aqiLow: 100, aqiHigh: 81, breakpointLow: 0, breakpointHigh: 30 },
        { aqiLow: 80, aqiHigh: 61, breakpointLow: 30, breakpointHigh: 75 },
        { aqiLow: 60, aqiHigh: 41, breakpointLow: 75, breakpointHigh: 125 },
        { aqiLow: 40, aqiHigh: 21, breakpointLow: 125, breakpointHigh: 200 },
        { aqiLow: 20, aqiHigh: 0, breakpointLow: 200, breakpointHigh: 300 },
    ] as Breakpoint[],

    co: [
        { aqiLow: 100, aqiHigh: 81, breakpointLow: 0, breakpointHigh: 1.7 },
        { aqiLow: 80, aqiHigh: 61, breakpointLow: 1.7, breakpointHigh: 8.7 },
        { aqiLow: 60, aqiHigh: 41, breakpointLow: 8.7, breakpointHigh: 10 },
        { aqiLow: 40, aqiHigh: 21, breakpointLow: 10, breakpointHigh: 15 },
        { aqiLow: 20, aqiHigh: 0, breakpointLow: 15, breakpointHigh: 30 },
    ] as Breakpoint[],

    o3: [
        { aqiLow: 100, aqiHigh: 81, breakpointLow: 0, breakpointHigh: 0.025 },
        { aqiLow: 80, aqiHigh: 61, breakpointLow: 0.025, breakpointHigh: 0.06 },
        { aqiLow: 60, aqiHigh: 41, breakpointLow: 0.06, breakpointHigh: 0.075 },
        { aqiLow: 40, aqiHigh: 21, breakpointLow: 0.075, breakpointHigh: 0.1 },
        { aqiLow: 20, aqiHigh: 0, breakpointLow: 0.1, breakpointHigh: 0.3 },
    ] as Breakpoint[],
};

/**
 * Calculate individual AQI for a specific pollutant using standard EPA AQI formula
 * Ip = ((IHi - ILo) / (BPHi - BPLo)) × (Cp - BPLo) + ILo
 * @see https://document.airnow.gov/technical-assistance-document-for-the-reporting-of-daily-air-quailty.pdf
 */
const calculateIndividualAQI = (concentration: number, breakpoints: readonly Breakpoint[]): AQI => {
    if (concentration <= 0) {
        return asAQI(100);
    }

    let index = 0;
    for (const bp of breakpoints) {
        const isLast = index === breakpoints.length - 1;

        const inRange = isLast
            ? concentration >= bp.breakpointLow && concentration <= bp.breakpointHigh
            : concentration >= bp.breakpointLow && concentration < bp.breakpointHigh;

        if (inRange) {
            const aqi =
                ((bp.aqiHigh - bp.aqiLow) / (bp.breakpointHigh - bp.breakpointLow)) *
                    (concentration - bp.breakpointLow) +
                bp.aqiLow;
            return asAQI(Math.round(aqi));
        }
        index++;
    }
    return asAQI(0);
};

interface SensorData {
    pm2_5: PM2_5 | null;
    co2: CO2Ppm | null;
    voc: VOCIndex | null;
    nox: NOxIndex | null;
    pm10: PM10 | null;
    pm1: PM1 | null;
}

const pollutants: readonly (keyof SensorData)[] = ["pm2_5", "co2", "voc", "nox", "pm10", "pm1"] as const;

const toDescription = Match.type<AQI>().pipe(
    Match.withReturnType<AtmoTubeAQIDescription>(),
    Match.when(
        (index) => index >= 81 && index <= 100,
        () => "good"
    ),
    Match.when(
        (index) => index >= 61 && index <= 80,
        () => "moderate"
    ),
    Match.when(
        (index) => index >= 41 && index <= 60,
        () => "polluted"
    ),
    Match.when(
        (index) => index >= 21 && index <= 40,
        () => "very-polluted"
    ),
    Match.orElse(() => "severely-polluted")
);

/**
 * Calculate the AtmoTube Indoor Air Quality Index (IAQI) from sensor data.
 * Uses the worst (lowest) individual AQI value as the overall index.
 */
export const calculateAtmoTubeIAQI = (sensorData: SensorData): AtmoTubeAQICalculationResult | null => {
    const worstAQI = pollutants.reduce(
        (worstAQI, pollutant) => {
            const concentration = sensorData[pollutant];

            if (concentration !== null) {
                worstAQI.hasValidData = true;
                const aqi = calculateIndividualAQI(concentration, BREAKPOINTS[pollutant]);
                if (aqi < worstAQI.index) {
                    worstAQI.index = aqi;
                }
            }

            return worstAQI;
        },
        { index: 100, hasValidData: false }
    );

    if (!worstAQI.hasValidData) {
        return null;
    }

    const index = asAQI(worstAQI.index);
    return { index, description: toDescription(index) };
};
