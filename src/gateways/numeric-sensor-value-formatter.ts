export const formatNumericSensorValue = (value: number | null, decimalPrecision: number): number | null => {
    if (value === null) {
        return null;
    }

    return parseFloat(value.toFixed(decimalPrecision));
};
