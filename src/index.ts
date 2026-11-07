import { gateway } from "./gateway.js";
import { Config } from "./config.js";
import { MqttClient } from "./infra/mqtt-client.js";
import { Logger } from "./infra/logger.js";
import { Effect, Layer } from "effect";
import { NodeRuntime } from "@effect/platform-node";

const GatewayLive = Layer.mergeAll(Config.layer, Logger.layer, MqttClient.layer);

const configuredGateway = Effect.provide(Effect.scoped(gateway), GatewayLive);

// oxlint-disable-next-line effecttsgo/unstable-api-usage -- runMain is Effect's recommended entry point because it handles signals and exit codes, and no stable API replaces it.
NodeRuntime.runMain(configuredGateway);
