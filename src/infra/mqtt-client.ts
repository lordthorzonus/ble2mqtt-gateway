import * as mqtt from "mqtt";

import { MqttMessage } from "../types";
import { getConfiguration } from "../config";
import { logger } from "./logger";

const config = getConfiguration();

const client = mqtt.connect({
    clientId: config.mqtt.client_id,
    username: config.mqtt.username,
    password: config.mqtt.password,
    port: config.mqtt.port,
    protocol: config.mqtt.protocol,
    rejectUnauthorized: true,
    hostname: config.mqtt.host,
    protocolVersion: 5,
    connectTimeout: 50,
});

client.on("connect", () => {
    logger.info("MQTT client connected");
});

client.on("disconnect", () => {
    logger.info("MQTT client disconnected");
});

client.on("error", (error) => {
    logger.error(error);
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
