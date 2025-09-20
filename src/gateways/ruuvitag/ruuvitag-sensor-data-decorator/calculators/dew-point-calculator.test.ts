import { asCelsius, asRelativeHumidity, Celsius, RelativeHumidity } from "../../../units";
import { calculateDewPoint } from "./dew-point-calculator";

describe("Dew point calculator", () => {
    /**
     * Test cases produced by several online calculators:
     * @link http://bmcnoldy.rsmas.miami.edu/Humidity.html
     * @link http://www.decatur.de/javascript/dew/index.html
     * @link http://www.dpcalc.org/
     */
    const testCases: [Celsius | null, RelativeHumidity | null, Celsius | null][] = [
        [asCelsius(20), asRelativeHumidity(65), asCelsius(13.2)],
        [asCelsius(11.6), asRelativeHumidity(88), asCelsius(9.7)],
        [asCelsius(13), asRelativeHumidity(50), asCelsius(2.8)],
        [asCelsius(16), asRelativeHumidity(69), asCelsius(10.3)],
        [asCelsius(20), asRelativeHumidity(50), asCelsius(9.3)],
        [null, asRelativeHumidity(50), null],
        [asCelsius(20), null, null],
        [null, null, null],
    ];

    it.each(testCases)(
        "should calculate the dew point according to the specification. Temperature: %s, RH: %s % should produce: %s",
        (temperature, relativeHumidity, expectedDewPoint) => {
            expect(calculateDewPoint(temperature, relativeHumidity)).toEqual(expectedDewPoint);
        }
    );
});
