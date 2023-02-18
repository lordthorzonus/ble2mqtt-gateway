import { MiFloraMeasurement } from "./miflora-parser/parsing-strategies";
import { MifloraMeasurementEventType, SupportedMiFloraMeasurements } from "./miflora-parser";
import { ConfiguredMiFloraSensors } from "./miflora-gateway";
import { DateTime } from "luxon";

export interface MiFloraSensorMeasurementBuffer {
    temperatureEvent: MiFloraMeasurement<MifloraMeasurementEventType.Temperature> | null;
    moistureEvent: MiFloraMeasurement<MifloraMeasurementEventType.Moisture> | null;
    illuminanceEvent: MiFloraMeasurement<MifloraMeasurementEventType.Illuminance> | null;
    soilConductivityEvent: MiFloraMeasurement<MifloraMeasurementEventType.SoilConductivity> | null;
    bufferReleasedLast: DateTime;
}

const RETAIN_MIFLORA_BUFFER_FOR_SECONDS = 30;

export class MiFloraEventBuffer {
    private readonly sensorBuffer = new Map<string, MiFloraSensorMeasurementBuffer>();

    public constructor(devices: ConfiguredMiFloraSensors) {
        devices.forEach((device) => {
            this.clearBuffer(device.id);
        });
    }

    public isBufferReady(buffer: MiFloraSensorMeasurementBuffer): boolean {
        const isBufferFull =
            buffer.illuminanceEvent !== null &&
            buffer.moistureEvent !== null &&
            buffer.temperatureEvent !== null &&
            buffer.soilConductivityEvent !== null;

        const isBufferTooOld =
            buffer.bufferReleasedLast.diffNow("seconds").seconds <= -RETAIN_MIFLORA_BUFFER_FOR_SECONDS;
        return isBufferFull || isBufferTooOld;
    }

    private static updateBuffer(
        buffer: MiFloraSensorMeasurementBuffer,
        measurement: SupportedMiFloraMeasurements
    ): MiFloraSensorMeasurementBuffer {
        switch (measurement.measurementType) {
            case MifloraMeasurementEventType.Illuminance:
                return { ...buffer, illuminanceEvent: measurement };
            case MifloraMeasurementEventType.Moisture:
                return { ...buffer, moistureEvent: measurement };
            case MifloraMeasurementEventType.SoilConductivity:
                return { ...buffer, soilConductivityEvent: measurement };
            case MifloraMeasurementEventType.Temperature:
                return { ...buffer, temperatureEvent: measurement };
            case MifloraMeasurementEventType.InvalidEvent:
                return { ...buffer };
        }

        throw Error(`Cannot buffer unsupported measurement ${JSON.stringify(measurement)}`);
    }

    public bufferMeasurementEvent(
        deviceId: string,
        measurement: SupportedMiFloraMeasurements
    ): MiFloraSensorMeasurementBuffer {
        const buffer = this.getBuffer(deviceId);

        const updatedBuffer = MiFloraEventBuffer.updateBuffer(buffer, measurement);
        this.sensorBuffer.set(deviceId, updatedBuffer);

        return updatedBuffer;
    }

    private getBuffer(deviceId: string): MiFloraSensorMeasurementBuffer {
        const buffer = this.sensorBuffer.get(deviceId);

        if (!buffer) {
            throw new Error(`No MiFlora sensor configured with id: ${deviceId}`);
        }

        return buffer;
    }

    public clearBuffer(deviceId: string): void {
        const emptySensorMeasurementBuffer: MiFloraSensorMeasurementBuffer = {
            temperatureEvent: null,
            moistureEvent: null,
            illuminanceEvent: null,
            soilConductivityEvent: null,
            bufferReleasedLast: DateTime.now(),
        };

        this.sensorBuffer.set(deviceId, emptySensorMeasurementBuffer);
    }
}
