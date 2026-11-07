/**
 * RuuviTag data format byte, the first byte after the manufacturer id.
 * Separate from `index.ts` so the parsing strategies can use the enum without a circular import.
 *
 * @see https://docs.ruuvi.com/communication/bluetooth-advertisements
 */
export enum RuuvitagSensorProtocolDataFormat {
    DataFormat3 = 0x03,
    DataFormat2And4 = 0x04,
    DataFormat5 = 0x05,
    DataFormat6 = 0x06,
    DataFormatE1 = 0xe1,
}
