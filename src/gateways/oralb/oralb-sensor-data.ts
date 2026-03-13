import { Seconds, SectorNumber } from "../units";

export type OralBModel =
    | "io_series_4"
    | "io_series_6_7"
    | "io_series_8"
    | "io_series_9"
    | "io_series_8_9"
    | "smart_series_4000"
    | "smart_series_6000"
    | "smart_series_7000"
    | "smart_series_8000"
    | "smart_series_9000"
    | "triumph_v2"
    | "pro_6000"
    | "genius_x";

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

export type OralBPressure = "normal" | "high" | "button_pressed" | "power_button_pressed";

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
