import * as mqtt from "mqtt";

import { MqttMessage } from "../types";
import { getConfiguration } from "../config";
import { logger } from "./logger";

const config = getConfiguration();

const client = mqtt.connect(config.mqtt.host, {
    clientId: config.mqtt.client_id,
    username: config.mqtt.username,
    password: config.mqtt.password,
    port: config.mqtt.port,
    protocol: config.mqtt.protocol,
    rejectUnauthorized: false,
    connectTimeout: 10,
});

export const publish = async (message: MqttMessage): Promise<void> => {
    return new Promise((resolve, reject) => {
        logger.debug("Publishing MQTT Message", { message });
        client.publish(
            message.topic,
            message.payload,
            {
                retain: message.retain,
            },
            (error) => {
                if (error) {
                    reject(error);
                }
                resolve();
            }
        );
    });
};
