import { catchError, mergeMap, retry } from "rxjs/operators";
import { throwError } from "rxjs";
import { homeAssistantMqttMessageProducer } from "./mqtt/home-assistant/home-assistant-mqtt-message-producer";
import { getConfiguration } from "./config";
import { BleGateway } from "./gateways/ble-gateway";
import { publish } from "./infra/mqtt-client";
import { logger } from "./infra/logger";

process.stdin.resume();

const config = getConfiguration();

const gateway = new BleGateway(config.gateways);

const messages = gateway.observeEvents().pipe(
    catchError((error: Error) => {
        logger.error(error);
        return throwError(() => error);
    }),
    retry({ delay: 1000, count: 10, resetOnSuccess: true }),
    mergeMap((message) => {
        return homeAssistantMqttMessageProducer(message);
    })
);

const subscription = messages.subscribe((message) => {
    publish(message).catch((e) => {
        logger.error(e);
        logger.error("Error publishing MQTT message", { message });
    });
});

process.on("SIGINT", () => subscription.unsubscribe());
process.on("SIGTERM", () => subscription.unsubscribe());
