import { Data, Effect } from "effect";

/** MiFlora event type read from the Xiaomi service data, plus the synthetic low-battery and invalid events. */
export enum MifloraMeasurementEventType {
    Temperature = 4100,
    Illuminance = 4103,
    Moisture = 4104,
    SoilConductivity = 4105,
    LowBatteryEvent = 9998,
    InvalidEvent = 9999,
}

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

/** The service data is shorter than the bytes its measurement event reads. */
export class InvalidMiFloraDataLengthError extends Data.TaggedError("InvalidMiFloraDataLengthError")<{
    eventType: MifloraMeasurementEventType;
    length: number;
    minimumLength: number;
}> {}

/**
 * Fails when `data` is shorter than the bytes an event reads, so strategies never read out of range.
 */
const requireMinimumLength = (
    data: Buffer,
    eventType: MifloraMeasurementEventType,
    minimumLength: number
): Effect.Effect<Buffer, InvalidMiFloraDataLengthError> =>
    data.length < minimumLength
        ? new InvalidMiFloraDataLengthError({ eventType, length: data.length, minimumLength })
        : Effect.succeed(data);

/**
 * How a measurement value is stored: its size in bytes and how to read it at an offset.
 */
interface MeasurementField {
    byteLength: number;
    read: (data: Buffer, offset: number) => number;
}

const UINT16_LE: MeasurementField = { byteLength: 2, read: (data, offset) => data.readUInt16LE(offset) };
const INT8: MeasurementField = { byteLength: 1, read: (data, offset) => data.readInt8(offset) };
const UINT24_LE: MeasurementField = { byteLength: 3, read: (data, offset) => data.readUintLE(offset, 3) };

/**
 * Builds a parser for one measurement event. The minimum length comes from the offset and the field size,
 * so the parser fails with InvalidMiFloraDataLengthError instead of reading out of range.
 */
const makeMiFloraMeasurementParser =
    <T extends MifloraMeasurementEventType>(eventType: T, offset: number, field: MeasurementField, scale = 1) =>
    (data: Buffer): Effect.Effect<MiFloraMeasurement<T>, InvalidMiFloraDataLengthError> =>
        Effect.map(requireMinimumLength(data, eventType, offset + field.byteLength), (validData) => ({
            measurementType: eventType,
            data: field.read(validData, offset) / scale,
        }));

export const parseTemperatureEvent = makeMiFloraMeasurementParser(
    MifloraMeasurementEventType.Temperature,
    MiFloraDataOffset.Temperature,
    UINT16_LE,
    10
);

export const parseSoilConductivityEvent = makeMiFloraMeasurementParser(
    MifloraMeasurementEventType.SoilConductivity,
    MiFloraDataOffset.SoilConductivity,
    UINT16_LE
);

export const parseMoistureEvent = makeMiFloraMeasurementParser(
    MifloraMeasurementEventType.Moisture,
    MiFloraDataOffset.Moisture,
    INT8
);

export const parseIlluminanceEvent = makeMiFloraMeasurementParser(
    MifloraMeasurementEventType.Illuminance,
    MiFloraDataOffset.Illuminance,
    UINT24_LE
);

export const parseLowBatteryEvent = (): Effect.Effect<
    MiFloraMeasurement<MifloraMeasurementEventType.LowBatteryEvent>
> =>
    Effect.succeed({
        measurementType: MifloraMeasurementEventType.LowBatteryEvent,
        data: 1,
    });

export const parseInvalidEvent = (): Effect.Effect<MiFloraMeasurement<MifloraMeasurementEventType.InvalidEvent>> =>
    Effect.succeed({
        measurementType: MifloraMeasurementEventType.InvalidEvent,
        data: 0,
    });
