/**
 * Calculates the humidex (humidity index).
 *
 * @see https://en.wikipedia.org/wiki/Humidex.
 *
 * @return Returns the humidex number integer.
 */
export const calculateHumidex = (
    temperatureInCelsius: number | null,
    dewPointInCelsius: number | null
): number | null => {
    if (temperatureInCelsius === null || dewPointInCelsius === null) {
        return null;
    }

    // Rounded constant based on molecular weight of water, latent heat of evaporation, and the universal gas constant.
    const constant = 5417.753;
    const humidex =
        temperatureInCelsius +
        (5 / 9) * (6.11 * Math.exp(constant * (1 / 273.16 - 1 / (273.15 + dewPointInCelsius))) - 10);

    return Math.round(humidex);
};
