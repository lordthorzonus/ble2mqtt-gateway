import { AnalyticsMessage, Device } from "../types";
import { getConfiguration } from "../config";

const config = getConfiguration();
const mqttGatewayBaseTopic = config.gateways.base_topic;

export const getDeviceStateTopic = (device: Device): string =>
    `${mqttGatewayBaseTopic}/${device.type}/${device.id}/state`;
export const getDeviceAvailabilityTopic = (device: Device): string =>
    `${mqttGatewayBaseTopic}/${device.type}/${device.id}/availability`;
export const getAnalyticsTopic = (): string => `${mqttGatewayBaseTopic}/gateway/analytics`;
