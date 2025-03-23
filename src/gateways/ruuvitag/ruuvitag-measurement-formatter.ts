import { EnhancedRuuviTagSensorData } from "./ruuvitag-sensor-data-decorator";
import { formatNumericSensorValue } from "../numeric-sensor-value-formatter";

export const formatSensorValues = (
    sensorValues: EnhancedRuuviTagSensorData,
    decimalPrecision: number
): EnhancedRuuviTagSensorData => {
    return {
        temperature: formatNumericSensorValue(sensorValues.temperature, decimalPrecision),
        relativeHumidityPercentage: formatNumericSensorValue(sensorValues.relativeHumidityPercentage, decimalPrecision),
        pressure: formatNumericSensorValue(sensorValues.pressure, decimalPrecision),
        accelerationX: formatNumericSensorValue(sensorValues.accelerationX, decimalPrecision),
        accelerationY: formatNumericSensorValue(sensorValues.accelerationY, decimalPrecision),
        accelerationZ: formatNumericSensorValue(sensorValues.accelerationZ, decimalPrecision),
        batteryVoltage: formatNumericSensorValue(sensorValues.batteryVoltage, decimalPrecision),
        dewPoint: formatNumericSensorValue(sensorValues.dewPoint, decimalPrecision),
        heatIndex: sensorValues.heatIndex,
        humidex: sensorValues.humidex,
        absoluteHumidity: formatNumericSensorValue(sensorValues.absoluteHumidity, decimalPrecision),
        macAddress: sensorValues.macAddress,
        txPower: sensorValues.txPower,
        movementCounter: sensorValues.movementCounter,
        measurementSequence: sensorValues.measurementSequence,
    };
};
