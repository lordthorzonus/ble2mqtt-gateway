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
    }

    interface Peripheral {
        address: string;
        uuid: string;
        advertisement: Advertisement;
    }

    export {
        Advertisement,
        Characteristic,
        Descriptor,
        on,
        Peripheral,
        removeAllListeners,
        removeListener,
        Service,
        startScanning,
        state,
        stopScanning,
    };
}
