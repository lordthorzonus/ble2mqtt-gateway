import { decorateOralBSensorData } from "./oralb-sensor-data-decorator";
import { OralBSensorData } from "./oralb-sensor-data";
import { asSeconds } from "../units";

describe("oralb-sensor-data-decorator", () => {
    describe("decorateOralBSensorData", () => {
        it("should return sensor data unchanged", () => {
            const sensorData: OralBSensorData = {
                state: "running",
                pressure: "normal",
                brushingTimeSeconds: asSeconds(120),
                brushingMode: "daily_clean",
                sector: "sector_2",
                isBrushing: true,
            };

            const result = decorateOralBSensorData(sensorData);

            expect(result).toEqual(sensorData);
        });
    });
});
