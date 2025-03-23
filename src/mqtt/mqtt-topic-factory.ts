import { Device } from "../types";

export const getDeviceStateTopic = (device: Device, mqttGatewayBaseTopic: string): string =>
    `${mqttGatewayBaseTopic}/${device.type}/${device.id}/state`;
export const getDeviceAvailabilityTopic = (device: Device, mqttGatewayBaseTopic: string): string =>
    `${mqttGatewayBaseTopic}/${device.type}/${device.id}/availability`;
export const getAnalyticsTopic = (mqttGatewayBaseTopic: string): string => `${mqttGatewayBaseTopic}/gateway/analytics`;
