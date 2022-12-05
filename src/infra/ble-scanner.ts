import * as noble from "@abandonware/noble";
import { Peripheral } from "@abandonware/noble";
import { Observable } from "rxjs";
import { logger } from "./logger";

const startScanning = () => {
    logger.info("Starting scanning BLE devices");
    noble.startScanning([], true);
};

export const scan = (): Observable<Peripheral> => {
    return new Observable<Peripheral>((subscriber) => {
        if (noble.state === "poweredOn") {
            startScanning();
        }

        noble.on("discover", (peripheral: Peripheral) => {
            logger.debug("Received BLE advertisement %s", peripheral);
            subscriber.next(peripheral);
        });

        noble.on("stateChange", (state) => {
            logger.info("Noble state changed to %s", state);

            if (state === "poweredOn") {
                startScanning();
            }
        });

        return () => {
            noble.stopScanning();
            noble.removeAllListeners();
        };
    });
};
