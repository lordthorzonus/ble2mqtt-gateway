# BLE2MQTT Gateway

Gateway for turning ble data into home assistant compatible mqtt messages. Currently supports RuuviTags and MiFlora Devices.

## Configuration

### Example Configuration (configuration.yaml)

```yaml
log_level: info
decimal_precision: 1
mqtt:
    host: mqtt.lan.fi
    port: 1883
    username: ble2mqtt
    password: secret
    client_id: ble2mqtt
    protocol: mqtt

gateways:
    base_topic: ble2mqtt
    ruuvitag:
        allow_unknown: false
        devices:
            - name: Fridge Ruuvitag
              id: da21045d81a8
            - name: Balcony Second
              id: 641cae0910b5
              timeout: 10000
    miflora:
        devices:
            - name: My super plant
              id: c47c8d6e07cf
              timeout: 40000
homeassistant:
    discovery_topic: homeassistant
```

### Example docker-compose.yml

```yaml
services:
    ble2mqtt:
        image: "lordthorzonus/ble2mqtt-gateway:edge"
        restart: unless-stopped
        cap_add:
            - NET_RAW
        network_mode: host
        volumes:
            - ./configuration.yaml:/home/node/app/config/configuration.yaml
        environment:
            - CONFIG_FILE_LOCATION="/home/node/app/config/configuration.yaml"
            - TZ="Europe/Helsinki"
```

## Development

```bash
npm install
cp config/configuration.example.yaml config/configuration.yaml
```

Dev modes that don't actually send any mqtt messages:

-   `npm run dev ble` - Run in dev mode logging all received ble messages
-   `npm run dev ble {manufacturerId}` - Run in dev mode logging only messages from given manufacturer
-   `npm run dev gateway` - Run in dev mode logging all produced device messages
-   `npm run dev gateway {deviceType}` - Run in dev mode logging all produced device messages from given device type
-   `npm run dev mqtt` - Run in dev mode logging all mqtt messages that should be sent
