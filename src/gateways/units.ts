import { Brand } from "effect";

export type RelativeHumidity = number & Brand.Brand<"RelativeHumidity">;
export const asRelativeHumidity = Brand.nominal<RelativeHumidity>();

export type Celsius = number & Brand.Brand<"Celsius">;
export const asCelsius = Brand.nominal<Celsius>();

export type Pascal = number & Brand.Brand<"Pascal">;
export const asPascal = Brand.nominal<Pascal>();

export type PM1 = number & Brand.Brand<"PM1">;
export const asPM1 = Brand.nominal<PM1>();

export type PM2_5 = number & Brand.Brand<"PM2.5">;
export const asPM2_5 = Brand.nominal<PM2_5>();

export type PM4 = number & Brand.Brand<"PM4">;
export const asPM4 = Brand.nominal<PM4>();

export type PM10 = number & Brand.Brand<"PM10">;
export const asPM10 = Brand.nominal<PM10>();

export type CO2Ppm = number & Brand.Brand<"CO2Ppm">;
export const asCO2Ppm = Brand.nominal<CO2Ppm>();

export type VOCIndex = number & Brand.Brand<"VOCIndex">;
export const asVOCIndex = Brand.nominal<VOCIndex>();

export type NOxIndex = number & Brand.Brand<"NOxIndex">;
export const asNOxIndex = Brand.nominal<NOxIndex>();

export type Lux = number & Brand.Brand<"Lux">;
export const asLux = Brand.nominal<Lux>();

export type SoilMoisture = number & Brand.Brand<"SoilMoisture">;
export const asSoilMoisture = Brand.nominal<SoilMoisture>();

export type SoilConductivity = number & Brand.Brand<"SoilConductivity">;
export const asSoilConductivity = Brand.nominal<SoilConductivity>();

export type AQI = number & Brand.Brand<"AQI">;
export const asAQI = Brand.nominal<AQI>();
