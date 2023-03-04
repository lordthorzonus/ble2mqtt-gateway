const mockGetConfiguration = jest.fn();

jest.mock("../config", () => ({
    __esModule: true,
    getConfiguration: mockGetConfiguration,
}));

describe("formatNumericSensorValue", () => {
    const testCases = [
        [1.2346, 4, 1.23456789],
        [1.235, 3, 1.23456789],
        [1.23, 2, 1.23456789],
        [1.2, 1, 1.23456789],
        [1, 0, 1.23456789],
        // prettier-ignore
        [0.00, 2, 0.004],
        // prettier-ignore
        [1.00, 2, 1],
        [-1.2346, 4, -1.23456789],
    ];

    afterEach(() => {
        jest.resetAllMocks();
        jest.resetModules();
    });

    it.each(testCases)(
        "should format the value to %d when the configured decimal_precision is %d",
        (expectedValue, decimalPrecision, givenValue) => {
            mockGetConfiguration.mockReturnValue({
                decimal_precision: decimalPrecision,
            });
            const formatNumericSensorValue = require("./numeric-sensor-value-formatter").formatNumericSensorValue;

            expect(formatNumericSensorValue(givenValue)).toBe(expectedValue);
        }
    );

    it("should handle zero and null", () => {
        mockGetConfiguration.mockReturnValue({
            decimal_precision: 2,
        });
        const formatNumericSensorValue = require("./numeric-sensor-value-formatter").formatNumericSensorValue;

        expect(formatNumericSensorValue(0)).toBe(0);
        expect(formatNumericSensorValue(null)).toBeNull();
    });
});
