import { gateway } from "./gateway";
import { Config } from "./config";
import { MqttClient } from "./infra/mqtt-client";
import { Logger } from "./infra/logger";
import { Effect, Layer } from "effect";
import { NodeRuntime } from "@effect/platform-node";
process.stdin.resume();

const GatewayLive = Layer.mergeAll(Config.Default, Logger.Default, MqttClient.Default);

const configuredGateway = Effect.provide(Effect.scoped(gateway), GatewayLive);
NodeRuntime.runMain(configuredGateway);
