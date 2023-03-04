import { getConfiguration } from "../config";

const config = getConfiguration();
const decimalPrecision = config.decimal_precision;

export const formatNumericSensorValue = (value: number | null): number | null => {
    if (value === null) {
        return null;
    }

    return parseFloat(value.toFixed(decimalPrecision));
};
