declare module "@abandonware/noble" {
    import {
        Characteristic,
        Descriptor,
        on,
        removeAllListeners,
        removeListener,
        Service,
        startScanning,
        state,
        stopScanning,
    } from "noble";

    interface Advertisement {
        localName: string;
        manufacturerData?: Buffer;
        serviceData: {
            uuid: string;
            data: Buffer;
        }[];
    }

    interface Peripheral {
        address: string;
        uuid: string;
        advertisement: Advertisement;
        rssi: number;
    }

    interface PeripheralWithManufacturerData extends Peripheral {
        advertisement: Required<Advertisement>;
    }

    export {
        Advertisement,
        Characteristic,
        Descriptor,
        on,
        Peripheral,
        PeripheralWithManufacturerData,
        removeAllListeners,
        removeListener,
        Service,
        startScanning,
        state,
        stopScanning,
    };
}
