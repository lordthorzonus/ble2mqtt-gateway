import { Peripheral } from "../../../infra/ble-scanner";
import {
    MiFloraMeasurement,
    parseIlluminanceEvent,
    parseInvalidEvent,
    parseLowBatteryEvent,
    parseMoistureEvent,
    parseSoilConductivityEvent,
    parseTemperatureEvent,
    InvalidMiFloraDataLengthError,
    MifloraMeasurementEventType,
} from "./parsing-strategies";
import { Data, Effect, Match } from "effect";

export { InvalidMiFloraDataLengthError, MifloraMeasurementEventType };

const XiaomiServiceId = "fe95";

export class InvalidMiFloraAdvertisementError extends Data.TaggedError("InvalidMiFloraAdvertisementError")<{
    peripheral: Peripheral;
}> {}

export class UnsupportedMiFloraEventError extends Data.TaggedError("UnsupportedMiFloraEventError")<{
    eventType: number;
}> {}

export type MiFloraParsingError =
    InvalidMiFloraAdvertisementError | UnsupportedMiFloraEventError | InvalidMiFloraDataLengthError;

const getMiFloraServiceData = (peripheral: Peripheral): Effect.Effect<Buffer, InvalidMiFloraAdvertisementError> => {
    const xiaomiService = peripheral.advertisement.serviceData.find((service) => service.uuid === XiaomiServiceId);

    if (!xiaomiService) {
        return new InvalidMiFloraAdvertisementError({ peripheral });
    }

    return Effect.succeed(xiaomiService.data);
};

export type SupportedMiFloraMeasurements =
    | MiFloraMeasurement<MifloraMeasurementEventType.Temperature>
    | MiFloraMeasurement<MifloraMeasurementEventType.Illuminance>
    | MiFloraMeasurement<MifloraMeasurementEventType.SoilConductivity>
    | MiFloraMeasurement<MifloraMeasurementEventType.Moisture>
    | MiFloraMeasurement<MifloraMeasurementEventType.LowBatteryEvent>
    | MiFloraMeasurement<MifloraMeasurementEventType.InvalidEvent>;

const isLowBatteryAdvertisement = (data: Buffer) => data.length === 12 && data[11] === 13;

const EVENT_TYPE_OFFSET = 12;
const EVENT_TYPE_LENGTH = 2;

/**
 * MiFlora sensors seem to sometimes sent ble events that I'm not yet sure what they are.
 * They at least don't seem to follow the same structure as the expected sensors.
 */
const parseMiFloraEventType = (data: Buffer): number => {
    if (data.length >= EVENT_TYPE_OFFSET + EVENT_TYPE_LENGTH) {
        return data.readUInt16LE(EVENT_TYPE_OFFSET);
    }

    /**
     * Miflora sensors seem to start sending this advertisement when battery is low.
     * I haven't been able to find any documentation on this, but it seems to be the case.
     */
    if (isLowBatteryAdvertisement(data)) {
        return MifloraMeasurementEventType.LowBatteryEvent;
    }

    return MifloraMeasurementEventType.InvalidEvent;
};

const resolveMiFloraParsingStrategy = Match.type<number>().pipe(
    Match.when(MifloraMeasurementEventType.Illuminance, () => Effect.succeed(parseIlluminanceEvent)),
    Match.when(MifloraMeasurementEventType.Moisture, () => Effect.succeed(parseMoistureEvent)),
    Match.when(MifloraMeasurementEventType.Temperature, () => Effect.succeed(parseTemperatureEvent)),
    Match.when(MifloraMeasurementEventType.SoilConductivity, () => Effect.succeed(parseSoilConductivityEvent)),
    Match.when(MifloraMeasurementEventType.LowBatteryEvent, () => Effect.succeed(parseLowBatteryEvent)),
    Match.when(MifloraMeasurementEventType.InvalidEvent, () => Effect.succeed(parseInvalidEvent)),
    Match.orElse((eventType) => new UnsupportedMiFloraEventError({ eventType }))
);

export const parseMiFloraPeripheralAdvertisement = (
    peripheral: Peripheral
): Effect.Effect<SupportedMiFloraMeasurements, MiFloraParsingError> =>
    Effect.gen(function* () {
        const serviceData = yield* getMiFloraServiceData(peripheral);
        const eventType = parseMiFloraEventType(serviceData);
        const parsingStrategy = yield* resolveMiFloraParsingStrategy(eventType);

        return yield* parsingStrategy(serviceData);
    });
