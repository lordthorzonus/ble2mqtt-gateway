import { createLogger, format, transports } from "winston";
import { Context, Effect, Layer } from "effect";
import { Config } from "../config";

export type LoggerInterface = ReturnType<typeof createLogger>;
export class Logger extends Context.Tag("Logger")<Logger, { logger: LoggerInterface }>() {}

export const LoggerLive = Layer.effect(
    Logger,
    Effect.gen(function* () {
        const { config } = yield* Config;

        return {
            logger: createLogger({
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
            }),
        };
    })
);
