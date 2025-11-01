import { asCelsius, asRelativeHumidity, Celsius, RelativeHumidity } from "../../../units";
import {
    calculateBreezeIndoorClimateIndex,
    BreezeIndoorClimateIndexDescription,
} from "./breeze-indoor-climate-index-calculator";

describe("Breeze Indoor Climate Index calculator", () => {
    /**
     * Test cases based on the lookup table from Breeze Technologies.
     * Format: [temperature, humidity, expected index, expected description]
     *
     * @see https://www.breeze-technologies.de/blog/calculating-an-actionable-indoor-air-quality-index/
     */
    const exactTableTestCases: [Celsius, RelativeHumidity, number, BreezeIndoorClimateIndexDescription][] = [
        [asCelsius(20), asRelativeHumidity(50), 1, "excellent"],
        [asCelsius(21), asRelativeHumidity(50), 1, "excellent"],
        [asCelsius(20), asRelativeHumidity(60), 1, "excellent"],
        [asCelsius(21), asRelativeHumidity(60), 1, "excellent"],
        [asCelsius(19), asRelativeHumidity(60), 1, "excellent"],

        [asCelsius(19), asRelativeHumidity(50), 2, "fine"],
        [asCelsius(22), asRelativeHumidity(40), 2, "fine"],
        [asCelsius(22), asRelativeHumidity(60), 2, "fine"],
        [asCelsius(23), asRelativeHumidity(50), 2, "fine"],

        [asCelsius(18), asRelativeHumidity(50), 3, "moderate"],
        [asCelsius(24), asRelativeHumidity(50), 3, "moderate"],
        [asCelsius(19), asRelativeHumidity(40), 3, "moderate"],
        [asCelsius(23), asRelativeHumidity(70), 3, "moderate"],

        [asCelsius(17), asRelativeHumidity(50), 4, "poor"],
        [asCelsius(25), asRelativeHumidity(50), 4, "poor"],
        [asCelsius(18), asRelativeHumidity(30), 4, "poor"],

        [asCelsius(16), asRelativeHumidity(50), 5, "very-poor"],
        [asCelsius(26), asRelativeHumidity(50), 5, "very-poor"],
        [asCelsius(17), asRelativeHumidity(20), 5, "very-poor"],
        [asCelsius(24), asRelativeHumidity(80), 5, "very-poor"],

        [asCelsius(15), asRelativeHumidity(10), 6, "severe"],
        [asCelsius(28), asRelativeHumidity(10), 6, "severe"],
        [asCelsius(15), asRelativeHumidity(90), 6, "severe"],
        [asCelsius(28), asRelativeHumidity(90), 6, "severe"],
        [asCelsius(20), asRelativeHumidity(10), 6, "severe"],
    ];

    it.each(exactTableTestCases)(
        "should calculate correct index for exact table values: temp=%s°C, humidity=%s%% -> index=%s (%s)",
        (temperature, humidity, expectedIndex, expectedDescription) => {
            const result = calculateBreezeIndoorClimateIndex(temperature, humidity);
            expect(result).not.toBeNull();
            expect(result?.index).toBe(expectedIndex);
            expect(result?.description).toBe(expectedDescription);
        }
    );

    describe("Interpolation", () => {
        it("should interpolate between table values for intermediate temperatures", () => {
            const result = calculateBreezeIndoorClimateIndex(asCelsius(20.5), asRelativeHumidity(50));
            expect(result).not.toBeNull();
            expect(result?.index).toBeGreaterThanOrEqual(1);
            expect(result?.index).toBeLessThanOrEqual(2);
        });

        it("should interpolate between table values for intermediate humidity", () => {
            const result = calculateBreezeIndoorClimateIndex(asCelsius(20), asRelativeHumidity(55));
            expect(result).not.toBeNull();
            expect(result?.index).toBeGreaterThanOrEqual(1);
            expect(result?.index).toBeLessThanOrEqual(2);
        });

        it("should interpolate between table values for both intermediate temperature and humidity", () => {
            const result = calculateBreezeIndoorClimateIndex(asCelsius(21.5), asRelativeHumidity(65));
            expect(result).not.toBeNull();
            expect(result?.index).toBeGreaterThanOrEqual(1);
            expect(result?.index).toBeLessThanOrEqual(3);
        });
    });

    describe("Edge cases", () => {
        it("should handle null temperature", () => {
            const result = calculateBreezeIndoorClimateIndex(null, asRelativeHumidity(50));
            expect(result).toBeNull();
        });

        it("should handle null humidity", () => {
            const result = calculateBreezeIndoorClimateIndex(asCelsius(20), null);
            expect(result).toBeNull();
        });

        it("should handle both null values", () => {
            const result = calculateBreezeIndoorClimateIndex(null, null);
            expect(result).toBeNull();
        });

        it("should clamp temperature below minimum (below 15°C)", () => {
            const result = calculateBreezeIndoorClimateIndex(asCelsius(10), asRelativeHumidity(50));
            expect(result).not.toBeNull();
            expect(result?.index).toBeGreaterThanOrEqual(1);
            expect(result?.index).toBeLessThanOrEqual(6);
        });

        it("should clamp temperature above maximum (above 28°C)", () => {
            const result = calculateBreezeIndoorClimateIndex(asCelsius(35), asRelativeHumidity(50));
            expect(result).not.toBeNull();
            expect(result?.index).toBeGreaterThanOrEqual(1);
            expect(result?.index).toBeLessThanOrEqual(6);
        });

        it("should clamp humidity below minimum (below 10%)", () => {
            const result = calculateBreezeIndoorClimateIndex(asCelsius(20), asRelativeHumidity(5));
            expect(result).not.toBeNull();
            expect(result?.index).toBeGreaterThanOrEqual(1);
            expect(result?.index).toBeLessThanOrEqual(6);
        });

        it("should clamp humidity above maximum (above 90%)", () => {
            const result = calculateBreezeIndoorClimateIndex(asCelsius(20), asRelativeHumidity(95));
            expect(result).not.toBeNull();
            expect(result?.index).toBeGreaterThanOrEqual(1);
            expect(result?.index).toBeLessThanOrEqual(6);
        });

        it("should clamp extreme interpolation values", () => {
            const extremeTestCases: [Celsius, RelativeHumidity][] = [
                [asCelsius(5), asRelativeHumidity(5)],
                [asCelsius(40), asRelativeHumidity(100)],
                [asCelsius(-10), asRelativeHumidity(50)],
                [asCelsius(20), asRelativeHumidity(0)],
            ];

            extremeTestCases.forEach(([temp, humidity]) => {
                const result = calculateBreezeIndoorClimateIndex(temp, humidity);
                expect(result).not.toBeNull();
                expect(result?.index).toBeGreaterThanOrEqual(1);
                expect(result?.index).toBeLessThanOrEqual(6);
            });
        });
    });

    describe("Description mapping", () => {
        it("should map index 1 to excellent", () => {
            const result = calculateBreezeIndoorClimateIndex(asCelsius(20), asRelativeHumidity(50));
            expect(result?.description).toBe("excellent");
        });

        it("should map index 2 to fine", () => {
            const result = calculateBreezeIndoorClimateIndex(asCelsius(19), asRelativeHumidity(50));
            expect(result?.description).toBe("fine");
        });

        it("should map index 3 to moderate", () => {
            const result = calculateBreezeIndoorClimateIndex(asCelsius(18), asRelativeHumidity(50));
            expect(result?.description).toBe("moderate");
        });

        it("should map index 4 to poor", () => {
            const result = calculateBreezeIndoorClimateIndex(asCelsius(17), asRelativeHumidity(50));
            expect(result?.description).toBe("poor");
        });

        it("should map index 5 to very-poor", () => {
            const result = calculateBreezeIndoorClimateIndex(asCelsius(16), asRelativeHumidity(50));
            expect(result?.description).toBe("very-poor");
        });

        it("should map index 6 to severe", () => {
            const result = calculateBreezeIndoorClimateIndex(asCelsius(20), asRelativeHumidity(10));
            expect(result?.description).toBe("severe");
        });
    });
});
