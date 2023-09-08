import {
    DeviceAvailabilityMessage,
    DeviceMessage,
    DeviceType,
    HomeAssistantDeviceClass,
    HomeAssistantMQTTComponent,
    HomeAssistantSensorConfiguration,
    HomeAssistantSensorConfigurationForDeviceType,
    MessageType,
    MqttMessage,
} from "../../types";
import { ruuviTagSensorConfiguration } from "./device-discoverability-configurations/ruuvitag";
import { getDeviceAvailabilityTopic, getDeviceStateTopic } from "../mqtt-topic-factory";
import { Observable } from "rxjs";
import { getConfiguration } from "../../config";
import { miFloraSensorConfiguration } from "./device-discoverability-configurations/miflora";
import { capitalize, snakeCase } from "lodash";

const config = getConfiguration();
const homeAssistantTopicBase = config.homeassistant.discovery_topic;

const bleDeviceHAConfigurationMap = new Map<DeviceType, HomeAssistantSensorConfigurationForDeviceType<DeviceType>>([
    [DeviceType.Ruuvitag, ruuviTagSensorConfiguration],
    [DeviceType.MiFlora, miFloraSensorConfiguration],
]);

const bleDeviceHAComponentMap = new Map<DeviceType, HomeAssistantMQTTComponent>([
    [DeviceType.Ruuvitag, HomeAssistantMQTTComponent.Sensor],
    [DeviceType.MiFlora, HomeAssistantMQTTComponent.Sensor],
]);

const getHASensorConfiguration = <T extends DeviceType>(type: T): HomeAssistantSensorConfigurationForDeviceType<T> => {
    const configuration = bleDeviceHAConfigurationMap.get(type);

    if (!configuration) {
        throw new Error("No configuration for given type");
    }

    return configuration as HomeAssistantSensorConfigurationForDeviceType<T>;
};

const getHAComponent = (type: DeviceType): HomeAssistantMQTTComponent => {
    const component = bleDeviceHAComponentMap.get(type);

    if (!component) {
        throw new Error("No mqtt component configured for given type");
    }

    return component;
};

const getObjectID = (deviceMessage: DeviceMessage, configEntry: HomeAssistantSensorConfiguration) =>
    `${snakeCase(deviceMessage.device.friendlyName)}_${configEntry.uniqueId}`;

const getDeviceName = (deviceMessage: DeviceMessage) =>
    `${capitalize(deviceMessage.device.type)} ${deviceMessage.device.friendlyName}`;

const getEntityName = (configEntry: HomeAssistantSensorConfiguration) => `${configEntry.name}`;

interface HADiscoveryPayload {
    name: string;
    device_class?: string;
    expire_after: number;
    unit_of_measurement: string;
    object_id: string;
    unique_id: string;
    availability_topic: string;
    availability_template: string;
    suggested_display_precision?: number;
    value_template: string;
    state_topic: string;
    state_class?: string;
    icon?: string;
    device: {
        name: string;
        manufacturer: string;
        model: string;
        connections: [string, string][];
    };
}

const getSuggestedDecimalPrecision = (configEntry: HomeAssistantSensorConfiguration): number | undefined =>
    configEntry.suggestedDecimalPrecision === undefined
        ? config.decimal_precision
        : configEntry.suggestedDecimalPrecision ?? undefined;

const getHaDiscoveryPayload = (
    propertyName: string,
    configEntry: HomeAssistantSensorConfiguration,
    deviceMessage: DeviceAvailabilityMessage
): HADiscoveryPayload | null =>
    deviceMessage.payload.state === "online"
        ? {
              name: getEntityName(configEntry),
              device_class:
                  configEntry.deviceClass === HomeAssistantDeviceClass.None ? undefined : configEntry.deviceClass,
              unit_of_measurement: configEntry.unitOfMeasurement,
              object_id: getObjectID(deviceMessage, configEntry),
              unique_id: getObjectID(deviceMessage, configEntry),
              availability_topic: getDeviceAvailabilityTopic(deviceMessage.device),
              availability_template: "{{ value_json.state }}",
              expire_after: deviceMessage.device.timeout / 1000,
              suggested_display_precision: getSuggestedDecimalPrecision(configEntry),
              state_class: configEntry.stateClass,
              icon: configEntry.icon,
              device: {
                  ...configEntry.device,
                  name: getDeviceName(deviceMessage),
                  connections: [["mac", deviceMessage.device.macAddress]],
              },
              value_template: configEntry.valueTemplate
                  ? configEntry.valueTemplate
                  : `{{ value_json.${propertyName} | default('None') }}`,
              state_topic: getDeviceStateTopic(deviceMessage.device),
          }
        : null;

function* haDiscoverAdapter(deviceMessage: DeviceAvailabilityMessage): Generator<MqttMessage> {
    const configuration = getHASensorConfiguration(deviceMessage.device.type);
    const component = getHAComponent(deviceMessage.device.type);

    for (const [propertyName, configEntry] of Object.entries(configuration)) {
        const haDiscoveryPayload = getHaDiscoveryPayload(propertyName, configEntry, deviceMessage);

        const message: MqttMessage = {
            topic: `${homeAssistantTopicBase}/${component}/${getObjectID(deviceMessage, configEntry)}/config`,
            retain: true,
            payload: haDiscoveryPayload !== null ? JSON.stringify(haDiscoveryPayload) : "",
        };

        yield message;
    }
}

const generateAvailabilityMessage = (deviceMessage: DeviceMessage): MqttMessage => ({
    retain: true,
    topic: getDeviceAvailabilityTopic(deviceMessage.device),
    payload: JSON.stringify(deviceMessage.payload),
});

const isAvailabilityMessage = (deviceMessage: DeviceMessage): deviceMessage is DeviceAvailabilityMessage =>
    deviceMessage.type === MessageType.Availability;

const generateStateMessage = (deviceMessage: DeviceMessage): MqttMessage => ({
    retain: false,
    topic: getDeviceStateTopic(deviceMessage.device),
    payload: JSON.stringify({ ...deviceMessage.payload, time: deviceMessage.time, id: deviceMessage.id }),
});

export function homeAssistantMqttMessageProducer(deviceMessage: DeviceMessage): Observable<MqttMessage> {
    return new Observable((subscriber) => {
        if (isAvailabilityMessage(deviceMessage)) {
            for (const message of haDiscoverAdapter(deviceMessage)) {
                subscriber.next(message);
            }

            subscriber.next(generateAvailabilityMessage(deviceMessage));
            subscriber.complete();
        }

        subscriber.next(generateStateMessage(deviceMessage));
        subscriber.complete();
    });
}
