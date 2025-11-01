import { Peripheral } from "../../../infra/ble-scanner";
import {
    MiFloraMeasurement,
    parseIlluminanceEvent,
    parseInvalidEvent,
    parseLowBatteryEvent,
    parseMoistureEvent,
    parseSoilConductivityEvent,
    parseTemperatureEvent,
} from "./parsing-strategies";
import { Data, Effect, Match } from "effect";
import { Logger } from "../../../infra/logger";

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

const isLowBatteryAdvertisement = (data: Buffer) => data.length === 12 && data[11] === 13;

/**
 * MiFlora sensors seem to sometimes sent ble events that I'm not yet sure what they are.
 * They at least don't seem to follow the same structure as the expected sensors.
 */
const parseMiFloraEventType = (data: Buffer) => {
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

        return MifloraMeasurementEventType.InvalidEvent;
    }
};

const resolveMiFloraParsingStrategy = (data: Buffer, peripheral: Peripheral) =>
    Effect.gen(function* () {
        const eventType = parseMiFloraEventType(data);
        const logger = yield* Logger;

        return yield* Match.value(eventType).pipe(
            Match.when(MifloraMeasurementEventType.Illuminance, () => Effect.succeed(parseIlluminanceEvent)),
            Match.when(MifloraMeasurementEventType.Moisture, () => Effect.succeed(parseMoistureEvent)),
            Match.when(MifloraMeasurementEventType.Temperature, () => Effect.succeed(parseTemperatureEvent)),
            Match.when(MifloraMeasurementEventType.SoilConductivity, () => Effect.succeed(parseSoilConductivityEvent)),
            Match.when(MifloraMeasurementEventType.LowBatteryEvent, () => Effect.succeed(parseLowBatteryEvent)),
            Match.when(MifloraMeasurementEventType.InvalidEvent, () => {
                logger.warn("MiFlora sent invalid data: %s, peripheral: %s", data, peripheral);
                return Effect.succeed(parseInvalidEvent);
            }),
            Match.orElse(() => new UnsupportedMiFloraEventError({ eventType }))
        );
    });

export const parseMiFloraPeripheralAdvertisement = (
    peripheral: Peripheral
): Effect.Effect<SupportedMiFloraMeasurements, MiFloraParsingError, Logger> =>
    Effect.gen(function* () {
        const serviceData = yield* getMiFloraServiceData(peripheral);
        const parsingStrategy = yield* resolveMiFloraParsingStrategy(serviceData, peripheral);

        return yield* Effect.succeed(parsingStrategy(serviceData));
    });
