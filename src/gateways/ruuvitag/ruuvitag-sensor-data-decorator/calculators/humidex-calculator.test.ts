import { asCelsius, Celsius } from "../../../units";
import { calculateHumidex } from "./humidex-calculator";

describe("Humidex calculator", () => {
    /**
     * Test cases produced by table in wikipedia.
     *
     * @link https://en.wikipedia.org/wiki/Humidex
     */
    const testCases: [Celsius | null, Celsius | null, number | null][] = [
        [asCelsius(30), asCelsius(15), 34],
        [asCelsius(30), asCelsius(25), 42],
        [asCelsius(43), asCelsius(28), 59],
        [asCelsius(36), asCelsius(10), 37],
        [null, asCelsius(50), null],
        [asCelsius(20), null, null],
        [null, null, null],
    ];

    it.each(testCases)(
        "should calculate the humidex according to the specification. Temperature: %s, Dew point: %s % should produce: %s",
        (temperature, dewPoint, expectedHumidex) => {
            expect(calculateHumidex(temperature, dewPoint)).toEqual(expectedHumidex);
        }
    );
});
