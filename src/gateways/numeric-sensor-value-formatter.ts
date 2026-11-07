export const formatNumericSensorValue = <T extends number>(value: T | null, decimalPrecision: number): T | null => {
    if (value === null) {
        return null;
    }

    // SAFETY: T only brands a number with its unit, and rounding does not change the unit.
    return parseFloat(value.toFixed(decimalPrecision)) as T;
};
