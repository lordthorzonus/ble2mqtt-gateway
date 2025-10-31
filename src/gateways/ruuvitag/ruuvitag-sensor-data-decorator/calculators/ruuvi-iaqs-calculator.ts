import { AQI, asAQI, CO2Ppm, PM2_5 } from "../../../units";
import { Match } from "effect";

export type RuuviIAQSDescription = "excellent" | "good" | "fair" | "poor" | "very poor";

export interface RuuviIAQSCalculationResult {
    index: AQI;
    description: RuuviIAQSDescription;
}

const AQI_MAX = 100;

const PM25_MIN = 0;
const PM25_MAX = 60;
const PM25_SCALE = AQI_MAX / (PM25_MAX - PM25_MIN);

const CO2_MIN = 420;
const CO2_MAX = 2300;
const CO2_SCALE = AQI_MAX / (CO2_MAX - CO2_MIN);

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

const toDescription = Match.type<AQI>().pipe(
    Match.withReturnType<RuuviIAQSDescription>(),
    Match.when(
        (index) => index >= 90 && index <= 100,
        () => "excellent"
    ),
    Match.when(
        (index) => index >= 80 && index < 90,
        () => "good"
    ),
    Match.when(
        (index) => index >= 50 && index < 80,
        () => "fair"
    ),
    Match.when(
        (index) => index >= 10 && index < 50,
        () => "poor"
    ),
    Match.orElse(() => "very poor")
);

/**
 * Calculates the Ruuvi Indoor Air Quality Score (IAQS) from CO₂ and PM₂.₅ measurements.
 *
 * @see https://docs.ruuvi.com/ruuvi-air-firmware/ruuvi-indoor-air-quality-score-iaqs
 */
export function calculateRuuviIAQS({
    co2,
    pm25,
}: {
    pm25: PM2_5 | null;
    co2: CO2Ppm | null;
}): RuuviIAQSCalculationResult | null {
    if (pm25 === null || co2 === null) {
        return null;
    }

    const clampedPm25 = clamp(pm25, PM25_MIN, PM25_MAX);
    const clampedCo2 = clamp(co2, CO2_MIN, CO2_MAX);

    const dx = (clampedPm25 - PM25_MIN) * PM25_SCALE;
    const dy = (clampedCo2 - CO2_MIN) * CO2_SCALE;

    const distance = Math.hypot(dx, dy);
    const rawIndex = AQI_MAX - distance;
    const index = asAQI(clamp(rawIndex, 0, AQI_MAX));

    return { index, description: toDescription(index) };
}
