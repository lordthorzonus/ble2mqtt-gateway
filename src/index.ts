import { gateway } from "./gateway.js";
import { Config } from "./config.js";
import { MqttClient } from "./infra/mqtt-client.js";
import { Logger } from "./infra/logger.js";
import { Effect, Layer } from "effect";
import { NodeRuntime } from "@effect/platform-node";
process.stdin.resume();

const GatewayLive = Layer.mergeAll(Config.layer, Logger.layer, MqttClient.layer);

const configuredGateway = Effect.provide(Effect.scoped(gateway), GatewayLive);
NodeRuntime.runMain(configuredGateway);
