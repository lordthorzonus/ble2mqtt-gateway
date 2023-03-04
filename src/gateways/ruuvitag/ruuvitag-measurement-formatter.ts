import { EnhancedRuuviTagSensorData } from "./ruuvitag-sensor-data-decorator";
import { formatNumericSensorValue } from "../numeric-sensor-value-formatter";

export const formatSensorValues = (sensorValues: EnhancedRuuviTagSensorData): EnhancedRuuviTagSensorData => {
    return {
        temperature: formatNumericSensorValue(sensorValues.temperature),
        relativeHumidityPercentage: formatNumericSensorValue(sensorValues.relativeHumidityPercentage),
        pressure: formatNumericSensorValue(sensorValues.pressure),
        accelerationX: formatNumericSensorValue(sensorValues.accelerationX),
        accelerationY: formatNumericSensorValue(sensorValues.accelerationY),
        accelerationZ: formatNumericSensorValue(sensorValues.accelerationZ),
        batteryVoltage: formatNumericSensorValue(sensorValues.batteryVoltage),
        dewPoint: formatNumericSensorValue(sensorValues.dewPoint),
        heatIndex: sensorValues.heatIndex,
        humidex: sensorValues.humidex,
        absoluteHumidity: formatNumericSensorValue(sensorValues.absoluteHumidity),
        macAddress: sensorValues.macAddress,
        txPower: sensorValues.txPower,
        movementCounter: sensorValues.movementCounter,
        measurementSequence: sensorValues.measurementSequence,
    };
};
