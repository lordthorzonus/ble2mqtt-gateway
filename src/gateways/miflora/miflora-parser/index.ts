import { Peripheral } from "@abandonware/noble";
import {
    MiFloraMeasurement,
    parseIlluminanceEvent,
    parseMoistureEvent,
    parseSoilConductivityEvent,
    parseTemperatureEvent,
} from "./parsing-strategies";

const XiaomiServiceId = "fe95";

export enum MifloraMeasurementEventType {
    Temperature = 4100,
    Illuminance = 4103,
    Moisture = 4104,
    SoilConductivity = 4105,
}

const getMiFloraServiceData = (peripheral: Peripheral) => {
    const xiaomiService = peripheral.advertisement.serviceData.find((service) => service.uuid === XiaomiServiceId);

    if (!xiaomiService) {
        throw new Error(
            `Not a valid MiFlora device advertisement. Could not find a service with uuid: "${XiaomiServiceId}"`
        );
    }

    return xiaomiService.data;
};

export type SupportedMiFloraMeasurements =
    | MiFloraMeasurement<MifloraMeasurementEventType.Temperature>
    | MiFloraMeasurement<MifloraMeasurementEventType.Illuminance>
    | MiFloraMeasurement<MifloraMeasurementEventType.SoilConductivity>
    | MiFloraMeasurement<MifloraMeasurementEventType.Moisture>;

type MiFloraMeasurementEventParsingStrategy = (data: Buffer) => SupportedMiFloraMeasurements;

const MiFloraMeasurementEventParsingStrategyMap = new Map<
    MifloraMeasurementEventType,
    MiFloraMeasurementEventParsingStrategy
>([
    [MifloraMeasurementEventType.Illuminance, parseIlluminanceEvent],
    [MifloraMeasurementEventType.Moisture, parseMoistureEvent],
    [MifloraMeasurementEventType.Temperature, parseTemperatureEvent],
    [MifloraMeasurementEventType.SoilConductivity, parseSoilConductivityEvent],
]);

const resolveMiFloraParsingStrategy = (data: Buffer) => {
    const eventType = data.readUInt16LE(12);
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
