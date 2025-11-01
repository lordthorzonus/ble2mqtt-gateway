import { DeviceSensorMessage, MessageType, DeviceType } from "../../types";
import { parse } from "./ruuvitag-parser";
import {
    decorateRuuviTagEnvironmentalSensorDataWithCalculatedValues,
    decorateRuuviTagAirQualitySensorDataWithCalculatedValues,
    EnhancedRuuviTagEnvironmentalSensorData,
    EnhancedRuuviAirSensorData,
} from "./ruuvitag-sensor-data-decorator";
import { v4 as uuid } from "uuid";
import { PeripheralWithManufacturerData } from "./ruuvitag-gateway";
import { transformPeripheralAdvertisementToSensorDataDeviceMessage } from "./ruuvitag-measurement-transformer";
import { DateTime, Settings } from "luxon";
import { DeviceRegistryEntry } from "../device-registry";
import { Effect } from "effect";
import { testEffectWithContext } from "../../test/test-context";
import {
    asCelsius,
    asCO2Ppm,
    asLux,
    asNOxIndex,
    asPascal,
    asPM1,
    asPM10,
    asPM2_5,
    asPM4,
    asRelativeHumidity,
    asVOCIndex,
} from "../units";

Settings.defaultZone = "UTC";
const mockedTime = DateTime.fromISO("2019-10-10T00:00:00.000Z");

jest.mock("./ruuvitag-parser");

const mockedParse = parse as jest.Mock;

jest.mock("./ruuvitag-sensor-data-decorator");

const mockedRuuviTagDecorator = decorateRuuviTagEnvironmentalSensorDataWithCalculatedValues as jest.Mock;
const mockedRuuviTagAirQualityDecorator = decorateRuuviTagAirQualitySensorDataWithCalculatedValues as jest.Mock;

jest.mock("uuid");

const mockedUuid = uuid as jest.Mock;

