import { toArray } from "rxjs";

jest.mock("../../config", () => ({
    __esModule: true,
    getConfiguration: jest.fn().mockReturnValue({
        gateways: {
            base_topic: "a_base_topic",
        },
        homeassistant: {
            discovery_topic: "homeassistant",
        },
    }),
}));

import { DeviceAvailabilityMessage, DeviceMessage, DeviceMessageType, DeviceType } from "../../types";
import { DateTime } from "luxon";
import { homeAssistantMqttMessageProducer } from "./home-assistant-mqtt-message-producer";

describe("HomeAssistant MQTT Message producer", () => {
    it("should generate device state mqtt message if device sensor message is given", (done) => {
        const deviceMessage: DeviceMessage = {
            id: "a",
            payload: {
                sensor1: "value",
            },
            type: DeviceMessageType.SensorData,
            time: DateTime.now(),
            device: {
                macAddress: "aa:bb",
                id: "aa:bb",
                friendlyName: "fridge",
                rssi: 23,
                type: DeviceType.Ruuvitag,
                timeout: 10000,
            },
        };

        homeAssistantMqttMessageProducer(deviceMessage).subscribe((message) => {
            expect(message).toEqual({
                payload: JSON.stringify({
                    ...deviceMessage.payload,
                    time: deviceMessage.time,
                    id: deviceMessage.id,
                }),
                retain: false,
                topic: "a_base_topic/ruuvitag/aa:bb/state",
            });
            done();
        });
    });

    it("should vary the state topic based on the device type", (done) => {
        const deviceMessage: DeviceMessage = {
            id: "a",
            payload: {
                sensor1: "value",
            },
            type: DeviceMessageType.SensorData,
            time: DateTime.now(),
            device: {
                macAddress: "aa:bb",
                id: "aa:bb",
                friendlyName: "plant",
                rssi: 44,
                type: DeviceType.MiFlora,
                timeout: 10000,
            },
        };

        homeAssistantMqttMessageProducer(deviceMessage).subscribe((message) => {
            expect(message).toEqual({
                payload: JSON.stringify({
                    ...deviceMessage.payload,
                    time: deviceMessage.time,
                    id: deviceMessage.id,
                }),
                retain: false,
                topic: "a_base_topic/miflora/aa:bb/state",
            });
            done();
        });
    });

    const availabilityTestCases: [string, DeviceAvailabilityMessage][] = [
        [
            "RuuviTag Discovered",
            {
                id: "a",
                time: DateTime.now(),
                payload: { state: "online" },
                type: DeviceMessageType.Availability,
                device: {
                    macAddress: "aa:bb",
                    id: "aa:bb",
                    friendlyName: "fridge",
                    rssi: 23,
                    type: DeviceType.Ruuvitag,
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
                type: DeviceMessageType.Availability,
                device: {
                    macAddress: "aa:bb",
                    id: "aa:bb",
                    friendlyName: "fridge",
                    rssi: 23,
                    type: DeviceType.Ruuvitag,
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
                type: DeviceMessageType.Availability,
                device: {
                    macAddress: "aa:bb",
                    id: "aa:bb",
                    friendlyName: "plant",
                    rssi: 23,
                    type: DeviceType.MiFlora,
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
                type: DeviceMessageType.Availability,
                device: {
                    macAddress: "aa:bb",
                    id: "aa:bb",
                    friendlyName: "plant",
                    rssi: 23,
                    type: DeviceType.MiFlora,
                    timeout: 30000,
                },
            },
        ],
    ];
    it.each(availabilityTestCases)(
        "should generate corresponding discovery messages for given device in case of %s availability message is given",
        (_, availabilityMessage) => {
            homeAssistantMqttMessageProducer(availabilityMessage)
                .pipe(toArray())
                .subscribe((messages) => {
                    expect(messages).toMatchSnapshot();
                });
        }
    );
});
