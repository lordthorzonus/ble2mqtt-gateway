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

const getHASensorConfiguration = <T extends DeviceType>(type: T): HomeAssistantSensorConfigurationForDeviceType<T> => {
    const configuration = bleDeviceHAConfigurationMap.get(type);

    if (!configuration) {
        throw new Error("No configuration for given type");
    }

    return configuration as HomeAssistantSensorConfigurationForDeviceType<T>;
};

const getObjectID = (deviceMessage: DeviceMessage, configEntry: HomeAssistantSensorConfiguration) =>
    `${snakeCase(deviceMessage.device.friendlyName)}_${configEntry.uniqueId}`;

const getDeviceName = (deviceMessage: DeviceMessage) =>
    `${capitalize(deviceMessage.device.type)} ${deviceMessage.device.friendlyName}`;

const getEntityName = (configEntry: HomeAssistantSensorConfiguration) => configEntry.name;

interface CommonHADiscoveryPayload {
    name: string;
    device_class?: string;
    expire_after: number;
    object_id: string;
    unique_id: string;
    entity_category?: string;
    availability_topic: string;
    availability_template: string;
    payload_available?: string;
    payload_not_available?: string;
    value_template: string;
    state_topic: string;
    icon?: string;
    origin: {
        name: string;
        sw_version: string;
        support_url: string;
    };
    device: {
        name: string;
        manufacturer: string;
        model: string;
        identifiers: string[];
        connections: [string, string][];
    };
}

interface SensorHADiscoveryPayload {
    component: HomeAssistantMQTTComponent.Sensor;
    payload: CommonHADiscoveryPayload & {
        unit_of_measurement?: string;
        suggested_display_precision?: number;
        state_class?: string;
    };
}

interface BinarySensorHADiscoveryPayload {
    component: HomeAssistantMQTTComponent.BinarySensor;
    payload: CommonHADiscoveryPayload & {
        payload_on?: string | boolean;
        payload_off?: string | boolean;
    };
}

interface NullPayloadDiscoveryPayload {
    component: HomeAssistantMQTTComponent;
    payload: null;
}

type HADiscoveryPayload = SensorHADiscoveryPayload | BinarySensorHADiscoveryPayload | NullPayloadDiscoveryPayload;

const getSuggestedDecimalPrecision = (configEntry: HomeAssistantSensorConfiguration): number | undefined =>
    configEntry.suggestedDecimalPrecision === undefined
        ? config.decimal_precision
        : (configEntry.suggestedDecimalPrecision ?? undefined);

const getHaDiscoveryPayload = (
    propertyName: string,
    configEntry: HomeAssistantSensorConfiguration,
    deviceMessage: DeviceAvailabilityMessage
): HADiscoveryPayload => {
    if (deviceMessage.payload.state === "offline") {
        return {
            component: configEntry.component,
            payload: null,
        };
    }

    const commonDiscoveryPayload = {
        name: getEntityName(configEntry),
        device_class: configEntry.deviceClass === HomeAssistantDeviceClass.None ? undefined : configEntry.deviceClass,
        entity_category: configEntry.entityCategory,
        object_id: getObjectID(deviceMessage, configEntry),
        unique_id: getObjectID(deviceMessage, configEntry),
        availability_topic: getDeviceAvailabilityTopic(deviceMessage.device),
        availability_template: "{{ value_json.state }}",
        expire_after: deviceMessage.device.timeout / 1000,
        icon: configEntry.icon,
        device: {
            ...configEntry.device,
            name: getDeviceName(deviceMessage),
            connections: [["mac", deviceMessage.device.macAddress]] satisfies [string, string][],
            identifiers: [deviceMessage.device.id, deviceMessage.device.macAddress],
        },
        value_template: configEntry.valueTemplate ?? `{{ value_json.${propertyName} | default('None') }}`,
        state_topic: getDeviceStateTopic(deviceMessage.device),
        origin: {
            name: config.gateway_name,
            sw_version: config.gateway_version,
            support_url: "https://github.com/lordthorzonus/ble2mqtt-gateway",
        },
    };

    switch (configEntry.component) {
        case HomeAssistantMQTTComponent.Sensor:
            return {
                component: HomeAssistantMQTTComponent.Sensor,
                payload: {
                    ...commonDiscoveryPayload,
                    unit_of_measurement: configEntry.unitOfMeasurement,
                    state_class: configEntry.stateClass,
                    suggested_display_precision: getSuggestedDecimalPrecision(configEntry),
                },
            } satisfies SensorHADiscoveryPayload;
        case HomeAssistantMQTTComponent.BinarySensor:
            return {
                component: HomeAssistantMQTTComponent.BinarySensor,
                payload: {
                    ...commonDiscoveryPayload,
                    payload_on: configEntry.payloadOn,
                    payload_off: configEntry.payloadOff,
                },
            } satisfies BinarySensorHADiscoveryPayload;
    }
};

function* haDiscoverAdapter(deviceMessage: DeviceAvailabilityMessage): Generator<MqttMessage> {
    const configuration = getHASensorConfiguration(deviceMessage.device.type);

    for (const [propertyName, configEntry] of Object.entries(configuration)) {
        const haDiscoveryPayload = getHaDiscoveryPayload(propertyName, configEntry, deviceMessage);
        const payload = haDiscoveryPayload.payload;

        const message: MqttMessage = {
            topic: `${homeAssistantTopicBase}/${haDiscoveryPayload.component}/${deviceMessage.device.id}/${getObjectID(
                deviceMessage,
                configEntry
            )}/config`,
            retain: true,
            payload: payload !== null ? JSON.stringify(payload) : "",
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