describe("RuuviTag Measurement Transformer", () => {
    const originalNow = Settings.now;
    beforeEach(() => {
        Settings.now = () => mockedTime.valueOf();
        Settings.defaultZone = "UTC";
    });

    afterEach(() => {
        Settings.now = originalNow;

        jest.clearAllMocks();
        jest.restoreAllMocks();
    });
    describe("transformPeripheralToRuuviTagMeasurement()", () => {
        const peripheral = {
            advertisement: {
                manufacturerData: Buffer.from("99040512FC5394C37C0004FFFC040CAC364200CDCBB8334C884F", "hex"),
                localName: "a",
                serviceData: [],
            },
            address: "a1:b2",
            rssi: 23,
            id: "id",
            uuid: "123",
        };

        const device: DeviceRegistryEntry = {
            decimalPrecision: 2,
            device: {
                id: "1234a",
                type: DeviceType.Ruuvitag,
                friendlyName: "friendly_name",
                model: "environmental",
            },
            timeout: 10000,
            availability: "offline",
            lastPublishedAvailability: "offline",
            lastSeen: null,
        };

        const mockId = "id-1";

        const sensorData: EnhancedRuuviTagEnvironmentalSensorData = {
            type: "environmental",
            absoluteHumidity: null,
            dewPoint: null,
            heatIndex: null,
            humidex: null,
            temperature: asCelsius(24.31234),
            pressure: asPascal(100044),
            relativeHumidityPercentage: asRelativeHumidity(53.49),
            accelerationX: 0.004,
            accelerationY: -0,
            accelerationZ: 1.036,
            batteryVoltage: 2.977,
            txPower: 4,
            movementCounter: 66,
            measurementSequence: 205,
            macAddress: "cb:b8:33:4c:88:4f",
            breezeIndoorClimateIndex: null,
            breezeIndoorClimateIndexDescription: null,
        };

        const expectedMessage: DeviceSensorMessage = {
            id: mockId,
            type: MessageType.SensorData,
            device: {
                type: DeviceType.Ruuvitag,
                friendlyName: device.device.friendlyName,
                id: device.device.id,
                macAddress: sensorData.macAddress ?? "no-mac-address",
                rssi: peripheral.rssi,
                model: "environmental",
                timeout: 10000,
            },
            time: mockedTime,
            payload: {
                ...sensorData,
                batteryVoltage: 2.98,
                accelerationX: 0,
                accelerationY: 0,
                accelerationZ: 1.04,
                temperature: asCelsius(24.31),
            },
        };

        it("should transform the given peripheral advertisement into RuuviTagMeasurement", () =>
            Effect.runPromise(
                testEffectWithContext(
                    Effect.gen(function* () {
                        const dummyParsedData = { type: "environmental" as const, temperature: 24.3 };
                        mockedParse.mockReturnValue(Effect.succeed(dummyParsedData));
                        mockedRuuviTagDecorator.mockReturnValue(sensorData);
                        mockedUuid.mockReturnValue(mockId);

                        const result = yield* yield* transformPeripheralAdvertisementToSensorDataDeviceMessage(
                            peripheral as PeripheralWithManufacturerData,
                            device
                        );
                        expect(result).toStrictEqual(expectedMessage);

                        expect(mockedParse).toHaveBeenCalledWith(peripheral.advertisement.manufacturerData);
                        expect(mockedRuuviTagDecorator).toHaveBeenCalledWith(dummyParsedData);
                        expect(mockedUuid).toHaveBeenCalledTimes(1);
                    })
                )
            ));

        it("should use the mac address from the peripheral advertisement if one is not available in sensor data", () =>
            Effect.runPromise(
                testEffectWithContext(
                    Effect.gen(function* () {
                        const dummyParsedData = { type: "environmental" as const, temperature: 24.3 };
                        const sensorDataWithoutMacAddress = {
                            ...expectedMessage.payload,
                            macAddress: null,
                        };
                        mockedParse.mockReturnValue(Effect.succeed(dummyParsedData));
                        mockedRuuviTagDecorator.mockReturnValue(sensorDataWithoutMacAddress);
                        mockedUuid.mockReturnValue(mockId);

                        const result = yield* yield* transformPeripheralAdvertisementToSensorDataDeviceMessage(
                            peripheral as PeripheralWithManufacturerData,
                            device
                        );
                        expect(result).toStrictEqual({
                            ...expectedMessage,
                            device: {
                                ...expectedMessage.device,
                                macAddress: peripheral.address,
                            },
                            payload: { ...sensorDataWithoutMacAddress },
                        });
                    })
                )
            ));

        it("should transform air quality sensor data from peripheral advertisement", () =>
            Effect.runPromise(
                testEffectWithContext(
                    Effect.gen(function* () {
                        const airQualityPeripheral = {
                            advertisement: {
                                manufacturerData: Buffer.from("99040680010000000000000000000000FF00004C884F", "hex"),
                                localName: "RuuviTag Air",
                                serviceData: [],
                            },
                            address: "4C:88:4F",
                            rssi: -45,
                            id: "air-quality-id",
                            uuid: "air-quality-uuid",
                        };

                        const airQualitySensorData: EnhancedRuuviAirSensorData = {
                            type: "air-quality",
                            temperature: asCelsius(-163.835),
                            pressure: asPascal(50000),
                            relativeHumidityPercentage: asRelativeHumidity(0.0),
                            measurementSequence: 0,
                            macAddress: "4C:88:4F",
                            pm1: asPM1(0.0),
                            pm2_5: asPM2_5(0.0),
                            pm4: asPM4(0.0),
                            pm10: asPM10(0.0),
                            co2: asCO2Ppm(0),
                            voc: asVOCIndex(0),
                            nox: asNOxIndex(0),
                            luminosity: asLux(0.0),
                            calibrationInProgress: false,
                            absoluteHumidity: 0.1,
                            dewPoint: asCelsius(-163.8),
                            ruuviIAQS: null,
                            ruuviIAQSDescription: null,
                            atmoTubeAQI: null,
                            atmoTubeAQIDescription: null,
                            heatIndex: null,
                            humidex: null,
                            breezeIndoorClimateIndex: null,
                            breezeIndoorClimateIndexDescription: null,
                        };

                        const expectedAirQualityMessage: DeviceSensorMessage = {
                            id: mockId,
                            type: MessageType.SensorData,
                            device: {
                                type: DeviceType.Ruuvitag,
                                friendlyName: device.device.friendlyName,
                                id: device.device.id,
                                macAddress: airQualitySensorData.macAddress ?? "no-mac-address",
                                rssi: airQualityPeripheral.rssi,
                                model: "air-quality",
                                timeout: 10000,
                            },
                            time: mockedTime,
                            payload: {
                                ...airQualitySensorData,
                                temperature: asCelsius(-163.84),
                                pressure: asPascal(50000),
                                relativeHumidityPercentage: asRelativeHumidity(0),
                                pm2_5: asPM2_5(0),
                                luminosity: asLux(0),
                                absoluteHumidity: 0.1,
                                dewPoint: -163.8,
                            },
                        };

                        const dummyParsedAirQualityData = { type: "air-quality" as const, temperature: -163.835 };
                        mockedParse.mockReturnValue(Effect.succeed(dummyParsedAirQualityData));
                        mockedRuuviTagAirQualityDecorator.mockReturnValue(airQualitySensorData);
                        mockedUuid.mockReturnValue(mockId);

                        const result = yield* yield* transformPeripheralAdvertisementToSensorDataDeviceMessage(
                            airQualityPeripheral as PeripheralWithManufacturerData,
                            device
                        );

                        expect(result).toStrictEqual(expectedAirQualityMessage);
                        expect(mockedParse).toHaveBeenCalledWith(airQualityPeripheral.advertisement.manufacturerData);
                        expect(mockedUuid).toHaveBeenCalledTimes(1);
                    })
                )
            ));
    });
});
