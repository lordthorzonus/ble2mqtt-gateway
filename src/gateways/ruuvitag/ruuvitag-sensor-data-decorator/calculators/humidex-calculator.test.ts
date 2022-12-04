import { calculateHumidex } from "./humidex-calculator";

describe("Humidex calculator", () => {
    /**
     * Test cases produced by table in wikipedia.
     *
     * @link https://en.wikipedia.org/wiki/Humidex
     */
    const testCases: [number | null, number | null, number | null][] = [
        [30, 15, 34],
        [30, 25, 42],
        [43, 28, 59],
        [36, 10, 37],
        [null, 50, null],
        [20, null, null],
        [null, null, null],
    ];

    it.each(testCases)(
        "should calculate the humidex according to the specification. Temperature: %s, Dew point: %s % should produce: %s",
        (temperature, dewPoint, expectedHumidex) => {
            expect(calculateHumidex(temperature, dewPoint)).toEqual(expectedHumidex);
        }
    );
});
