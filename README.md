# BLE2MQTT Gateway
Currently supports RuuviTags and MiFlora Devices.

## Example Configuration (configuration.yaml)
```yaml
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

## Example docker-compose.yml
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