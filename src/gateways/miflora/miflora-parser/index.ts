import { Peripheral } from "@abandonware/noble";
import {
    MiFloraMeasurement,
    parseIlluminanceEvent,
    parseInvalidEvent,
    parseMoistureEvent,
    parseSoilConductivityEvent,
    parseTemperatureEvent,
} from "./parsing-strategies";
import { logger } from "../../../infra/logger";

const XiaomiServiceId = "fe95";

export enum MifloraMeasurementEventType {
    Temperature = 4100,
    Illuminance = 4103,
    Moisture = 4104,
    SoilConductivity = 4105,
    InvalidEvent = 9999,
}

const getMiFloraServiceData = (peripheral: Peripheral) => {
    const xiaomiService = peripheral.advertisement.serviceData.find((service) => service.uuid === XiaomiServiceId);

    if (!xiaomiService) {
        throw new Error(
            `Not a valid MiFlora device advertisement. Could not find a service with uuid: "${XiaomiServiceId}". Advertisement: ${JSON.stringify(
                peripheral.advertisement
            )}`
        );
    }

    return xiaomiService.data;
};

export type SupportedMiFloraMeasurements =
    | MiFloraMeasurement<MifloraMeasurementEventType.Temperature>
    | MiFloraMeasurement<MifloraMeasurementEventType.Illuminance>
    | MiFloraMeasurement<MifloraMeasurementEventType.SoilConductivity>
    | MiFloraMeasurement<MifloraMeasurementEventType.Moisture>
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
    [MifloraMeasurementEventType.InvalidEvent, parseInvalidEvent],
]);

/**
 * MiFlora sensors seem to sometimes sent ble events that I'm not yet sure what they are.
 * They at least don't seem to follow the same structure as the expected sensors.
 */
const parseMiFloraEventType = (data: Buffer) => {
    try {
        return data.readUInt16LE(12);
    } catch (e) {
        logger.warn("MiFlora sent invalid data: %p", data);

        return MifloraMeasurementEventType.InvalidEvent;
    }
};

const resolveMiFloraParsingStrategy = (data: Buffer) => {
    const eventType = parseMiFloraEventType(data);
    const parsingStrategy = MiFloraMeasurementEventParsingStrategyMap.get(eventType);

    if (!parsingStrategy) {
        throw new Error(`Unsupported MiFlora event got: ${eventType}`);
    }

    return parsingStrategy;
};

export const parseMiFloraPeripheralAdvertisement = (peripheral: Peripheral): SupportedMiFloraMeasurements => {
    const serviceData = getMiFloraServiceData(peripheral);
    const parsingStrategy = resolveMiFloraParsingStrategy(serviceData);

    return parsingStrategy(serviceData);
};
