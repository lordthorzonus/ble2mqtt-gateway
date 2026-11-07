import { Data, Effect } from "effect";
import {
    OralBModel,
    OralBSensorData,
    OralBState,
    OralBPressure,
    ResolvedOralBModel,
    UNKNOWN_ORALB_MODEL,
} from "./oralb-sensor-data.js";
import { asSeconds, asSectorNumber } from "../units.js";

/** Bluetooth company identifier used by Oral-B toothbrushes (Procter & Gamble). */
export const oralbManufacturerId = 220; // 0x00DC

/** Raw values from an Oral-B advertisement, before mapping to sensor data. */
export interface OralBRawData {
    modelBytes: Buffer;
    state: number;
    pressure: number;
    timeMinutes: number;
    timeSeconds: number;
    mode: number;
    sector: number;
    sectorTimer?: number;
    numberOfSectors?: number;
}

/** The manufacturer data does not start with the Oral-B manufacturer id. */
export class NotValidOralBManufacturerIdError extends Data.TaggedError("NotValidOralBManufacturerIdError")<{
    manufacturerId: number;
}> {}

/** The manufacturer data is not 11 or 13 bytes long (including the manufacturer id), so it can't be parsed. */
export class InvalidOralBDataLengthError extends Data.TaggedError("InvalidOralBDataLengthError")<{
    length: number;
}> {}

/** Failures from parsing an Oral-B advertisement. */
export type OralBParsingError = NotValidOralBManufacturerIdError | InvalidOralBDataLengthError;

const RUNNING_STATE = 3;

enum OralBDataOffset {
    ManufacturerIdStart = 0,
    ManufacturerIdEnd = 2,
    ModelBytesStart = 2,
    ModelBytesEnd = 4,
    State = 5,
    Pressure = 6,
    TimeMinutes = 7,
    TimeSeconds = 8,
    Mode = 9,
    Sector = 10,
    SectorTimer = 11,
    NumberOfSectors = 12,
}

const BYTES_TO_MODEL: Record<string, OralBModel> = {
    "0836": "io_series_6_7",
    "0632": "io_series_6_7",
    "0734": "io_series_4",
    "0356": "smart_series_4000",
    "0427": "smart_series_6000",
    "0322": "smart_series_8000",
    "0321": "smart_series_9000",
    "0631": "io_series_8_9",
    "0202": "triumph_v2",
    "0102": "pro_6000",
    "0471": "genius_x",
};

const SMART_SERIES_MODES: Record<number, string> = {
    0: "off",
    1: "daily_clean",
    2: "sensitive",
    3: "massage",
    4: "whitening",
    5: "deep_clean",
    6: "tongue_cleaning",
    7: "turbo",
    255: "unknown",
};

const SMART_SERIES_6000_MODES: Record<number, string> = {
    ...SMART_SERIES_MODES,
    2: "off",
};

const IO_SERIES_MODES: Record<number, string> = {
    0: "daily_clean",
    1: "sensitive",
    2: "gum_care",
    3: "whiten",
    4: "intense",
    5: "super_sensitive",
    6: "tongue_cleaning",
    8: "settings",
    9: "off",
};

const MODEL_MODES: Record<ResolvedOralBModel, Record<number, string>> = {
    [UNKNOWN_ORALB_MODEL]: {},
    io_series_4: IO_SERIES_MODES,
    io_series_6_7: IO_SERIES_MODES,
    io_series_8: IO_SERIES_MODES,
    io_series_9: IO_SERIES_MODES,
    io_series_8_9: IO_SERIES_MODES,
    smart_series_4000: SMART_SERIES_MODES,
    smart_series_6000: SMART_SERIES_6000_MODES,
    smart_series_7000: SMART_SERIES_MODES,
    smart_series_8000: SMART_SERIES_MODES,
    smart_series_9000: SMART_SERIES_MODES,
    triumph_v2: SMART_SERIES_MODES,
    pro_6000: SMART_SERIES_MODES,
    genius_x: SMART_SERIES_MODES,
};

const STATES: Record<number, OralBState> = {
    0: "unknown",
    1: "initializing",
    2: "idle",
    3: "running",
    4: "charging",
    5: "setup",
    6: "flight_menu",
    8: "selection_menu",
    9: "off",
    113: "final_test",
    114: "pcb_test",
    115: "sleeping",
    116: "transport",
};

const PRESSURE: Record<number, OralBPressure> = {
    0: "normal",
    16: "normal",
    32: "normal",
    48: "normal",
    50: "normal",
    56: "power_button_pressed",
    80: "normal",
    82: "normal",
    86: "button_pressed",
    90: "power_button_pressed",
    114: "normal",
    118: "button_pressed",
    122: "power_button_pressed",
    144: "high",
    146: "high",
    150: "button_pressed",
    154: "power_button_pressed",
    178: "high",
    182: "button_pressed",
    186: "power_button_pressed",
    192: "high",
    240: "high",
    242: "high",
};

