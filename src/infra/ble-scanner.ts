import noble from "@abandonware/noble";
import { Peripheral } from "@abandonware/noble";
import { logger } from "./logger";
import { Effect, Stream, Chunk, Option } from "effect";

const startScanning = () => {
    logger.info("Starting scanning BLE devices");
    noble.startScanning([], true);
};

export const scan = (): Stream.Stream<Peripheral> =>
    Stream.async((emit) => {
        if (noble.state === "poweredOn") {
            startScanning();
        }

        noble.on("discover", (peripheral: Peripheral) => {
            logger.debug("Received BLE advertisement %s", peripheral);
            void emit(Effect.succeed(Chunk.of(peripheral)));
        });

        noble.on("stateChange", (state) => {
            logger.info("Noble state changed to %s", state);

            if (state === "poweredOn") {
                startScanning();
            }

            if (state === "poweredOff") {
                void emit(Effect.fail(Option.none()));
            }
        });
    });

export const stopScanning = (): void => {
    noble.stopScanning();
    noble.removeAllListeners();
};
