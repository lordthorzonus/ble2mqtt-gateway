import { Data, Effect } from "effect";
import { OralBModel, OralBSensorData, OralBState, OralBPressure } from "./oralb-sensor-data";
import { asSeconds, asSectorNumber } from "../units";

export const oralbManufacturerId = 220; // 0x00DC

interface OralBRawData {
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

export class NotValidOralBManufacturerIdError extends Data.TaggedError("NotValidOralBManufacturerIdError")<{
    manufacturerId: number;
}> {}

export class InvalidOralBDataLengthError extends Data.TaggedError("InvalidOralBDataLengthError")<{
    length: number;
}> {}

export class UnknownOralBModelError extends Data.TaggedError("UnknownOralBModelError")<{
    modelBytes: string;
}> {}

export type OralBParsingError = NotValidOralBManufacturerIdError | InvalidOralBDataLengthError | UnknownOralBModelError;

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

const MODEL_MODES: Record<OralBModel, Record<number, string>> = {
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

const validateManufacturerId = (data: Buffer): Effect.Effect<void, NotValidOralBManufacturerIdError> =>
    Effect.gen(function* () {
        if (data.length < 2) {
            return yield* new NotValidOralBManufacturerIdError({ manufacturerId: -1 });
        }

        const manufacturerId = data.readUInt16LE(0);
        if (manufacturerId !== oralbManufacturerId) {
            return yield* new NotValidOralBManufacturerIdError({ manufacturerId });
        }
    });

const validateDataLength = (data: Buffer): Effect.Effect<void, InvalidOralBDataLengthError> =>
    Effect.gen(function* () {
        const dataLength = data.length - 2;

        if (dataLength !== 9 && dataLength !== 11) {
            return yield* new InvalidOralBDataLengthError({ length: dataLength });
        }
    });

const extractRawData = (data: Buffer): OralBRawData => {
    const dataLength = data.length - OralBDataOffset.ManufacturerIdEnd;

    const rawData: OralBRawData = {
        modelBytes: data.subarray(OralBDataOffset.ModelBytesStart, OralBDataOffset.ModelBytesEnd),
        state: data.readUInt8(OralBDataOffset.State),
        pressure: data.readUInt8(OralBDataOffset.Pressure),
        timeMinutes: data.readUInt8(OralBDataOffset.TimeMinutes),
        timeSeconds: data.readUInt8(OralBDataOffset.TimeSeconds),
        mode: data.readUInt8(OralBDataOffset.Mode),
        sector: data.readUInt8(OralBDataOffset.Sector),
    };

    if (dataLength === 11) {
        rawData.sectorTimer = data.readUInt8(OralBDataOffset.SectorTimer);
        rawData.numberOfSectors = data.readUInt8(OralBDataOffset.NumberOfSectors);
    }

    return rawData;
};

const resolveModel = (modelBytes: Buffer): Effect.Effect<OralBModel, UnknownOralBModelError> => {
    const modelKey = modelBytes.toString("hex");
    const model = BYTES_TO_MODEL[modelKey];

    if (model === undefined) {
        return new UnknownOralBModelError({ modelBytes: modelKey });
    }

    return Effect.succeed(model);
};

const mapState = (state: number): OralBState | `unknown_state_${number}` => STATES[state] ?? `unknown_state_${state}`;

const mapPressure = (pressure: number): OralBPressure | `unknown_pressure_${number}` =>
    PRESSURE[pressure] ?? `unknown_pressure_${pressure}`;

const mapMode = (mode: number, model: OralBModel): string => {
    const modes = MODEL_MODES[model];
    return modes[mode] ?? `unknown_mode_${mode}`;
};

const mapSector = (sector: number): string => SECTOR_MAP[sector] ?? `unknown_sector_${sector}`;

const resolveSector = (rawData: OralBRawData): string => {
    const brushingTimeSeconds = rawData.timeMinutes * 60 + rawData.timeSeconds;

    if (brushingTimeSeconds === 0 && rawData.state !== 3) {
        return "no_sector";
    }

    return mapSector(rawData.sector);
};

const transformRawDataToSensorData = (
    rawData: OralBRawData,
    modelOverride: OralBModel | undefined
): Effect.Effect<OralBSensorData, UnknownOralBModelError> =>
    Effect.gen(function* () {
        const model = modelOverride ?? (yield* resolveModel(rawData.modelBytes));

        const sensorData: OralBSensorData = {
            state: mapState(rawData.state),
            pressure: mapPressure(rawData.pressure),
            brushingTimeSeconds: asSeconds(rawData.timeMinutes * 60 + rawData.timeSeconds),
            brushingMode: mapMode(rawData.mode, model),
            sector: resolveSector(rawData),
            isBrushing: rawData.state === 3,
        };

        if (rawData.sectorTimer !== undefined) {
            sensorData.sectorTimer = asSeconds(rawData.sectorTimer);
        }

        if (rawData.numberOfSectors !== undefined) {
            sensorData.numberOfSectors = asSectorNumber(rawData.numberOfSectors);
        }

        return sensorData;
    });

export const parse = (
    manufacturerData: Buffer,
    modelOverride?: OralBModel
): Effect.Effect<OralBSensorData, OralBParsingError> =>
    Effect.gen(function* () {
        yield* validateManufacturerId(manufacturerData);
        yield* validateDataLength(manufacturerData);
        const rawData = extractRawData(manufacturerData);
        return yield* transformRawDataToSensorData(rawData, modelOverride);
    });

export const parseOralBModel = (manufacturerData: Buffer): Effect.Effect<OralBModel, OralBParsingError> =>
    Effect.gen(function* () {
        yield* validateManufacturerId(manufacturerData);
        yield* validateDataLength(manufacturerData);
        const rawData = extractRawData(manufacturerData);
        return yield* resolveModel(rawData.modelBytes);
    });
