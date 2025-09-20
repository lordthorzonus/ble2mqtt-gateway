import { Logger, LoggerInterface } from "../infra/logger";
import { Context, Effect } from "effect";
import { Config, GlobalConfiguration } from "../config";

export const mockLogger: LoggerInterface = {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
} as unknown as LoggerInterface;

export const mockMqttClient = {
    publish: jest.fn(),
};

const mockConfig: GlobalConfiguration = {
    mqtt: {
        host: "localhost",
        port: 1883,
        username: "test",
        password: "test",
        client_id: "test",
        protocol: "mqtt",
    },
    log_level: "info",
    decimal_precision: 2,
    unavailable_devices_check_interval_ms: 1000,
    gateway_name: "test",
    gateway_version: "1.0.0",
    gateways: {
        base_topic: "test",
        ruuvitag: {
            allow_unknown: true,
            timeout: 1000,
            devices: [
                {
                    name: "test",
                    id: "test",
                    model: "environmental",
                },
            ],
        },
        miflora: {
            timeout: 1000,
            devices: [{ name: "test", id: "test" }],
        },
    },
    homeassistant: {
        discovery_topic: "homeassistant",
    },
};

export const getTestConfig = (partialConfig: Partial<GlobalConfiguration>): Config => {
    return Config.make({ ...mockConfig, ...partialConfig });
};

export const TestContext = Context.empty().pipe(
    Context.add(Config, Config.make(mockConfig)),
    Context.add(Logger, Logger.make(mockLogger))
);

export const testEffectWithContext = <A, E, R extends Config | Logger>(
    program: Effect.Effect<A, E, R>,
    context: Context.Context<R> = TestContext
) => {
    return Effect.provide(program, context);
};
