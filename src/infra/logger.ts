import { createLogger, format, transports } from "winston";
import { getConfiguration } from "../config";

const config = getConfiguration();

export const logger = createLogger({
    level: config.log_level,
    format: format.combine(
        format.colorize({ all: true }),
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
