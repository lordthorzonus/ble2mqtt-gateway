import * as noble from "@abandonware/noble";
import { Peripheral } from "@abandonware/noble";
import { Observable } from "rxjs";

export const scan = (): Observable<Peripheral> => {
    return new Observable<Peripheral>((subscriber) => {
        noble.on("discover", (peripheral) => {
            subscriber.next(peripheral);
        });

        noble.on("stateChange", (state) => {
            if (state === "poweredOn") {
                console.log("Starting scanning BLE devices");
                noble.startScanning([], true);
            }
        });

        return () => noble.stopScanning();
    });
};
