import { Device, DeviceType } from "../../types";
import parse from "./ruuvitag-parser";
import decorateRuuviTagSensorDataWithCalculatedValues, {
    EnhancedRuuviTagSensorData,
} from "./ruuvitag-sensor-data-decorator";
import { v4 as uuid } from "uuid";
import { Peripheral } from "noble";
import {
    RuuviTagMeasurement,
    transformPeripheralAdvertisementToSensorDataDeviceMessage,
} from "./ruuvitag-measurement-transformer";

const mockedTime = new Date("2019-10-10");

jest.mock("./ruuvitag-parser");

const mockedParse = parse as jest.Mock;

jest.mock("./ruuvitag-sensor-data-decorator");

const mockedRuuviTagDecorator = decorateRuuviTagSensorDataWithCalculatedValues as jest.Mock;

jest.mock("uuid");

const mockedUuid = uuid as jest.Mock;

describe("RuuviTag Measurement Transformer", () => {
    describe("transformPeripheralToRuuviTagMeasurement()", () => {
        beforeEach(() => {
            jest.spyOn(Date, "now").mockImplementation(() => mockedTime.valueOf());
        });

        afterEach(() => {
            jest.clearAllMocks();
            jest.restoreAllMocks();
        });

        const peripheral = {
            advertisement: {
                manufacturerData: Buffer.from("99040512FC5394C37C0004FFFC040CAC364200CDCBB8334C884F", "hex"),
            },
            address: "a1:b2",
            rssi: 23,
            id: "id",
        };

        const device: Device = {
            id: "1234a",
            type: DeviceType.Ruuvitag,
            friendlyName: "friendly_name",
        };

        const mockId = "id-1";

        const sensorData: EnhancedRuuviTagSensorData = {
            absoluteHumidity: null,
            dewPoint: null,
            heatIndex: null,
            humidex: null,
            temperature: 24.3,
            pressure: 100044,
            relativeHumidityPercentage: 53.49,
            accelerationX: 0.004,
            accelerationY: -0.004,
            accelerationZ: 1.036,
            batteryVoltage: 2.977,
            txPower: 4,
            movementCounter: 66,
            measurementSequence: 205,
            macAddress: "cb:b8:33:4c:88:4f",
        };

        const expectedMeasurement: RuuviTagMeasurement = {
            id: mockId,
            peripheral: {
                id: peripheral.id,
                macAddress: sensorData.macAddress as string,
                rssi: peripheral.rssi,
            },
            time: mockedTime,
            sensorData,
        };

        it("should transform the given peripheral advertisement into RuuviTagMeasurement", () => {
            const dummyParsedData = "parsedRuuviTagData";
            mockedParse.mockReturnValue(dummyParsedData);
            mockedRuuviTagDecorator.mockReturnValue(sensorData);
            mockedUuid.mockReturnValue(mockId);

            expect(transformPeripheralAdvertisementToSensorDataDeviceMessage(peripheral as Peripheral, device)).toEqual(
                expectedMeasurement
            );

            expect(mockedParse).toHaveBeenCalledWith(peripheral.advertisement.manufacturerData);
            expect(mockedRuuviTagDecorator).toHaveBeenCalledWith(dummyParsedData);
            expect(mockedUuid).toHaveBeenCalledTimes(1);
        });

        it("should use the mac address from the peripheral advertisement if one is not available in sensor data", () => {
            const sensorDataWithoutMacAddress = {
                ...sensorData,
                macAddress: null,
            };
            mockedRuuviTagDecorator.mockReturnValue(sensorDataWithoutMacAddress);
            mockedUuid.mockReturnValue(mockId);

            expect(transformPeripheralAdvertisementToSensorDataDeviceMessage(peripheral as Peripheral, device)).toEqual(
                {
                    ...expectedMeasurement,
                    peripheral: {
                        ...expectedMeasurement.peripheral,
                        macAddress: peripheral.address,
                    },
                    sensorData: sensorDataWithoutMacAddress,
                }
            );
        });
    });
});
