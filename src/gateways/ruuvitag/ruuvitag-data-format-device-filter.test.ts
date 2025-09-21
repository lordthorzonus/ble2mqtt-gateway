import { RuuvitagDataFormatDeviceFilter } from "./ruuvitag-data-format-device-filter";
import { RuuvitagSensorProtocolDataFormat } from "./ruuvitag-parser";
import { Settings } from "luxon";

describe("RuuvitagDataFormatDeviceFilter", () => {
    let filter: RuuvitagDataFormatDeviceFilter;
    const deviceId = "a1:b2:c3:d4:e5:f6";
    const originalNow = Settings.now;

    beforeEach(() => {
        Settings.now = () => new Date("2019-10-10T00:00:00.000Z").valueOf();
        Settings.defaultZone = "UTC";
        filter = new RuuvitagDataFormatDeviceFilter();
    });

    afterEach(() => {
        Settings.now = originalNow;
    });

    describe("shouldDiscardPeripheral", () => {
        it("should return false for non-format-6 packets", () => {
            const result = filter.shouldDiscardPeripheral(deviceId, RuuvitagSensorProtocolDataFormat.DataFormat5);
            expect(result).toBe(false);
        });

        it("should return false for format 6 packets when no E1 has been seen", () => {
            const result = filter.shouldDiscardPeripheral(deviceId, RuuvitagSensorProtocolDataFormat.DataFormat6);
            expect(result).toBe(false);
        });

        it("should return true for format 6 packets when E1 was seen recently", () => {
            filter.markE1FormatSeen(deviceId);

            Settings.now = () => new Date("2019-10-10T00:01:00.000Z").valueOf();

            const result = filter.shouldDiscardPeripheral(deviceId, RuuvitagSensorProtocolDataFormat.DataFormat6);
            expect(result).toBe(true);
        });

        it("should return false for format 6 packets when E1 cache has expired", () => {
            filter.markE1FormatSeen(deviceId);

            Settings.now = () => new Date("2019-10-10T00:06:00.000Z").valueOf();

            const result = filter.shouldDiscardPeripheral(deviceId, RuuvitagSensorProtocolDataFormat.DataFormat6);
            expect(result).toBe(false);
        });

        it("should handle different devices independently", () => {
            const device1 = "a1:b2:c3:d4:e5:f6";
            const device2 = "b1:c2:d3:e4:f5:a6";

            filter.markE1FormatSeen(device1);

            Settings.now = () => new Date("2019-10-10T00:01:00.000Z").valueOf();

            expect(filter.shouldDiscardPeripheral(device1, RuuvitagSensorProtocolDataFormat.DataFormat6)).toBe(true);

            expect(filter.shouldDiscardPeripheral(device2, RuuvitagSensorProtocolDataFormat.DataFormat6)).toBe(false);
        });
    });
});
