import { calculateAbsoluteHumidity } from "./absolute-humidity-calculator";

describe("Absolute humidity point calculator", () => {
    /**
     * Test cases produced by several online calculators:
     *
     * @link http://www.michell.com/us/calculator/
     */
    const testCases: [number | null, number | null, number | null][] = [
        [20, 10, 1.7272960004970925],
        [8, 66, 5.4538077901127595],
        [8, 30, 2.4790035409603455],
        [23, 40, 8.21929164355773],
        [null, 40, null],
        [23, null, null],
        [null, null, null],
    ];

    it.each(testCases)(
        "should calculate the absolute humidity according to the specification. Temperature: %s, RH: %s % should produce: %s",
        (temperature, relativeHumidity, expectedDewPoint) => {
            expect(calculateAbsoluteHumidity(temperature, relativeHumidity)).toEqual(expectedDewPoint);
        }
    );
});
