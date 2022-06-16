import { AnalyticsMessage, MqttMessage } from "../types";
import { Observable, of } from "rxjs";
import { getAnalyticsTopic } from "./mqtt-topic-factory";

export const analyticsMqttMessageProducer = (message: AnalyticsMessage): Observable<MqttMessage> => {
    const mqttMessage: MqttMessage = {
        topic: getAnalyticsTopic(),
        payload: JSON.stringify({ ...message.payload, time: message.time, id: message.id }),
        retain: false,
    };

    return of(mqttMessage);
};
