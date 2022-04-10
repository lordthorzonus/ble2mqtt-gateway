export const ruuviTagManufacturerId = 0x0499;

/**
 * Checks if the given manufacturerData contains the correct manufacturerId 0x0499 The least significant byte first.
 */
export const validateRuuviTag = (manufacturerData?: Buffer): boolean => {
    if (!manufacturerData) {
        return false;
    }

    const manufacturerId = manufacturerData.readUInt16LE(0);

    return manufacturerId === ruuviTagManufacturerId;
};
