/**
 * RuuviTag data format byte, the first byte after the manufacturer id.
 * Kept in its own module so the parsing strategies can use it without importing the parser entrypoint.
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
