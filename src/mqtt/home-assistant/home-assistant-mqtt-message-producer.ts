import {
    DeviceAvailabilityMessage,
    DeviceMessage,
    DeviceType,
    HomeAssistantDeviceClass,
    HomeAssistantMQTTComponent,
    HomeAssistantSensorConfiguration,
    MessageType,
    MqttMessage,
} from "../../types";
import {
    ruuviTagAirQualitySensorConfiguration,
    ruuviTagEnvironmentalSensorConfiguration,
} from "./device-discoverability-configurations/ruuvitag";
import { getDeviceAvailabilityTopic, getDeviceStateTopic } from "../mqtt-topic-factory";
import { miFloraSensorConfiguration } from "./device-discoverability-configurations/miflora";
import { capitalize, snakeCase } from "lodash";
import { Data, Effect, Match, Stream } from "effect";
import { Config, ConfigurationError, GlobalConfiguration } from "../../config";

export class SensorConfigurationMissingError extends Data.TaggedError("SensorConfigurationMissingError")<{
    message: DeviceAvailabilityMessage;
}> {}

const getHASensorConfiguration = Match.type<DeviceAvailabilityMessage>().pipe(
    Match.when({ device: { type: DeviceType.Ruuvitag, model: "environmental" } }, () =>
        Effect.succeed(ruuviTagEnvironmentalSensorConfiguration)
    ),
    Match.when({ device: { type: DeviceType.Ruuvitag, model: "air-quality" } }, () =>
        Effect.succeed(ruuviTagAirQualitySensorConfiguration)
    ),
    Match.when({ device: { type: DeviceType.MiFlora } }, () => Effect.succeed(miFloraSensorConfiguration)),
    Match.orElse((message) => Effect.fail(new SensorConfigurationMissingError({ message })))
);

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

const getSuggestedDecimalPrecision = (
    configEntry: HomeAssistantSensorConfiguration,
    globalConfig: { decimal_precision: number }
): number | undefined =>
    configEntry.suggestedDecimalPrecision === undefined
        ? globalConfig.decimal_precision
        : (configEntry.suggestedDecimalPrecision ?? undefined);

const getHaDiscoveryPayload = (
    propertyName: string,
    configEntry: HomeAssistantSensorConfiguration,
    deviceMessage: DeviceAvailabilityMessage,
    globalConfig: GlobalConfiguration
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
        availability_topic: getDeviceAvailabilityTopic(deviceMessage.device, globalConfig.gateways.base_topic),
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
        state_topic: getDeviceStateTopic(deviceMessage.device, globalConfig.gateways.base_topic),
        origin: {
            name: globalConfig.gateway_name,
            sw_version: globalConfig.gateway_version,
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
                    suggested_display_precision: getSuggestedDecimalPrecision(configEntry, globalConfig),
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

const haDiscoverAdapter = (
    deviceMessage: DeviceAvailabilityMessage,
    config: GlobalConfiguration
): Effect.Effect<MqttMessage[], SensorConfigurationMissingError> =>
    Effect.gen(function* () {
        const configuration = yield* getHASensorConfiguration(deviceMessage);

        return Object.entries(configuration).map(([propertyName, configEntry]) => {
            const haDiscoveryPayload = getHaDiscoveryPayload(propertyName, configEntry, deviceMessage, config);
            const payload = haDiscoveryPayload.payload;

            return {
                topic: `${config.homeassistant.discovery_topic}/${haDiscoveryPayload.component}/${deviceMessage.device.id}/${getObjectID(
                    deviceMessage,
                    configEntry
                )}/config`,
                retain: true,
                payload: payload !== null ? JSON.stringify(payload) : "",
            };
        });
    });

const generateAvailabilityMessage = (deviceMessage: DeviceMessage, config: GlobalConfiguration): MqttMessage => ({
    retain: true,
    topic: getDeviceAvailabilityTopic(deviceMessage.device, config.gateways.base_topic),
    payload: JSON.stringify(deviceMessage.payload),
});

const generateStateMessage = (deviceMessage: DeviceMessage, config: GlobalConfiguration): MqttMessage => ({
    retain: false,
    topic: getDeviceStateTopic(deviceMessage.device, config.gateways.base_topic),
    payload: JSON.stringify({ ...deviceMessage.payload, time: deviceMessage.time, id: deviceMessage.id }),
});

export const makeHomeAssistantMqttMessageProducer = (): Effect.Effect<
    (deviceMessage: DeviceMessage) => Stream.Stream<MqttMessage, SensorConfigurationMissingError>,
    ConfigurationError | SensorConfigurationMissingError,
    Config
> =>
    Effect.gen(function* () {
        const config = yield* Config;

        return Match.type<DeviceMessage>().pipe(
            Match.when({ type: MessageType.Availability }, (message) =>
                Stream.concat(
                    Stream.fromIterableEffect(haDiscoverAdapter(message, config)),
                    Stream.make(generateAvailabilityMessage(message, config))
                )
            ),
            Match.when({ type: MessageType.SensorData }, (message) =>
                Stream.make(generateStateMessage(message, config))
            ),
            Match.exhaustive
        );
    });
