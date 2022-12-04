import { calculateHeatIndex } from "./heat-index-calculator";

describe("Heat Index (HI) calculator", () => {
    /**
     * Test cases approximately based on table in wikipedia:
     * @link https://en.wikipedia.org/wiki/Heat_index
     */
    const heatIndexTestCases: [number | null, number | null, number | null][] = [
        [27, 40, 27],
        [32, 40, 32],
        [43, 40, 57],
        [27, 75, 29],
        [33, 75, 46],
        [null, 50, null],
        [20, null, null],
        [null, null, null],
    ];

    it.each(heatIndexTestCases)(
        "should calculate the heat index according to the specification. Temperature: %s, RH: %s % should produce: %s",
        (temperature, relativeHumidity, expectedHeatIndex) => {
            expect(calculateHeatIndex(temperature, relativeHumidity)).toEqual(expectedHeatIndex);
        }
    );
});
