export const formatNumericSensorValue = <T extends number>(value: T | null, decimalPrecision: number): T | null => {
    if (value === null) {
        return null;
    }

    return parseFloat(value.toFixed(decimalPrecision)) as T;
};
