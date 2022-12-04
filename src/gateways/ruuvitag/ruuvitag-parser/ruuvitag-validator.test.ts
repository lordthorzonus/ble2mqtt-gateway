import { validateRuuviTag } from "./ruuvitag-validator";

describe("RuuviTag Validator", () => {
    it("should return true for manufacturerData that contains the valid manufacturerId", () => {
        const manufacturerData = Buffer.from("990406291A1ECE1EFC18F94202CA0B53", "hex");

        expect(validateRuuviTag(manufacturerData)).toBe(true);
    });

    it("should return false for manufacturer data that does not contain the valid manufacturerId", () => {
        const manufacturerData = Buffer.from("048806291A1ECE1EFC18F94202CA0B53", "hex");

        expect(validateRuuviTag(manufacturerData)).toBe(false);
    });
});
