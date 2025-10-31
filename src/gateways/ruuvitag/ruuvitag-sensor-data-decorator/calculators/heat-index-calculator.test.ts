import { asCelsius, asRelativeHumidity, Celsius, RelativeHumidity } from "../../../units";
import { calculateHeatIndex } from "./heat-index-calculator";

describe("Heat Index (HI) calculator", () => {
    /**
     * Test cases approximately based on table in wikipedia:
     * @link https://en.wikipedia.org/wiki/Heat_index
     */
    const heatIndexTestCases: [Celsius | null, RelativeHumidity | null, number | null][] = [
        [asCelsius(27), asRelativeHumidity(40), 27],
        [asCelsius(32), asRelativeHumidity(40), 32],
        [asCelsius(43), asRelativeHumidity(40), 57],
        [asCelsius(27), asRelativeHumidity(75), 29],
        [asCelsius(33), asRelativeHumidity(75), 46],
        [null, asRelativeHumidity(50), null],
        [asCelsius(20), null, null],
        [null, null, null],
    ];

    it.each(heatIndexTestCases)(
        "should calculate the heat index according to the specification. Temperature: %s, RH: %s % should produce: %s",
        (temperature, relativeHumidity, expectedHeatIndex) => {
            expect(calculateHeatIndex(temperature, relativeHumidity)).toEqual(expectedHeatIndex);
        }
    );
});
