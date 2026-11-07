import { createLogger, format, transports } from "winston";
import { Context, Effect, Layer } from "effect";
import { Config } from "../config.js";

export type LoggerInterface = ReturnType<typeof createLogger>;

const makeLogger = Effect.gen(function* () {
    const config = yield* Config;

    return createLogger({
        level: config.log_level,
        format: format.combine(
            format.timestamp({
                format: "YYYY-MM-DD HH:mm:ss",
            }),
            format.errors({ stack: true }),
            format.splat(),
            format.json()
        ),
        defaultMeta: {
            gateway: config.gateways.base_topic,
        },
        transports: [new transports.Console()],
    });
});

export class Logger extends Context.Service<Logger, LoggerInterface>()("Logger") {
    static readonly layerWithoutDependencies = Layer.effect(this, makeLogger);
    static readonly layer = this.layerWithoutDependencies.pipe(Layer.provide(Config.layer));
}
