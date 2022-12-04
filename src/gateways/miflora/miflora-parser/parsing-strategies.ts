import { MifloraMeasurementEventType } from "./index";

enum MiFloraDataOffset {
    Temperature = 15,
    SoilConductivity = 15,
    Moisture = 15,
    Illuminance = 15,
}

export interface MiFloraMeasurement<T extends MifloraMeasurementEventType> {
    measurementType: T;
    data: number;
}

export const parseTemperatureEvent = (data: Buffer): MiFloraMeasurement<MifloraMeasurementEventType.Temperature> => {
    return {
        measurementType: MifloraMeasurementEventType.Temperature,
        data: data.readUInt16LE(MiFloraDataOffset.Temperature) / 10,
    };
};

export const parseSoilConductivityEvent = (
    data: Buffer
): MiFloraMeasurement<MifloraMeasurementEventType.SoilConductivity> => {
    return {
        measurementType: MifloraMeasurementEventType.SoilConductivity,
        data: data.readUInt16LE(MiFloraDataOffset.SoilConductivity),
    };
};

export const parseMoistureEvent = (data: Buffer): MiFloraMeasurement<MifloraMeasurementEventType.Moisture> => {
    return {
        measurementType: MifloraMeasurementEventType.Moisture,
        data: data.readInt8(MiFloraDataOffset.Moisture),
    };
};

export const parseIlluminanceEvent = (data: Buffer): MiFloraMeasurement<MifloraMeasurementEventType.Illuminance> => {
    return {
        measurementType: MifloraMeasurementEventType.Illuminance,
        data: data.readUintLE(MiFloraDataOffset.Illuminance, 3),
    };
};

export const parseInvalidEvent = (): MiFloraMeasurement<MifloraMeasurementEventType.InvalidEvent> => {
    return {
        measurementType: MifloraMeasurementEventType.InvalidEvent,
        data: 0,
    };
};
