import { Peripheral } from "@abandonware/noble";
import {
    MiFloraMeasurement,
    parseIlluminanceEvent,
    parseInvalidEvent,
    parseLowBatteryEvent,
    parseMoistureEvent,
    parseSoilConductivityEvent,
    parseTemperatureEvent,
} from "./parsing-strategies";
import { logger } from "../../../infra/logger";
import { Data, Effect, pipe } from "effect";

const XiaomiServiceId = "fe95";

export enum MifloraMeasurementEventType {
    Temperature = 4100,
    Illuminance = 4103,
    Moisture = 4104,
    SoilConductivity = 4105,
    LowBatteryEvent = 9998,
    InvalidEvent = 9999,
}

export class InvalidMiFloraAdvertisementError extends Data.TaggedError("InvalidMiFloraAdvertisementError")<{
    peripheral: Peripheral;
}> {}

export class UnsupportedMiFloraEventError extends Data.TaggedError("UnsupportedMiFloraEventError")<{
    eventType: number;
}> {}

export type MiFloraParsingError = InvalidMiFloraAdvertisementError | UnsupportedMiFloraEventError;

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

type MiFloraMeasurementEventParsingStrategy = (data: Buffer) => SupportedMiFloraMeasurements;

const MiFloraMeasurementEventParsingStrategyMap = new Map<
    MifloraMeasurementEventType,
    MiFloraMeasurementEventParsingStrategy
>([
    [MifloraMeasurementEventType.Illuminance, parseIlluminanceEvent],
    [MifloraMeasurementEventType.Moisture, parseMoistureEvent],
    [MifloraMeasurementEventType.Temperature, parseTemperatureEvent],
    [MifloraMeasurementEventType.SoilConductivity, parseSoilConductivityEvent],
    [MifloraMeasurementEventType.LowBatteryEvent, parseLowBatteryEvent],
    [MifloraMeasurementEventType.InvalidEvent, parseInvalidEvent],
]);

const isLowBatteryAdvertisement = (data: Buffer) => data.length === 12 && data[11] === 13;

/**
 * MiFlora sensors seem to sometimes sent ble events that I'm not yet sure what they are.
 * They at least don't seem to follow the same structure as the expected sensors.
 */
const parseMiFloraEventType = (data: Buffer, peripheral: Peripheral) => {
    try {
        return data.readUInt16LE(12);
    } catch (_e) {
        /**
         * Miflora sensors seem to start sending this advertisement when battery is low.
         * I haven't been able to find any documentation on this, but it seems to be the case.
         */
        if (isLowBatteryAdvertisement(data)) {
            return MifloraMeasurementEventType.LowBatteryEvent;
        }

        logger.warn("MiFlora sent invalid data: %s, peripheral: %s", data, peripheral);

        return MifloraMeasurementEventType.InvalidEvent;
    }
};

const resolveMiFloraParsingStrategy = (
    data: Buffer,
    peripheral: Peripheral
): Effect.Effect<MiFloraMeasurementEventParsingStrategy, UnsupportedMiFloraEventError> => {
    const eventType = parseMiFloraEventType(data, peripheral);
    const parsingStrategy = MiFloraMeasurementEventParsingStrategyMap.get(eventType);

    if (!parsingStrategy) {
        return new UnsupportedMiFloraEventError({ eventType });
    }

    return Effect.succeed(parsingStrategy);
};

export const parseMiFloraPeripheralAdvertisement = (
    peripheral: Peripheral
): Effect.Effect<SupportedMiFloraMeasurements, MiFloraParsingError> =>
    Effect.gen(function* () {
        const serviceData = yield* getMiFloraServiceData(peripheral);
        const parsingStrategy = yield* resolveMiFloraParsingStrategy(serviceData, peripheral);

        return yield* Effect.succeed(parsingStrategy(serviceData));
    });
