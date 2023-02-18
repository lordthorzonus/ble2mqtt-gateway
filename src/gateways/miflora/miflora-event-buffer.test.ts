import { MiFloraEventBuffer, MiFloraSensorMeasurementBuffer } from "./miflora-event-buffer";
import { MifloraMeasurementEventType } from "./miflora-parser";
import { MiFloraMeasurement } from "./miflora-parser/parsing-strategies";
import { DateTime, Settings } from "luxon";

jest.mock("../../infra/logger", () => ({
    __esModule: true,
    logger: {
        warn: jest.fn(),
    },
}));

function getEventBufferWithConfiguredDeviceId(deviceId: string) {
    return new MiFloraEventBuffer([
        {
            id: deviceId,
            name: "a",
        },
    ]);
}

describe("MiFlora Event Buffer", () => {
    Settings.now = () => new Date("2019-10-10T00:00:00.000Z").valueOf();

    const emptyBuffer: MiFloraSensorMeasurementBuffer = {
        illuminanceEvent: null,
        moistureEvent: null,
        soilConductivityEvent: null,
        temperatureEvent: null,
        bufferReleasedLast: DateTime.now(),
    };

    beforeEach(() => {
        Settings.now = () => new Date("2019-10-10T00:00:00.000Z").valueOf();
    });

    const moistureEvent: MiFloraMeasurement<MifloraMeasurementEventType.Moisture> = {
        measurementType: MifloraMeasurementEventType.Moisture,
        data: 1,
    };
    const illuminanceEvent: MiFloraMeasurement<MifloraMeasurementEventType.Illuminance> = {
        measurementType: MifloraMeasurementEventType.Illuminance,
        data: 200,
    };
    const soilConductivityEvent: MiFloraMeasurement<MifloraMeasurementEventType.SoilConductivity> = {
        measurementType: MifloraMeasurementEventType.SoilConductivity,
        data: 300,
    };
    const temperatureEvent: MiFloraMeasurement<MifloraMeasurementEventType.Temperature> = {
        measurementType: MifloraMeasurementEventType.Temperature,
        data: 10,
    };

    describe("bufferMeasurementEvent()", () => {
        it("should incrementally add measurement events for the buffer of the given sensor id", () => {
            const deviceId = "a";
            const eventBuffer = getEventBufferWithConfiguredDeviceId(deviceId);

            expect(eventBuffer.bufferMeasurementEvent(deviceId, moistureEvent)).toEqual({
                ...emptyBuffer,
                moistureEvent,
            });

            expect(eventBuffer.bufferMeasurementEvent(deviceId, illuminanceEvent)).toEqual({
                ...emptyBuffer,
                moistureEvent,
                illuminanceEvent,
            });

            expect(eventBuffer.bufferMeasurementEvent(deviceId, soilConductivityEvent)).toEqual({
                ...emptyBuffer,
                moistureEvent,
                illuminanceEvent,
                soilConductivityEvent,
            });

            expect(eventBuffer.bufferMeasurementEvent(deviceId, temperatureEvent)).toEqual({
                ...emptyBuffer,
                moistureEvent,
                illuminanceEvent,
                soilConductivityEvent,
                temperatureEvent,
            });
        });

        it("should override the previous event in the buffer if a new one is received", () => {
            const deviceId = "a";
            const eventBuffer = getEventBufferWithConfiguredDeviceId(deviceId);
            const newTemperatureEvent = { ...temperatureEvent, data: 300 };
            expect(eventBuffer.bufferMeasurementEvent(deviceId, temperatureEvent)).toEqual({
                ...emptyBuffer,
                temperatureEvent,
            });

            expect(eventBuffer.bufferMeasurementEvent(deviceId, newTemperatureEvent)).toEqual({
                ...emptyBuffer,
                temperatureEvent: newTemperatureEvent,
            });
        });

        it("should throw an error if unknown device id is given", () => {
            const eventBuffer = getEventBufferWithConfiguredDeviceId("a");
            expect(() => eventBuffer.bufferMeasurementEvent("unknown", temperatureEvent)).toThrow(
                "No MiFlora sensor configured with id: unknown"
            );
        });
    });

    describe("isBufferReady()", () => {
        const testCases: [MiFloraSensorMeasurementBuffer, boolean][] = [
            [{ ...emptyBuffer }, false],
            [{ ...emptyBuffer, temperatureEvent }, false],
            [{ ...emptyBuffer, moistureEvent }, false],
            [{ ...emptyBuffer, soilConductivityEvent }, false],
            [{ ...emptyBuffer, illuminanceEvent }, false],
            [{ ...emptyBuffer, illuminanceEvent, temperatureEvent }, false],
            [{ ...emptyBuffer, moistureEvent, temperatureEvent }, false],
            [{ ...emptyBuffer, moistureEvent, illuminanceEvent }, false],
            [{ ...emptyBuffer, illuminanceEvent, temperatureEvent, moistureEvent }, false],
            [
                {
                    ...emptyBuffer,
                    moistureEvent,
                    bufferReleasedLast: DateTime.now().minus({ second: 30 }),
                },
                true,
            ],
            [
                {
                    soilConductivityEvent,
                    illuminanceEvent,
                    temperatureEvent,
                    moistureEvent,
                    bufferReleasedLast: DateTime.now(),
                },
                true,
            ],
        ];

        test.each(testCases)("given buffer %j should return %s", (buffer, expected) => {
            const eventBuffer = getEventBufferWithConfiguredDeviceId("a");
            expect(eventBuffer.isBufferReady(buffer)).toEqual(expected);
        });
    });

    describe("clearBuffer()", () => {
        it("should empty the buffer for the given device id", () => {
            const deviceId = "a";
            const eventBuffer = getEventBufferWithConfiguredDeviceId(deviceId);

            eventBuffer.bufferMeasurementEvent(deviceId, temperatureEvent);
            eventBuffer.bufferMeasurementEvent(deviceId, moistureEvent);
            eventBuffer.bufferMeasurementEvent(deviceId, soilConductivityEvent);
            eventBuffer.bufferMeasurementEvent(deviceId, illuminanceEvent);

            eventBuffer.clearBuffer(deviceId);
            expect(eventBuffer.bufferMeasurementEvent(deviceId, moistureEvent)).toEqual({
                ...emptyBuffer,
                moistureEvent,
            });

            eventBuffer.clearBuffer(deviceId);
            expect(eventBuffer.bufferMeasurementEvent(deviceId, temperatureEvent)).toEqual({
                ...emptyBuffer,
                temperatureEvent,
            });
        });
    });
});
