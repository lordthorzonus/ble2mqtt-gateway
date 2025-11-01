import { load } from "js-yaml";
import fs from "fs";
import { z, ZodError } from "zod";
import { Data, Effect } from "effect";

const mqttSchema = z.object({
    host: z.string(),
    port: z.number().int().default(1883),
    username: z.string(),
    password: z.string(),
    client_id: z.string(),
    protocol: z.union([z.literal("mqtt"), z.literal("mqtts"), z.literal("tcp"), z.literal("ssl")]).default("mqtt"),
});

const ruuvitagSchema = z.object({
    allow_unknown: z.boolean().default(false),
    timeout: z.number().int().default(30000),
    decimal_precision: z.number().int().optional(),
    devices: z
        .array(
            z.object({
                name: z.string(),
                id: z.string(),
                timeout: z.number().int().optional(),
                model: z.enum(["environmental", "air-quality"]).optional().default("environmental"),
            })
        )
        .min(0),
});

const miFloraSchema = z.object({
    timeout: z.number().int().default(60000),
    decimal_precision: z.number().int().optional(),
    devices: z
        .array(
            z.object({
                name: z.string(),
                id: z.string(),
                timeout: z.number().int().optional(),
            })
        )
        .min(0),
});

const concurrencySchema = z
    .union([z.literal("unbounded"), z.number().int().positive()])
    .default("unbounded")
    .describe(
        "Concurrency level for stream processing. Use 'unbounded' for maximum throughput or a positive number to limit."
    );

const configSchema = z.object({
    log_level: z.union([z.literal("info"), z.literal("debug"), z.literal("error")]).default("info"),
    decimal_precision: z.number().int().default(2),
    gateway_name: z.string().default("ble2mqtt"),
    gateway_version: z.string().default("development"),
    mqtt: mqttSchema,
    unavailable_devices_check_interval_ms: z.number().int().default(10000),
    concurrency: z
        .object({
            ble_gateway_processing: concurrencySchema,
            mqtt_message_production: concurrencySchema,
            mqtt_publishing: concurrencySchema,
        })
        .default({
            ble_gateway_processing: "unbounded",
            mqtt_message_production: "unbounded",
            mqtt_publishing: "unbounded",
        }),
    gateways: z.object({
        base_topic: z.string().default("ble2mqtt"),
        ruuvitag: ruuvitagSchema.optional(),
        miflora: miFloraSchema.optional(),
    }),
    homeassistant: z
        .object({
            discovery_topic: z.string().default("homeassistant"),
        })
        .default({
            discovery_topic: "homeassistant",
        }),
});

const produceErrorMessage = (error: ZodError) => {
    const errorMessage = "Found following errors in configuration: \n";
    return error.issues.reduce((acc, issue) => {
        const errorPath = issue.path.join(".");

        return acc.concat(errorPath, ": ", issue.message, "\n");
    }, errorMessage);
};

export class ConfigurationError extends Data.TaggedError("ConfigurationError")<{
    message: string;
    cause: unknown;
}> {}

export type RuuviTagGatewayConfiguration = z.infer<typeof ruuvitagSchema>;
export type MiFloraGatewayConfiguration = z.infer<typeof miFloraSchema>;
export type GlobalConfiguration = z.infer<typeof configSchema>;

const getConfiguration: Effect.Effect<z.infer<typeof configSchema>, ConfigurationError> = Effect.gen(function* () {
    const configurationFileLocation = process.env.CONFIG_FILE_LOCATION ?? `${__dirname}/../config/configuration.yaml`;

    const configurationFileContent = yield* Effect.try({
        try: () => fs.readFileSync(configurationFileLocation, "utf-8"),
        catch: (e) => new ConfigurationError({ message: "Failed to read configuration file", cause: e }),
    });

    const config = yield* Effect.try({
        try: () => load(configurationFileContent),
        catch: (e) => new ConfigurationError({ message: "Failed to parse yaml", cause: e }),
    });

    const parsedConfig = configSchema.safeParse(config);

    if (!parsedConfig.success) {
        return yield* new ConfigurationError({
            message: produceErrorMessage(parsedConfig.error),
            cause: parsedConfig.error,
        });
    }

    return yield* Effect.succeed(parsedConfig.data);
});

export class Config extends Effect.Service<Config>()("Config", {
    effect: getConfiguration,
}) {}
