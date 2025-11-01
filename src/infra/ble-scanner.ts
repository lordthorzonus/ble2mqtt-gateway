import noble from "@stoprocent/noble";
import { Logger } from "./logger";
import { Effect, Stream, Data, Chunk } from "effect";

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

export const scan = (): Stream.Stream<Peripheral, BleScannerError, Logger> =>
    Effect.gen(function* () {
        const logger = yield* Logger;
        return Stream.acquireRelease(startScanning, () => Effect.promise(() => noble.stopScanningAsync())).pipe(
            Stream.flatMap(() =>
                Stream.async<Peripheral, BleScannerError>((emit) => {
                    noble.on("discover", (peripheral: Peripheral) => {
                        void emit(Effect.succeed(Chunk.of(peripheral)));
                    });
                })
            ),
            Stream.tap((peripheral) => Effect.sync(() => logger.debug("Received BLE advertisement %s", peripheral)))
        );
    }).pipe(Stream.unwrap);
