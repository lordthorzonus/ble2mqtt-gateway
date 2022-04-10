const HeatIndexConstantsCelsius = {
    c1: -8.78469475556,
    c2: 1.61139411,
    c3: 2.33854883889,
    c4: -0.14611605,
    c5: -0.012308094,
    c6: -0.0164248277778,
    c7: 0.002211732,
    c8: 0.00072546,
    c9: -0.000003582,
};

/**
 * Calculates the Heat index (HI) which is usually the value
 * which is displayed as "feels like" temperature in weather services.
 *
 * @see https://en.wikipedia.org/wiki/Heat_index
 *
 * @return Returns the HI in celsius.
 */
export const calculateHeatIndex = (
    temperatureInCelsius: number | null,
    relativeHumidityInPercents: number | null
): number | null => {
    if (temperatureInCelsius === null || relativeHumidityInPercents === null) {
        return null;
    }

    const heatIndex =
        HeatIndexConstantsCelsius.c1 +
        HeatIndexConstantsCelsius.c2 * temperatureInCelsius +
        HeatIndexConstantsCelsius.c3 * relativeHumidityInPercents +
        HeatIndexConstantsCelsius.c4 * temperatureInCelsius * relativeHumidityInPercents +
        HeatIndexConstantsCelsius.c5 * Math.pow(temperatureInCelsius, 2) +
        HeatIndexConstantsCelsius.c6 * Math.pow(relativeHumidityInPercents, 2) +
        HeatIndexConstantsCelsius.c7 * Math.pow(temperatureInCelsius, 2) * relativeHumidityInPercents +
        HeatIndexConstantsCelsius.c8 * temperatureInCelsius * Math.pow(relativeHumidityInPercents, 2) +
        HeatIndexConstantsCelsius.c9 * Math.pow(temperatureInCelsius, 2) * Math.pow(relativeHumidityInPercents, 2);

    return Math.round(heatIndex);
};
