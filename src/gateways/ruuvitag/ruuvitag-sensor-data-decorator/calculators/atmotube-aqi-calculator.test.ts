import { calculateAtmoTubeIAQI } from "./atmotube-aqi-calculator";
import { asCO2Ppm, asNOXIndex, asPM1, asPM10, asPM2_5, asVOCIndex } from "../../../units";

describe("AtmoTube IAQI Calculator", () => {
    describe("Individual pollutant AQI calculation", () => {
        it.each([
            // PM2.5 test cases
            {
                description: "good PM2.5 (0 μg/m³)",
                sensorData: { pm2_5: asPM2_5(0), co2: null, voc: null, nox: null, pm10: null, pm1: null },
                expectedAQI: 100,
            },
            {
                description: "good PM2.5 (10 μg/m³)",
                sensorData: { pm2_5: asPM2_5(10), co2: null, voc: null, nox: null, pm10: null, pm1: null },
                expectedAQI: 91,
            },
            {
                description: "good PM2.5 (20.5 μg/m³)",
                sensorData: { pm2_5: asPM2_5(20.5), co2: null, voc: null, nox: null, pm10: null, pm1: null },
                expectedAQI: 80,
            },
            {
                description: "moderate PM2.5 (21 μg/m³)",
                sensorData: { pm2_5: asPM2_5(21), co2: null, voc: null, nox: null, pm10: null, pm1: null },
                expectedAQI: 79,
            },
            {
                description: "moderate PM2.5 (35 μg/m³)",
                sensorData: { pm2_5: asPM2_5(35), co2: null, voc: null, nox: null, pm10: null, pm1: null },
                expectedAQI: 71,
            },
            {
                description: "moderate PM2.5 (50 μg/m³)",
                sensorData: { pm2_5: asPM2_5(50), co2: null, voc: null, nox: null, pm10: null, pm1: null },
                expectedAQI: 60,
            },
            {
                description: "polluted PM2.5 (51 μg/m³)",
                sensorData: { pm2_5: asPM2_5(51), co2: null, voc: null, nox: null, pm10: null, pm1: null },
                expectedAQI: 60,
            },
            {
                description: "polluted PM2.5 (70 μg/m³)",
                sensorData: { pm2_5: asPM2_5(70), co2: null, voc: null, nox: null, pm10: null, pm1: null },
                expectedAQI: 51,
            },
            {
                description: "polluted PM2.5 (90 μg/m³)",
                sensorData: { pm2_5: asPM2_5(90), co2: null, voc: null, nox: null, pm10: null, pm1: null },
                expectedAQI: 40,
            },
            {
                description: "very polluted PM2.5 (91 μg/m³)",
                sensorData: { pm2_5: asPM2_5(91), co2: null, voc: null, nox: null, pm10: null, pm1: null },
                expectedAQI: 40,
            },
            {
                description: "very polluted PM2.5 (115 μg/m³)",
                sensorData: { pm2_5: asPM2_5(115), co2: null, voc: null, nox: null, pm10: null, pm1: null },
                expectedAQI: 31,
            },
            {
                description: "very polluted PM2.5 (140 μg/m³)",
                sensorData: { pm2_5: asPM2_5(140), co2: null, voc: null, nox: null, pm10: null, pm1: null },
                expectedAQI: 20,
            },
            {
                description: "severely polluted PM2.5 (141 μg/m³)",
                sensorData: { pm2_5: asPM2_5(141), co2: null, voc: null, nox: null, pm10: null, pm1: null },
                expectedAQI: 20,
            },
            {
                description: "severely polluted PM2.5 (170 μg/m³)",
                sensorData: { pm2_5: asPM2_5(170), co2: null, voc: null, nox: null, pm10: null, pm1: null },
                expectedAQI: 10,
            },
            {
                description: "severely polluted PM2.5 (200 μg/m³)",
                sensorData: { pm2_5: asPM2_5(200), co2: null, voc: null, nox: null, pm10: null, pm1: null },
                expectedAQI: 0,
            },
            {
                description: "severely polluted PM2.5 (250 μg/m³)",
                sensorData: { pm2_5: asPM2_5(250), co2: null, voc: null, nox: null, pm10: null, pm1: null },
                expectedAQI: 0,
            },

            // CO2 test cases
            {
                description: "good CO2 (400 ppm)",
                sensorData: { pm2_5: null, co2: asCO2Ppm(400), voc: null, nox: null, pm10: null, pm1: null },
                expectedAQI: 100,
            },
            {
                description: "good CO2 (500 ppm)",
                sensorData: { pm2_5: null, co2: asCO2Ppm(500), voc: null, nox: null, pm10: null, pm1: null },
                expectedAQI: 90,
            },
            {
                description: "good CO2 (599 ppm)",
                sensorData: { pm2_5: null, co2: asCO2Ppm(599), voc: null, nox: null, pm10: null, pm1: null },
                expectedAQI: 80,
            },
            {
                description: "good CO2 (600 ppm)",
                sensorData: { pm2_5: null, co2: asCO2Ppm(600), voc: null, nox: null, pm10: null, pm1: null },
                expectedAQI: 80,
            },
            {
                description: "good CO2 (800 ppm)",
                sensorData: { pm2_5: null, co2: asCO2Ppm(800), voc: null, nox: null, pm10: null, pm1: null },
                expectedAQI: 70,
            },
            {
                description: "good CO2 (999 ppm)",
                sensorData: { pm2_5: null, co2: asCO2Ppm(999), voc: null, nox: null, pm10: null, pm1: null },
                expectedAQI: 60,
            },
            {
                description: "polluted CO2 (1000 ppm)",
                sensorData: { pm2_5: null, co2: asCO2Ppm(1000), voc: null, nox: null, pm10: null, pm1: null },
                expectedAQI: 60,
            },
            {
                description: "polluted CO2 (1200 ppm)",
                sensorData: { pm2_5: null, co2: asCO2Ppm(1200), voc: null, nox: null, pm10: null, pm1: null },
                expectedAQI: 52,
            },
            {
                description: "polluted CO2 (1499 ppm)",
                sensorData: { pm2_5: null, co2: asCO2Ppm(1499), voc: null, nox: null, pm10: null, pm1: null },
                expectedAQI: 40,
            },
            {
                description: "very polluted CO2 (1500 ppm)",
                sensorData: { pm2_5: null, co2: asCO2Ppm(1500), voc: null, nox: null, pm10: null, pm1: null },
                expectedAQI: 40,
            },
            {
                description: "very polluted CO2 (2000 ppm)",
                sensorData: { pm2_5: null, co2: asCO2Ppm(2000), voc: null, nox: null, pm10: null, pm1: null },
                expectedAQI: 30,
            },
            {
                description: "very polluted CO2 (2499 ppm)",
                sensorData: { pm2_5: null, co2: asCO2Ppm(2499), voc: null, nox: null, pm10: null, pm1: null },
                expectedAQI: 20,
            },
            {
                description: "severely polluted CO2 (2500 ppm)",
                sensorData: { pm2_5: null, co2: asCO2Ppm(2500), voc: null, nox: null, pm10: null, pm1: null },
                expectedAQI: 20,
            },
            {
                description: "severely polluted CO2 (3250 ppm)",
                sensorData: { pm2_5: null, co2: asCO2Ppm(3250), voc: null, nox: null, pm10: null, pm1: null },
                expectedAQI: 10,
            },
            {
                description: "severely polluted CO2 (4000 ppm)",
                sensorData: { pm2_5: null, co2: asCO2Ppm(4000), voc: null, nox: null, pm10: null, pm1: null },
                expectedAQI: 0,
            },
            {
                description: "severely polluted CO2 (5000 ppm)",
                sensorData: { pm2_5: null, co2: asCO2Ppm(5000), voc: null, nox: null, pm10: null, pm1: null },
                expectedAQI: 0,
            },

            // VOC test cases
            {
                description: "good VOC (1)",
                sensorData: { pm2_5: null, co2: null, voc: asVOCIndex(1), nox: null, pm10: null, pm1: null },
                expectedAQI: 100,
            },
            {
                description: "good VOC (100)",
                sensorData: { pm2_5: null, co2: null, voc: asVOCIndex(100), nox: null, pm10: null, pm1: null },
                expectedAQI: 91,
            },
            {
                description: "good VOC (199)",
                sensorData: { pm2_5: null, co2: null, voc: asVOCIndex(199), nox: null, pm10: null, pm1: null },
                expectedAQI: 80,
            },
            {
                description: "good VOC (200)",
                sensorData: { pm2_5: null, co2: null, voc: asVOCIndex(200), nox: null, pm10: null, pm1: null },
                expectedAQI: 80,
            },
            {
                description: "good VOC (225)",
                sensorData: { pm2_5: null, co2: null, voc: asVOCIndex(225), nox: null, pm10: null, pm1: null },
                expectedAQI: 70,
            },
            {
                description: "good VOC (249)",
                sensorData: { pm2_5: null, co2: null, voc: asVOCIndex(249), nox: null, pm10: null, pm1: null },
                expectedAQI: 60,
            },
            {
                description: "polluted VOC (250)",
                sensorData: { pm2_5: null, co2: null, voc: asVOCIndex(250), nox: null, pm10: null, pm1: null },
                expectedAQI: 60,
            },
            {
                description: "polluted VOC (300)",
                sensorData: { pm2_5: null, co2: null, voc: asVOCIndex(300), nox: null, pm10: null, pm1: null },
                expectedAQI: 50,
            },
            {
                description: "polluted VOC (349)",
                sensorData: { pm2_5: null, co2: null, voc: asVOCIndex(349), nox: null, pm10: null, pm1: null },
                expectedAQI: 40,
            },
            {
                description: "very polluted VOC (350)",
                sensorData: { pm2_5: null, co2: null, voc: asVOCIndex(350), nox: null, pm10: null, pm1: null },
                expectedAQI: 40,
            },
            {
                description: "very polluted VOC (375)",
                sensorData: { pm2_5: null, co2: null, voc: asVOCIndex(375), nox: null, pm10: null, pm1: null },
                expectedAQI: 30,
            },
            {
                description: "very polluted VOC (399)",
                sensorData: { pm2_5: null, co2: null, voc: asVOCIndex(399), nox: null, pm10: null, pm1: null },
                expectedAQI: 20,
            },
            {
                description: "severely polluted VOC (400)",
                sensorData: { pm2_5: null, co2: null, voc: asVOCIndex(400), nox: null, pm10: null, pm1: null },
                expectedAQI: 20,
            },
            {
                description: "severely polluted VOC (450)",
                sensorData: { pm2_5: null, co2: null, voc: asVOCIndex(450), nox: null, pm10: null, pm1: null },
                expectedAQI: 10,
            },
            {
                description: "severely polluted VOC (500)",
                sensorData: { pm2_5: null, co2: null, voc: asVOCIndex(500), nox: null, pm10: null, pm1: null },
                expectedAQI: 0,
            },

            // NOX test cases
            {
                description: "good NOX (1)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: asNOXIndex(1), pm10: null, pm1: null },
                expectedAQI: 100,
            },
            {
                description: "good NOX (25)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: asNOXIndex(25), pm10: null, pm1: null },
                expectedAQI: 91,
            },
            {
                description: "good NOX (49)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: asNOXIndex(49), pm10: null, pm1: null },
                expectedAQI: 80,
            },
            {
                description: "good NOX (50)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: asNOXIndex(50), pm10: null, pm1: null },
                expectedAQI: 80,
            },
            {
                description: "good NOX (75)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: asNOXIndex(75), pm10: null, pm1: null },
                expectedAQI: 70,
            },
            {
                description: "good NOX (99)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: asNOXIndex(99), pm10: null, pm1: null },
                expectedAQI: 60,
            },
            {
                description: "polluted NOX (100)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: asNOXIndex(100), pm10: null, pm1: null },
                expectedAQI: 60,
            },
            {
                description: "polluted NOX (200)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: asNOXIndex(200), pm10: null, pm1: null },
                expectedAQI: 50,
            },
            {
                description: "polluted NOX (299)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: asNOXIndex(299), pm10: null, pm1: null },
                expectedAQI: 40,
            },
            {
                description: "very polluted NOX (300)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: asNOXIndex(300), pm10: null, pm1: null },
                expectedAQI: 40,
            },
            {
                description: "very polluted NOX (325)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: asNOXIndex(325), pm10: null, pm1: null },
                expectedAQI: 30,
            },
            {
                description: "very polluted NOX (349)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: asNOXIndex(349), pm10: null, pm1: null },
                expectedAQI: 20,
            },
            {
                description: "severely polluted NOX (350)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: asNOXIndex(350), pm10: null, pm1: null },
                expectedAQI: 20,
            },
            {
                description: "severely polluted NOX (425)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: asNOXIndex(425), pm10: null, pm1: null },
                expectedAQI: 10,
            },
            {
                description: "severely polluted NOX (500)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: asNOXIndex(500), pm10: null, pm1: null },
                expectedAQI: 0,
            },

            // PM10 test cases
            {
                description: "good PM10 (0 μg/m³)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: null, pm10: asPM10(0), pm1: null },
                expectedAQI: 100,
            },
            {
                description: "good PM10 (15 μg/m³)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: null, pm10: asPM10(15), pm1: null },
                expectedAQI: 91,
            },
            {
                description: "good PM10 (30 μg/m³)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: null, pm10: asPM10(30), pm1: null },
                expectedAQI: 80,
            },
            {
                description: "good PM10 (31 μg/m³)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: null, pm10: asPM10(31), pm1: null },
                expectedAQI: 80,
            },
            {
                description: "good PM10 (53 μg/m³)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: null, pm10: asPM10(53), pm1: null },
                expectedAQI: 70,
            },
            {
                description: "good PM10 (75 μg/m³)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: null, pm10: asPM10(75), pm1: null },
                expectedAQI: 60,
            },
            {
                description: "polluted PM10 (76 μg/m³)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: null, pm10: asPM10(76), pm1: null },
                expectedAQI: 60,
            },
            {
                description: "polluted PM10 (100 μg/m³)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: null, pm10: asPM10(100), pm1: null },
                expectedAQI: 51,
            },
            {
                description: "polluted PM10 (125 μg/m³)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: null, pm10: asPM10(125), pm1: null },
                expectedAQI: 40,
            },
            {
                description: "very polluted PM10 (126 μg/m³)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: null, pm10: asPM10(126), pm1: null },
                expectedAQI: 40,
            },
            {
                description: "very polluted PM10 (163 μg/m³)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: null, pm10: asPM10(163), pm1: null },
                expectedAQI: 30,
            },
            {
                description: "very polluted PM10 (200 μg/m³)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: null, pm10: asPM10(200), pm1: null },
                expectedAQI: 20,
            },
            {
                description: "severely polluted PM10 (201 μg/m³)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: null, pm10: asPM10(201), pm1: null },
                expectedAQI: 20,
            },
            {
                description: "severely polluted PM10 (250 μg/m³)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: null, pm10: asPM10(250), pm1: null },
                expectedAQI: 10,
            },
            {
                description: "severely polluted PM10 (300 μg/m³)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: null, pm10: asPM10(300), pm1: null },
                expectedAQI: 0,
            },

            // PM1 test cases
            {
                description: "good PM1 (0 μg/m³)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: null, pm10: null, pm1: asPM1(0) },
                expectedAQI: 100,
            },
            {
                description: "good PM1 (7 μg/m³)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: null, pm10: null, pm1: asPM1(7) },
                expectedAQI: 91,
            },
            {
                description: "good PM1 (14 μg/m³)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: null, pm10: null, pm1: asPM1(14) },
                expectedAQI: 80,
            },
            {
                description: "good PM1 (15 μg/m³)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: null, pm10: null, pm1: asPM1(15) },
                expectedAQI: 79,
            },
            {
                description: "good PM1 (24 μg/m³)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: null, pm10: null, pm1: asPM1(24) },
                expectedAQI: 71,
            },
            {
                description: "good PM1 (34 μg/m³)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: null, pm10: null, pm1: asPM1(34) },
                expectedAQI: 60,
            },
            {
                description: "polluted PM1 (35 μg/m³)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: null, pm10: null, pm1: asPM1(35) },
                expectedAQI: 59,
            },
            {
                description: "polluted PM1 (48 μg/m³)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: null, pm10: null, pm1: asPM1(48) },
                expectedAQI: 50,
            },
            {
                description: "polluted PM1 (61 μg/m³)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: null, pm10: null, pm1: asPM1(61) },
                expectedAQI: 40,
            },
            {
                description: "very polluted PM1 (62 μg/m³)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: null, pm10: null, pm1: asPM1(62) },
                expectedAQI: 39,
            },
            {
                description: "very polluted PM1 (78 μg/m³)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: null, pm10: null, pm1: asPM1(78) },
                expectedAQI: 31,
            },
            {
                description: "very polluted PM1 (95 μg/m³)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: null, pm10: null, pm1: asPM1(95) },
                expectedAQI: 20,
            },
            {
                description: "severely polluted PM1 (96 μg/m³)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: null, pm10: null, pm1: asPM1(96) },
                expectedAQI: 20,
            },
            {
                description: "severely polluted PM1 (123 μg/m³)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: null, pm10: null, pm1: asPM1(123) },
                expectedAQI: 10,
            },
            {
                description: "severely polluted PM1 (150 μg/m³)",
                sensorData: { pm2_5: null, co2: null, voc: null, nox: null, pm10: null, pm1: asPM1(150) },
                expectedAQI: 0,
            },
        ])("should calculate correct AQI for $description", ({ sensorData, expectedAQI }) => {
            const result = calculateAtmoTubeIAQI(sensorData);
            expect(result).toBe(expectedAQI);
        });
    });

    describe("Multiple pollutant scenarios", () => {
        it.each([
            {
                description: "all good values should return worst (minimum) AQI",
                sensorData: {
                    pm2_5: asPM2_5(10),
                    co2: asCO2Ppm(500),
                    voc: asVOCIndex(100),
                    nox: asNOXIndex(25),
                    pm10: asPM10(15),
                    pm1: asPM1(7),
                },
                expectedAQI: 90,
            },
            {
                description: "mixed air quality levels should return worst AQI",
                sensorData: {
                    pm2_5: asPM2_5(10),
                    co2: asCO2Ppm(1200),
                    voc: asVOCIndex(225),
                    nox: null,
                    pm10: null,
                    pm1: null,
                },
                expectedAQI: 52,
            },
            {
                description: "one severely polluted pollutant should dominate",
                sensorData: {
                    pm2_5: asPM2_5(10),
                    co2: asCO2Ppm(500),
                    voc: asVOCIndex(450),
                    nox: null,
                    pm10: null,
                    pm1: null,
                },
                expectedAQI: 10,
            },
        ])("should handle $description", ({ sensorData, expectedAQI }) => {
            const result = calculateAtmoTubeIAQI(sensorData);
            expect(result).toBe(expectedAQI);
        });
    });

    describe("Edge cases", () => {
        it("should return null when all sensor data is null", () => {
            const sensorData = {
                pm2_5: null,
                co2: null,
                voc: null,
                nox: null,
                pm10: null,
                pm1: null,
            };

            const result = calculateAtmoTubeIAQI(sensorData);
            expect(result).toBeNull();
        });

        it("should calculate AQI even when only one sensor has data", () => {
            const sensorData = {
                pm2_5: asPM2_5(10),
                co2: null,
                voc: null,
                nox: null,
                pm10: null,
                pm1: null,
            };

            const result = calculateAtmoTubeIAQI(sensorData);
            expect(result).toBe(91);
        });

        it("should handle zero concentration and return perfect AQI (100)", () => {
            const sensorData = {
                pm2_5: asPM2_5(0),
                co2: null,
                voc: null,
                nox: null,
                pm10: null,
                pm1: null,
            };

            const result = calculateAtmoTubeIAQI(sensorData);
            expect(result).toBe(100);
        });

        it("should handle negative concentration and return perfect AQI (100)", () => {
            const sensorData = {
                pm2_5: null,
                co2: asCO2Ppm(-10),
                voc: null,
                nox: null,
                pm10: null,
                pm1: null,
            };

            const result = calculateAtmoTubeIAQI(sensorData);
            expect(result).toBe(100);
        });

        it("should handle concentrations at exact breakpoint boundaries", () => {
            const testCases = [
                { pm2_5: asPM2_5(20), expectedAQI: 80 },
                { pm2_5: asPM2_5(21), expectedAQI: 79 },
                { pm2_5: asPM2_5(50), expectedAQI: 60 },
                { pm2_5: asPM2_5(51), expectedAQI: 60 },
            ];

            testCases.forEach(({ pm2_5, expectedAQI }) => {
                const sensorData = {
                    pm2_5,
                    co2: null,
                    voc: null,
                    nox: null,
                    pm10: null,
                    pm1: null,
                };

                const result = calculateAtmoTubeIAQI(sensorData);
                expect(result).toBe(expectedAQI);
            });
        });
    });
});
