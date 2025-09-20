import { asCelsius, asRelativeHumidity, Celsius, RelativeHumidity } from "../../../units";
import { calculateAbsoluteHumidity } from "./absolute-humidity-calculator";

describe("Absolute humidity point calculator", () => {
    /**
     * Test cases produced by several online calculators:
     *
     * @link http://www.michell.com/us/calculator/
     */
    const testCases: [Celsius | null, RelativeHumidity | null, number | null][] = [
        [asCelsius(20), asRelativeHumidity(10), 1.7272960004970925],
        [asCelsius(8), asRelativeHumidity(66), 5.4538077901127595],
        [asCelsius(8), asRelativeHumidity(30), 2.4790035409603455],
        [asCelsius(23), asRelativeHumidity(40), 8.21929164355773],
        [null, asRelativeHumidity(40), null],
        [asCelsius(23), null, null],
        [null, null, null],
    ];

    it.each(testCases)(
        "should calculate the absolute humidity according to the specification. Temperature: %s, RH: %s % should produce: %s",
        (temperature, relativeHumidity, expectedDewPoint) => {
            expect(calculateAbsoluteHumidity(temperature, relativeHumidity)).toEqual(expectedDewPoint);
        }
    );
});
