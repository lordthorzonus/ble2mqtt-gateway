import { catchError, mergeMap, retry } from "rxjs/operators";
import { throwError } from "rxjs";
import { MessageType } from "./types";
import { homeAssistantMqttMessageProducer } from "./mqtt/home-assistant/home-assistant-mqtt-message-producer";
import { getConfiguration } from "./config";
import { BleGateway } from "./gateways/ble-gateway";
import { publish } from "./infra/mqtt-client";
import { analyticsMqttMessageProducer } from "./mqtt/analytics-mqtt-message-producer";
import { logger } from "./infra/logger";

process.stdin.resume();

const config = getConfiguration();

const gateway = new BleGateway(config.gateways);

const messages = gateway.observeEvents().pipe(
    catchError((error) => {
        logger.error(error);
        return throwError(() => error);
    }),
    retry({ delay: 1000, count: 10, resetOnSuccess: true }),
    mergeMap((message) => {
        if (message.type === MessageType.Analytics) {
            return analyticsMqttMessageProducer(message);
        }

        return homeAssistantMqttMessageProducer(message);
    })
);

const subscription = messages.subscribe(async (message) => {
    try {
        await publish(message);
    } catch (e) {
        logger.error("Error publishing MQTT message", { message });
    }
});

process.on("SIGINT", subscription.unsubscribe);
process.on("SIGTERM", subscription.unsubscribe);
