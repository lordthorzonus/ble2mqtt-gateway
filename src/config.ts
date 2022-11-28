import { load } from "js-yaml";
import * as fs from "fs";
import { z, ZodError } from "zod";

const mqttSchema = z.object({
    host: z.string(),
    port: z.number().int().default(1883),
    username: z.string(),
    password: z.string(),
    client_id: z.string(),
    protocol: z.union([z.literal("mqtt"), z.literal("mqtts"), z.literal("tcp"), z.literal("ssl")]).default("mqtt"),
});

const ruuvitagSchema = z
    .object({
        allow_unknown: z.boolean().default(false),
        timeout: z.number().int().default(30000),
        devices: z
            .array(
                z.object({
                    name: z.string(),
                    id: z.string(),
                    timeout: z.number().int().optional(),
                })
            )
            .min(0),
    })
    .optional();

const miFloraSchema = z
    .object({
        timeout: z.number().int().default(60000),
        devices: z
            .array(
                z.object({
                    name: z.string(),
                    id: z.string(),
                    timeout: z.number().int().optional(),
                })
            )
            .min(0),
    })
    .optional();

const configSchema = z.object({
    log_level: z.union([z.literal("info"), z.literal("debug"), z.literal("error")]).default("info"),
    mqtt: mqttSchema,
    gateways: z.object({
        base_topic: z.string().default("ble2mqtt"),
        ruuvitag: ruuvitagSchema,
        miflora: miFloraSchema,
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

const configurationFileLocation = process.env.CONFIG_FILE_LOCATION ?? `${__dirname}/../config/configuration.yaml`;
const configurationFileContent = fs.readFileSync(configurationFileLocation, "utf-8");
const config = load(configurationFileContent);

export type Config = z.infer<typeof configSchema>;

export const getConfiguration = (): Config => {
    try {
        return configSchema.parse(config);
    } catch (e) {
        if (e instanceof ZodError) {
            console.error(produceErrorMessage(e));
        }

        throw e;
    }
};
