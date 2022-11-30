import * as noble from "@abandonware/noble";
import { Peripheral } from "@abandonware/noble";
import { Observable } from "rxjs";
import { logger } from "./logger";

export const scan = (): Observable<Peripheral> => {
    return new Observable<Peripheral>((subscriber) => {
        if (noble.state === "poweredOn") {
            noble.startScanning([], true);
        }

        noble.on("discover", (peripheral: Peripheral) => {
            logger.debug("Received BLE advertisement %p", peripheral);
            subscriber.next(peripheral);
        });

        noble.on("stateChange", (state) => {
            logger.info("Noble state changed to %s", state);

            if (state === "poweredOn") {
                logger.info("Starting scanning BLE devices");
                noble.startScanning([], true);
            }
        });

        return () => {
            noble.stopScanning();
            noble.removeAllListeners();
        };
    });
};
