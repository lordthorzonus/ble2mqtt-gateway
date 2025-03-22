import { createLogger, format, transports } from "winston";
import { Effect } from "effect";
import { Config } from "../config";

export type LoggerInterface = ReturnType<typeof createLogger>;
export class Logger extends Effect.Service<Logger>()("Logger", {
    effect: Effect.gen(function* () {
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
    }),
    dependencies: [Config.Default],
}) {}
