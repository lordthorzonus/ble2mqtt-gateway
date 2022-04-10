import { mergeMap } from "rxjs/operators";
import { Observable } from "rxjs";
import { DeviceMessage, MqttMessage } from "./types";
import { homeAssistantMqttMessageProducer } from "./mqtt/home-assistant/home-assistant-mqtt-message-producer";
import { getConfiguration } from "./config";
import { BleGateway } from "./gateways/ble-gateway";
import { publish } from "./infra/mqtt-client";

process.stdin.resume();

const config = getConfiguration();

function getConfiguredMqttMessageProducer(): (deviceMessage: DeviceMessage) => Observable<MqttMessage> {
    return homeAssistantMqttMessageProducer;
}

const gateway = new BleGateway(config.gateways);

const messages = gateway.observeEvents().pipe(
    mergeMap((message) => {
        const mqttMessageProducer = getConfiguredMqttMessageProducer();
        return mqttMessageProducer(message);
    })
);

const subscription = messages.subscribe(async (message) => {
    await publish(message);
});

process.on("SIGINT", subscription.unsubscribe);
process.on("SIGTERM", subscription.unsubscribe);
