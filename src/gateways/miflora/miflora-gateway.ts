import { GatewayError } from "../ble-gateway";
import { Peripheral } from "@abandonware/noble";
import { DeviceMessage, DeviceType } from "../../types";
import { MiFloraGatewayConfiguration } from "../../config";
import { DeviceRegistryService, handleBleAdvertisement } from "../gateway-helpers";
import { DeviceRegistry, DeviceRegistryEntry } from "../device-registry";
import { MiFloraEventBuffer } from "./miflora-event-buffer";
import { parseMiFloraPeripheralAdvertisement } from "./miflora-parser";
import { transformMiFloraMeasurementsToDeviceMessage } from "./miflora-measurement-transformer";
import { Effect, Option } from "effect";
import { Logger } from "../../infra/logger";

export const mifloraGatewayId = 0x95fe;

export const isMiFloraPeripheral = (peripheral: Peripheral): boolean => {
    const knownMiFloraDeviceNames = ["flower care", "flower mate"];
    const MiFloraMacPrefix = "c4:7c:8d";
    const deviceLocalName = peripheral.advertisement.localName ?? "";

    return (
        knownMiFloraDeviceNames.includes(deviceLocalName.toLowerCase()) ||
        peripheral.address.startsWith(MiFloraMacPrefix)
    );
};

export type ConfiguredMiFloraSensors = MiFloraGatewayConfiguration["devices"];

export const makeMiFloraDeviceRegistry = (
    miFloraSettings: MiFloraGatewayConfiguration,
    globalDefalts: {
        defaultDecimalPrecision: number;
    }
): DeviceRegistry => {
    const deviceSettings = miFloraSettings.devices.map((sensor) => ({
        device: {
            id: sensor.id,
            type: DeviceType.MiFlora,
            friendlyName: sensor.name,
            model: "miflora",
        },
        timeout: sensor.timeout,
    }));

    const defaultDecimalPrecision = miFloraSettings.decimal_precision ?? globalDefalts.defaultDecimalPrecision;

    return new DeviceRegistry(deviceSettings, miFloraSettings.timeout, defaultDecimalPrecision);
};

const handleMifloraBleAdvertisement =
    (miFloraEventBuffer: MiFloraEventBuffer) => (peripheral: Peripheral, deviceRegistryEntry: DeviceRegistryEntry) =>
        Effect.gen(function* () {
            const id = peripheral.uuid;
            const miFloraMeasurementEvent = yield* parseMiFloraPeripheralAdvertisement(peripheral);

            const buffer = miFloraEventBuffer.bufferMeasurementEvent(id, miFloraMeasurementEvent);

            if (miFloraEventBuffer.isBufferReady(buffer)) {
                miFloraEventBuffer.clearBuffer(id);
                return Option.some(
                    transformMiFloraMeasurementsToDeviceMessage(peripheral, deviceRegistryEntry, buffer)
                );
            }

            return Option.none();
        });

export const makeMiFloraGateway = (miFloraSettings: MiFloraGatewayConfiguration) => {
    const sensorEventBuffer = new MiFloraEventBuffer(miFloraSettings.devices);

    return (
        peripheral: Peripheral
    ): Effect.Effect<Iterable<DeviceMessage>, GatewayError, DeviceRegistryService | Logger> => {
        return handleBleAdvertisement(
            peripheral,
            DeviceType.MiFlora,
            false,
            () => Effect.succeed("miflora"),
            handleMifloraBleAdvertisement(sensorEventBuffer)
        ).pipe(
            Effect.catchTags({
                InvalidMiFloraAdvertisementError: (error) =>
                    new GatewayError({
                        peripheral,
                        message: `Invalid MiFlora advertisement: ${error.message}`,
                    }),
                DeviceNotFoundError: (error) =>
                    new GatewayError({
                        peripheral,
                        message: `Device not found: ${error.id}`,
                    }),
                UnsupportedMiFloraEventError: (error) =>
                    new GatewayError({
                        peripheral,
                        message: `Unsupported MiFlora event: ${error.eventType}`,
                    }),
            })
        );
    };
};
