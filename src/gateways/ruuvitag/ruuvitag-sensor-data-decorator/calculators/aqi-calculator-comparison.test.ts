import { calculateRuuviIAQS } from "./ruuvi-iaqs-calculator";
import { calculateAtmoTubeIAQI } from "./atmotube-aqi-calculator";
import { asCO2Ppm, asNOxIndex, asPM2_5, asVOCIndex } from "../../../units";

function runComparison(sensorData: {
    pm2_5: number | null;
    co2: number | null;
    voc: number | null;
    nox: number | null;
}) {
    const ruuviInput = {
        pm25: sensorData.pm2_5 !== null ? asPM2_5(sensorData.pm2_5) : null,
        co2: sensorData.co2 !== null ? asCO2Ppm(sensorData.co2) : null,
    };

    const atmotubeInput = {
        pm2_5: sensorData.pm2_5 !== null ? asPM2_5(sensorData.pm2_5) : null,
        co2: sensorData.co2 !== null ? asCO2Ppm(sensorData.co2) : null,
        voc: sensorData.voc !== null ? asVOCIndex(sensorData.voc) : null,
        nox: sensorData.nox !== null ? asNOxIndex(sensorData.nox) : null,
        pm10: null,
        pm1: null,
    };

    const ruuviResult = calculateRuuviIAQS(ruuviInput);
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
              "difference": 11.515258075173477,
              "ruuviIndex": 91.51525807517348,
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
              "difference": 0.899831134915047,
              "ruuviIndex": 70.89983113491505,
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
              "difference": 8.132937583214456,
              "ruuviIndex": 51.132937583214456,
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
              "difference": 1.4773180609932268,
              "ruuviIndex": 21.477318060993227,
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
              "difference": 43.33333333333334,
              "ruuviIndex": 16.666666666666657,
            }
        `);
    });

    it("mixed quality - high NOx, low others", () => {
        const result = runComparison({
            pm2_5: 8,
            co2: 400,
            voc: 110,
            nox: 300,
        });

        expect(result).toMatchInlineSnapshot(`
            {
              "atmotubeIndex": 40,
              "difference": 46.66666666666667,
              "ruuviIndex": 86.66666666666667,
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
              "difference": 15.093645618942048,
              "ruuviIndex": 14.906354381057952,
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
              "difference": 8.982906751057335,
              "ruuviIndex": 61.017093248942665,
            }
        `);
    });

    it("partial data - only VOC and NOx", () => {
        const result = runComparison({
            pm2_5: null,
            co2: null,
            voc: 300,
            nox: 300,
        });

        expect(result).toMatchInlineSnapshot(`
            {
              "atmotubeIndex": 40,
              "difference": null,
              "ruuviIndex": null,
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