const SECTOR_MAP: Record<number, string> = {
    1: "sector_1",
    9: "sector_1",
    2: "sector_2",
    10: "sector_2",
    3: "sector_3",
    11: "sector_3",
    19: "sector_3",
    27: "sector_3",
    4: "sector_4",
    7: "sector_4",
    15: "sector_4",
    31: "sector_4",
    39: "sector_4",
    41: "success",
    42: "success",
    43: "success",
    47: "success",
    55: "success",
};

const DATA_LENGTH_WITHOUT_SECTORS = 11;
const DATA_LENGTH_WITH_SECTORS = 13;

/** Manufacturer data lengths, including the 2-byte manufacturer id. */
const VALID_DATA_LENGTHS: readonly number[] = [DATA_LENGTH_WITHOUT_SECTORS, DATA_LENGTH_WITH_SECTORS];

const requireOralBDataLength = (data: Buffer): Effect.Effect<void, InvalidOralBDataLengthError> =>
    VALID_DATA_LENGTHS.includes(data.length) ? Effect.void : new InvalidOralBDataLengthError({ length: data.length });

const requireOralBManufacturerId = (data: Buffer): Effect.Effect<void, NotValidOralBManufacturerIdError> => {
    const manufacturerId = data.readUInt16LE(OralBDataOffset.ManufacturerIdStart);

    return manufacturerId === oralbManufacturerId
        ? Effect.void
        : new NotValidOralBManufacturerIdError({ manufacturerId });
};

const extractRawData = (data: Buffer): OralBRawData => ({
    modelBytes: data.subarray(OralBDataOffset.ModelBytesStart, OralBDataOffset.ModelBytesEnd),
    state: data.readUInt8(OralBDataOffset.State),
    pressure: data.readUInt8(OralBDataOffset.Pressure),
    timeMinutes: data.readUInt8(OralBDataOffset.TimeMinutes),
    timeSeconds: data.readUInt8(OralBDataOffset.TimeSeconds),
    mode: data.readUInt8(OralBDataOffset.Mode),
    sector: data.readUInt8(OralBDataOffset.Sector),
    ...(data.length === DATA_LENGTH_WITH_SECTORS
        ? {
              sectorTimer: data.readUInt8(OralBDataOffset.SectorTimer),
              numberOfSectors: data.readUInt8(OralBDataOffset.NumberOfSectors),
          }
        : {}),
});

const detectModel = (modelBytes: Buffer): ResolvedOralBModel =>
    BYTES_TO_MODEL[modelBytes.toString("hex")] ?? UNKNOWN_ORALB_MODEL;

const mapState = (state: number): OralBState | `unknown_state_${number}` => STATES[state] ?? `unknown_state_${state}`;

const mapPressure = (pressure: number): OralBPressure | `unknown_pressure_${number}` =>
    PRESSURE[pressure] ?? `unknown_pressure_${pressure}`;

const mapMode = (mode: number, model: ResolvedOralBModel): string => {
    const modes = MODEL_MODES[model];

    return modes[mode] ?? `unknown_mode_${mode}`;
};

const mapSector = (sector: number): string => SECTOR_MAP[sector] ?? `unknown_sector_${sector}`;

const resolveSector = (rawData: OralBRawData): string => {
    const brushingTimeSeconds = rawData.timeMinutes * 60 + rawData.timeSeconds;

    if (brushingTimeSeconds === 0 && rawData.state !== RUNNING_STATE) {
        return "no_sector";
    }

    return mapSector(rawData.sector);
};

/**
 * Maps raw advertisement values to sensor data. Brushing mode names depend on the model.
 */
export const toOralBSensorData = (rawData: OralBRawData, model: ResolvedOralBModel): OralBSensorData => ({
    state: mapState(rawData.state),
    pressure: mapPressure(rawData.pressure),
    brushingTimeSeconds: asSeconds(rawData.timeMinutes * 60 + rawData.timeSeconds),
    brushingMode: mapMode(rawData.mode, model),
    sector: resolveSector(rawData),
    isBrushing: rawData.state === RUNNING_STATE,
    ...(rawData.sectorTimer === undefined ? {} : { sectorTimer: asSeconds(rawData.sectorTimer) }),
    ...(rawData.numberOfSectors === undefined ? {} : { numberOfSectors: asSectorNumber(rawData.numberOfSectors) }),
});

/** A parsed Oral-B advertisement. */
export interface OralBAdvertisement {
    rawData: OralBRawData;
    /** `unknown` when the model bytes are not recognised. */
    detectedModel: ResolvedOralBModel;
}

/**
 * Parses Oral-B manufacturer data.
 *
 * @returns The raw values and the detected model, or `InvalidOralBDataLengthError` /
 * `NotValidOralBManufacturerIdError` when the data is not an Oral-B advertisement.
 */
export const parseOralBAdvertisement = (
    manufacturerData: Buffer
): Effect.Effect<OralBAdvertisement, OralBParsingError> =>
    Effect.gen(function* () {
        yield* requireOralBDataLength(manufacturerData);
        yield* requireOralBManufacturerId(manufacturerData);
        const rawData = extractRawData(manufacturerData);

        return { rawData, detectedModel: detectModel(rawData.modelBytes) };
    });
