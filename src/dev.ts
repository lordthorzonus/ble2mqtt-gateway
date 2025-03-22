import { catchError, filter, mergeMap, retry } from "rxjs/operators";
import { getConfiguration } from "./config";
import { BleGateway } from "./gateways/ble-gateway";
import { scan } from "./infra/ble-scanner";
import { logger } from "./infra/logger";
import { DeviceType } from "./types";
import { throwError } from "rxjs";
import { homeAssistantMqttMessageProducer } from "./mqtt/home-assistant/home-assistant-mqtt-message-producer";

const mode: string | undefined = process.argv[2];

logger.info("Dev mode: %s", mode);

if (mode === "ble") {
    const filterManufacturerId = Number(process.argv[3]);

    if (filterManufacturerId) {
        logger.info("Filtering manufacturer id %s", filterManufacturerId);
    }

    scan().subscribe((peripheral) => {
        const manufacturerId = peripheral.advertisement.manufacturerData?.readUInt16LE();

        if (filterManufacturerId && filterManufacturerId !== manufacturerId) {
            return;
        }

        logger.info("Received BLE advertisement %s", peripheral);
    });
}

if (mode === "gateway") {
    const config = getConfiguration();
    const gateway = new BleGateway(config.gateways);
    const filterDeviceType: DeviceType | undefined = process.argv[3] as DeviceType | undefined;

    if (filterDeviceType) {
        logger.info("Filtering device type %s", filterDeviceType);
    }

    gateway.observeEvents().subscribe((message) => {
        if (filterDeviceType && filterDeviceType !== message.device.type) {
            return;
        }

        logger.info("Received device message %s", message);
    });
}

if (mode === "mqtt") {
    const config = getConfiguration();
    const gateway = new BleGateway(config.gateways);
    const filterDeviceType: DeviceType | undefined = process.argv[3] as DeviceType | undefined;

    if (filterDeviceType) {
        logger.info("Filtering device type %s", filterDeviceType);
    }

    const messages = gateway.observeEvents().pipe(
        catchError((error: Error) => {
            logger.error(error);
            return throwError(() => error);
        }),
        retry({ delay: 1000, count: 10, resetOnSuccess: true }),
        filter((message) => {
            if (filterDeviceType && filterDeviceType !== message.device.type) {
                return false;
            }

            return true;
        }),
        mergeMap((message) => {
            return homeAssistantMqttMessageProducer(message);
        })
    );

    messages.subscribe((message) => {
        logger.info("Received MQTT message %s", message);
    });
}
