import { GatewayError } from "../ble-gateway.js";
import { Peripheral } from "../../infra/ble-scanner.js";
import { DeviceMessage, DeviceType } from "../../types.js";
import { MiFloraGatewayConfiguration } from "../../config.js";
import { DeviceRegistryService, handleBleAdvertisement } from "../gateway-helpers.js";
import { DeviceRegistry, DeviceRegistryEntry } from "../device-registry.js";
import { MiFloraEventBuffer } from "./miflora-event-buffer.js";
import { parseMiFloraPeripheralAdvertisement, SupportedMiFloraMeasurements } from "./miflora-parser/index.js";
import { transformMiFloraMeasurementsToDeviceMessage } from "./miflora-measurement-transformer.js";
import { Effect } from "effect";

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

const handleMifloraMeasurement =
    (miFloraEventBuffer: MiFloraEventBuffer) =>
    (
        peripheral: Peripheral,
        deviceRegistryEntry: DeviceRegistryEntry,
        miFloraMeasurementEvent: SupportedMiFloraMeasurements
    ) => {
        const id = peripheral.uuid;
        const buffer = miFloraEventBuffer.bufferMeasurementEvent(id, miFloraMeasurementEvent);

        if (miFloraEventBuffer.isBufferReady(buffer)) {
            miFloraEventBuffer.clearBuffer(id);

            return Effect.succeedSome(
                transformMiFloraMeasurementsToDeviceMessage(peripheral, deviceRegistryEntry, buffer)
            );
        }

        return Effect.succeedNone;
    };

export const makeMiFloraGateway = (miFloraSettings: MiFloraGatewayConfiguration) => {
    const sensorEventBuffer = new MiFloraEventBuffer(miFloraSettings.devices);

    return (peripheral: Peripheral): Effect.Effect<Iterable<DeviceMessage>, GatewayError, DeviceRegistryService> => {
        return handleBleAdvertisement(peripheral, {
            deviceType: DeviceType.MiFlora,
            unknownDevices: "ignore",
            parseAdvertisement: parseMiFloraPeripheralAdvertisement,
            resolveDeviceModel: () => "miflora",
            handleDeviceSensorData: handleMifloraMeasurement(sensorEventBuffer),
        }).pipe(
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
                InvalidMiFloraDataLengthError: (error) =>
                    new GatewayError({
                        peripheral,
                        message: `Invalid MiFlora data length for event ${error.eventType}: ${error.length}, expected at least ${error.minimumLength}`,
                    }),
            })
        );
    };
};
