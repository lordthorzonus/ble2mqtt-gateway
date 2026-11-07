import { Seconds, SectorNumber } from "../units";

/** Oral-B models that can be detected or configured as an override. */
export const OralBModels = [
    "io_series_4",
    "io_series_6_7",
    "io_series_8",
    "io_series_9",
    "io_series_8_9",
    "smart_series_4000",
    "smart_series_6000",
    "smart_series_7000",
    "smart_series_8000",
    "smart_series_9000",
    "triumph_v2",
    "pro_6000",
    "genius_x",
] as const;

/** A known Oral-B model. */
export type OralBModel = (typeof OralBModels)[number];

/** Model reported when there is no configured override and the model bytes are not recognised. */
export const UNKNOWN_ORALB_MODEL = "unknown";

/**
 * Model used for parsing: the configured override, the model detected from the advertisement,
 * or `unknown` when neither is available. Mode names are model specific, so `unknown` maps every
 * mode to `unknown_mode_N`.
 */
export type ResolvedOralBModel = OralBModel | typeof UNKNOWN_ORALB_MODEL;

/** Toothbrush state reported in the advertisement. */
export type OralBState =
    | "unknown"
    | "initializing"
    | "idle"
    | "running"
    | "charging"
    | "setup"
    | "flight_menu"
    | "selection_menu"
    | "off"
    | "final_test"
    | "pcb_test"
    | "sleeping"
    | "transport";

/** Brushing pressure reported in the advertisement. Button presses share the pressure byte. */
export type OralBPressure = "normal" | "high" | "button_pressed" | "power_button_pressed";

/**
 * Oral-B sensor values published to MQTT. Unknown raw values are kept as `unknown_<field>_<value>` strings.
 */
export interface OralBSensorData {
    state: OralBState | `unknown_state_${number}`;
    pressure: OralBPressure | `unknown_pressure_${number}`;
    brushingTimeSeconds: Seconds;
    brushingMode: string;
    sector: string;
    sectorTimer?: Seconds;
    numberOfSectors?: SectorNumber;
    isBrushing: boolean;
}
