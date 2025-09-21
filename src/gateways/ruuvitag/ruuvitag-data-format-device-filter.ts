import { RuuvitagSensorProtocolDataFormat } from "./ruuvitag-parser";
import { DateTime, Duration } from "luxon";

const PACKET_DEDUPLICATION_TTL = Duration.fromObject({
    minutes: 5,
});

export class RuuvitagDataFormatDeviceFilter {
    private deviceE1Cache = new Map<string, DateTime<true>>();

    shouldDiscardPeripheral(deviceId: string, dataFormat: RuuvitagSensorProtocolDataFormat): boolean {
        if (dataFormat !== RuuvitagSensorProtocolDataFormat.DataFormat6) {
            return false;
        }

        const lastE1 = this.deviceE1Cache.get(deviceId);
        return lastE1 ? DateTime.now().diff(lastE1).toMillis() < PACKET_DEDUPLICATION_TTL.toMillis() : false;
    }

    markE1FormatSeen(deviceId: string): void {
        this.deviceE1Cache.set(deviceId, DateTime.now());
    }
}
