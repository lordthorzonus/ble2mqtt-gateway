import { calculateRuuviAQI } from "./ruuvi-aqi-calculator";
import { calculateAtmoTubeIAQI } from "./atmotube-aqi-calculator";
import { asCO2Ppm, asNOXIndex, asPM2_5, asVOCIndex } from "../../../units";

function runComparison(sensorData: {
    pm2_5: number | null;
    co2: number | null;
    voc: number | null;
    nox: number | null;
}) {
    const ruuviInput = {
        pm25: sensorData.pm2_5 !== null ? asPM2_5(sensorData.pm2_5) : null,
        co2: sensorData.co2 !== null ? asCO2Ppm(sensorData.co2) : null,
        voc: sensorData.voc !== null ? asVOCIndex(sensorData.voc) : null,
        nox: sensorData.nox !== null ? asNOXIndex(sensorData.nox) : null,
    };

    const atmotubeInput = {
        pm2_5: sensorData.pm2_5 !== null ? asPM2_5(sensorData.pm2_5) : null,
        co2: sensorData.co2 !== null ? asCO2Ppm(sensorData.co2) : null,
        voc: sensorData.voc !== null ? asVOCIndex(sensorData.voc) : null,
        nox: sensorData.nox !== null ? asNOXIndex(sensorData.nox) : null,
        pm10: null,
        pm1: null,
    };

    const ruuviResult = calculateRuuviAQI(ruuviInput);
    const atmotubeResult = calculateAtmoTubeIAQI(atmotubeInput);

    return {
        ruuviIndex: ruuviResult?.index ?? null,
        atmotubeIndex: atmotubeResult?.index ?? null,
        difference: ruuviResult && atmotubeResult ? Math.abs(ruuviResult.index - atmotubeResult.index) : null,
    };
}

describe("AQI Calculator Comparison", () => {
    it("excellent air quality - all low values", () => {
        const result = runComparison({
            pm2_5: 5,
            co2: 450,
            voc: 150,
            nox: 49,
        });

        expect(result).toMatchInlineSnapshot(`
            {
              "atmotubeIndex": 80,
              "difference": 20,
              "ruuviIndex": 100,
            }
        `);
    });

    it("good air quality - moderate low values", () => {
        const result = runComparison({
            pm2_5: 15,
            co2: 700,
            voc: 220,
            nox: 75,
        });

        expect(result).toMatchInlineSnapshot(`
            {
              "atmotubeIndex": 70,
              "difference": 18,
              "ruuviIndex": 88,
            }
        `);
    });

    it("moderate air quality - medium values", () => {
        const result = runComparison({
            pm2_5: 25,
            co2: 900,
            voc: 280,
            nox: 280,
        });

        expect(result).toMatchInlineSnapshot(`
            {
              "atmotubeIndex": 43,
              "difference": 3,
              "ruuviIndex": 40,
            }
        `);
    });

    it("poor air quality - high values", () => {
        const result = runComparison({
            pm2_5: 40,
            co2: 1200,
            voc: 350,
            nox: 350,
        });

        expect(result).toMatchInlineSnapshot(`
            {
              "atmotubeIndex": 20,
              "difference": 20,
              "ruuviIndex": 0,
            }
        `);
    });

    it("unhealthy air quality - very high values", () => {
        const result = runComparison({
            pm2_5: 60,
            co2: 1800,
            voc: 450,
            nox: 450,
        });

        expect(result).toMatchInlineSnapshot(`
            {
              "atmotubeIndex": 7,
              "difference": 7,
              "ruuviIndex": 0,
            }
        `);
    });

    it("mixed quality - high PM2.5, low others", () => {
        const result = runComparison({
            pm2_5: 50,
            co2: 400,
            voc: 49,
            nox: 49,
        });

        expect(result).toMatchInlineSnapshot(`
            {
              "atmotubeIndex": 60,
              "difference": 2,
              "ruuviIndex": 62,
            }
        `);
    });

    it("mixed quality - high NOX, low others", () => {
        const result = runComparison({
            pm2_5: 8,
            co2: 400,
            voc: 110,
            nox: 300,
        });

        expect(result).toMatchInlineSnapshot(`
            {
              "atmotubeIndex": 40,
              "difference": 10,
              "ruuviIndex": 50,
            }
        `);
    });

    it("mixed quality - high CO2, low others", () => {
        const result = runComparison({
            pm2_5: 8,
            co2: 2000,
            voc: 180,
            nox: 49,
        });

        expect(result).toMatchInlineSnapshot(`
            {
              "atmotubeIndex": 30,
              "difference": 0,
              "ruuviIndex": 30,
            }
        `);
    });

    it("partial data - only PM2.5 and CO2", () => {
        const result = runComparison({
            pm2_5: 20,
            co2: 800,
            voc: null,
            nox: null,
        });

        expect(result).toMatchInlineSnapshot(`
            {
              "atmotubeIndex": 70,
              "difference": 12,
              "ruuviIndex": 82,
            }
        `);
    });

    it("partial data - only VOC and NOX", () => {
        const result = runComparison({
            pm2_5: null,
            co2: null,
            voc: 300,
            nox: 300,
        });

        expect(result).toMatchInlineSnapshot(`
            {
              "atmotubeIndex": 40,
              "difference": 40,
              "ruuviIndex": 0,
            }
        `);
    });

    it("no data - all null values", () => {
        const result = runComparison({
            pm2_5: null,
            co2: null,
            voc: null,
            nox: null,
        });

        expect(result).toMatchInlineSnapshot(`
            {
              "atmotubeIndex": null,
              "difference": null,
              "ruuviIndex": null,
            }
        `);
    });

    it("edge case - zero values", () => {
        const result = runComparison({
            pm2_5: 0,
            co2: 0,
            voc: 0,
            nox: 0,
        });

        expect(result).toMatchInlineSnapshot(`
            {
              "atmotubeIndex": 100,
              "difference": 0,
              "ruuviIndex": 100,
            }
        `);
    });

    it("edge case - extremely high values", () => {
        const result = runComparison({
            pm2_5: 200,
            co2: 5000,
            voc: 500,
            nox: 500,
        });

        expect(result).toMatchInlineSnapshot(`
            {
              "atmotubeIndex": 0,
              "difference": 0,
              "ruuviIndex": 0,
            }
        `);
    });
});
