import { DeviceAvailabilityMessage, DeviceSensorMessage, MessageType, DeviceType } from "../../types";
import { DateTime } from "luxon";
import { makeHomeAssistantMqttMessageProducer } from "./home-assistant-mqtt-message-producer";
import {
    EnhancedRuuviTagEnvironmentalSensorData,
    EnhancedRuuviAirSensorData,
} from "../../gateways/ruuvitag/ruuvitag-sensor-data-decorator";
import { MiFloraSensorData } from "../../gateways/miflora/miflora-measurement-transformer";
import { Chunk, Effect, Stream } from "effect";
import { testEffectWithContext } from "../../test/test-context";

describe("HomeAssistant MQTT Message producer", () => {
    it("should generate device state mqtt message if device sensor message is given", async () => {
        const deviceMessage: DeviceSensorMessage = {
            id: "a",
            payload: {
                sensor1: "value",
            } as unknown as EnhancedRuuviTagEnvironmentalSensorData,
            type: MessageType.SensorData,
            time: DateTime.now(),
            device: {
                macAddress: "aa:bb",
                id: "aa:bb",
                friendlyName: "Fridge friend",
                rssi: 23,
                type: DeviceType.Ruuvitag,
                model: "environmental",
                timeout: 10000,
            },
        };

        const testProgram = Effect.gen(function* () {
            const homeAssistantMqttMessageProducer = yield* makeHomeAssistantMqttMessageProducer();
            return yield* Stream.runCollect(homeAssistantMqttMessageProducer(deviceMessage));
        });

        const message = await Effect.runPromise(testEffectWithContext(testProgram));

        expect(Chunk.toArray(message)[0]).toEqual({
            payload: JSON.stringify({
                sensor1: "value",
                time: deviceMessage.time,
                id: deviceMessage.id,
            }),
            retain: false,
            topic: "test/ruuvitag/aa:bb/state",
        });
    });

    it("should vary the state topic based on the device type", async () => {
        const deviceMessage: DeviceSensorMessage = {
            id: "a",
            payload: {
                sensor1: "value",
            } as unknown as MiFloraSensorData,
            type: MessageType.SensorData,
            time: DateTime.now(),
            device: {
                macAddress: "aa:bb",
                id: "aa:bb",
                friendlyName: "My Plant",
                rssi: 44,
                type: DeviceType.MiFlora,
                model: "miflora",
                timeout: 10000,
            },
        };

        const testProgram = Effect.gen(function* () {
            const homeAssistantMqttMessageProducer = yield* makeHomeAssistantMqttMessageProducer();
            return yield* Stream.runCollect(homeAssistantMqttMessageProducer(deviceMessage));
        });

        const message = await Effect.runPromise(testEffectWithContext(testProgram));
        expect(Chunk.toArray(message)[0]).toEqual({
            payload: JSON.stringify({
                sensor1: "value",
                time: deviceMessage.time,
                id: deviceMessage.id,
            }),
            retain: false,
            topic: "test/miflora/aa:bb/state",
        });
    });

    it("should generate device state mqtt message for air quality ruuvitag", async () => {
        const deviceMessage: DeviceSensorMessage = {
            id: "air-quality-msg",
            payload: {
                type: "air-quality",
                temperature: 22.5,
                pm2_5: 12.3,
            } as unknown as EnhancedRuuviAirSensorData,
            type: MessageType.SensorData,
            time: DateTime.now(),
            device: {
                macAddress: "cc:dd",
                id: "cc:dd",
                friendlyName: "Air Quality Sensor",
                rssi: 15,
                type: DeviceType.Ruuvitag,
                model: "air-quality",
                timeout: 10000,
            },
        };

        const testProgram = Effect.gen(function* () {
            const homeAssistantMqttMessageProducer = yield* makeHomeAssistantMqttMessageProducer();
            return yield* Stream.runCollect(homeAssistantMqttMessageProducer(deviceMessage));
        });

        const message = await Effect.runPromise(testEffectWithContext(testProgram));

        expect(Chunk.toArray(message)[0]).toEqual({
            payload: JSON.stringify({
                type: "air-quality",
                temperature: 22.5,
                pm2_5: 12.3,
                time: deviceMessage.time,
                id: deviceMessage.id,
            }),
            retain: false,
            topic: "test/ruuvitag/cc:dd/state",
        });
    });

    const availabilityTestCases: [string, DeviceAvailabilityMessage][] = [
        [
            "RuuviTag Discovered",
            {
                id: "a",
                time: DateTime.now(),
                payload: { state: "online" },
                type: MessageType.Availability,
                device: {
                    macAddress: "aa:bb",
                    id: "aa:bb",
                    friendlyName: "My Fridge",
                    rssi: 23,
                    type: DeviceType.Ruuvitag,
                    model: "environmental",
                    timeout: 10000,
                },
            },
        ],
        [
            "RuuviTag Offline",
            {
                id: "a",
                time: DateTime.now(),
                payload: { state: "offline" },
                type: MessageType.Availability,
                device: {
                    macAddress: "aa:bb",
                    id: "aa:bb",
                    friendlyName: "fridge",
                    rssi: 23,
                    type: DeviceType.Ruuvitag,
                    model: "environmental",
                    timeout: 30000,
                },
            },
        ],
        [
            "MiFlora Discovered",
            {
                id: "abba",
                time: DateTime.now(),
                payload: { state: "online" },
                type: MessageType.Availability,
                device: {
                    macAddress: "aa:bb",
                    id: "aa:bb",
                    friendlyName: "Super Plant",
                    rssi: 23,
                    type: DeviceType.MiFlora,
                    model: "miflora",
                    timeout: 30000,
                },
            },
        ],
        [
            "MiFlora Offline",
            {
                id: "abba",
                time: DateTime.now(),
                payload: { state: "offline" },
                type: MessageType.Availability,
                device: {
                    macAddress: "aa:bb",
                    id: "aa:bb",
                    friendlyName: "plant",
                    rssi: 23,
                    type: DeviceType.MiFlora,
                    model: "miflora",
                    timeout: 30000,
                },
            },
        ],
        [
            "RuuviTag Air Quality Discovered",
            {
                id: "air-quality-id",
                time: DateTime.now(),
                payload: { state: "online" },
                type: MessageType.Availability,
                device: {
                    macAddress: "cc:dd",
                    id: "cc:dd",
                    friendlyName: "Air Quality Sensor",
                    rssi: 15,
                    type: DeviceType.Ruuvitag,
                    model: "air-quality",
                    timeout: 10000,
                },
            },
        ],
        [
            "RuuviTag Air Quality Offline",
            {
                id: "air-quality-id",
                time: DateTime.now(),
                payload: { state: "offline" },
                type: MessageType.Availability,
                device: {
                    macAddress: "cc:dd",
                    id: "cc:dd",
                    friendlyName: "air sensor",
                    rssi: 15,
                    type: DeviceType.Ruuvitag,
                    model: "air-quality",
                    timeout: 10000,
                },
            },
        ],
    ];
    it.each(availabilityTestCases)(
        "should generate corresponding discovery messages for given device in case of %s availability message is given",
        async (_, availabilityMessage) => {
            const testProgram = Effect.gen(function* () {
                const homeAssistantMqttMessageProducer = yield* makeHomeAssistantMqttMessageProducer();
                return yield* Stream.runCollect(homeAssistantMqttMessageProducer(availabilityMessage));
            });

            const messages = await Effect.runPromise(testEffectWithContext(testProgram));
            expect(Chunk.toArray(messages)).toMatchSnapshot();
        }
    );
});
