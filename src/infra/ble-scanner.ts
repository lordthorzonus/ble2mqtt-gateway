import noble from "@stoprocent/noble";
import { Logger } from "./logger.js";
import { Effect, Stream, Data, Queue } from "effect";

export class BleScannerError extends Data.TaggedError("BleScannerError")<{
    message: string;
}> {}

export interface Advertisement {
    localName?: string;
    manufacturerData?: Buffer;
    serviceData: {
        uuid: string;
        data: Buffer;
    }[];
}

export interface Peripheral {
    address: string;
    uuid: string;
    advertisement: Advertisement;
    rssi: number;
}

const startScanning = Effect.gen(function* () {
    const logger = yield* Logger;
    yield* Effect.tryPromise({
        try: () => noble.waitForPoweredOnAsync(),
        catch: (e) =>
            new BleScannerError({ message: e instanceof Error ? e.message : "Noble did not power on successfully" }),
    });
    logger.info("Noble is powered on");

    yield* Effect.tryPromise({
        try: () => noble.startScanningAsync([], true),
        catch: (e) =>
            new BleScannerError({
                message: e instanceof Error ? e.message : "Noble did not start scanning successfully",
            }),
    });

    logger.info("Starting scanning BLE devices");
});

/** Running the stream starts noble scanning, and scanning stops when the stream ends. */
export const scan: Stream.Stream<Peripheral, BleScannerError, Logger> = Effect.gen(function* () {
    const logger = yield* Logger;

    return Stream.callback<Peripheral, BleScannerError, Logger>((queue) =>
        Effect.gen(function* () {
            yield* Effect.acquireRelease(startScanning, () =>
                Effect.gen(function* () {
                    yield* Effect.promise(() => noble.stopScanningAsync());
                    logger.info("BLE scanner stopped");
                })
            );

            yield* Effect.acquireRelease(
                Effect.sync(() => {
                    const onDiscover = (peripheral: Peripheral) => {
                        Queue.offerUnsafe(queue, peripheral);
                    };

                    noble.on("discover", onDiscover);

                    return onDiscover;
                }),
                (onDiscover) =>
                    Effect.sync(() => {
                        logger.info("Cleaning up BLE scanner event listener");
                        noble.removeListener("discover", onDiscover);
                    })
            );
        })
    ).pipe(Stream.tap((peripheral) => Effect.sync(() => logger.debug("Received BLE advertisement %s", peripheral))));
}).pipe(Stream.unwrap);
