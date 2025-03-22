import { getConfiguration } from "./config";
import { makeGateway } from "./gateways/ble-gateway";
import { scan } from "./infra/ble-scanner";
import { logger } from "./infra/logger";
import { DeviceType } from "./types";
import { homeAssistantMqttMessageProducer } from "./mqtt/home-assistant/home-assistant-mqtt-message-producer";
import { Stream, Effect, pipe } from "effect";

const mode: string | undefined = process.argv[2];

logger.info("Dev mode: %s", mode);

if (mode === "ble") {
    const filterManufacturerId = Number(process.argv[3]);

    if (filterManufacturerId) {
        logger.info("Filtering manufacturer id %s", filterManufacturerId);
    }

    void Effect.runPromise(
        scan().pipe(
            Stream.runForEach((peripheral) =>
                Effect.sync(() => {
                    const manufacturerId = peripheral.advertisement.manufacturerData?.readUInt16LE();

                    if (filterManufacturerId && filterManufacturerId !== manufacturerId) {
                        return;
                    }

                    logger.info("Received BLE advertisement %s", peripheral);
                })
            )
        )
    );
}

if (mode === "gateway") {
    const config = getConfiguration();
    const gateway = makeGateway(config.gateways);
    const filterDeviceType: DeviceType | undefined = process.argv[3] as DeviceType | undefined;

    if (filterDeviceType) {
        logger.info("Filtering device type %s", filterDeviceType);
    }

    void Effect.runPromise(
        pipe(
            scan(),
            gateway,
            Stream.runForEach((message) =>
                Effect.sync(() => {
                    if (filterDeviceType && filterDeviceType !== message.device.type) {
                        return;
                    }

                    logger.info("Received Device message %s", JSON.stringify(message));
                })
            )
        )
    );
}

if (mode === "mqtt") {
    const config = getConfiguration();
    const gateway = makeGateway(config.gateways);
    const filterDeviceType: DeviceType | undefined = process.argv[3] as DeviceType | undefined;

    if (filterDeviceType) {
        logger.info("Filtering device type %s", filterDeviceType);
    }

    void Effect.runPromise(
        pipe(
            scan(),
            gateway,
            Stream.flatMap((message) => Stream.fromIterable(homeAssistantMqttMessageProducer(message))),
            Stream.runForEach((message) =>
                Effect.sync(() => logger.info("Received MQTT message %s", JSON.stringify(message)))
            )
        )
    );
}
