# BLE2MQTT Gateway
Currently supports RuuviTags.

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
      - name: fridge_ruuvitag
        id: da21045d81a8
      - name: balcony_second
        id: 641cae0910b5
homeassistant:
  discovery_topic: homeassistant
```

## Example docker-compose.yml
```yaml
services:
  ble2mqtt:
    image: "lordthorzonus/ble2mqtt-gateway:0.1.0"
    restart: unless-stopped
    volumes:
      - ./configuration.yaml:/home/node/app/config/configuration.yaml
    enviroment:
      - CONFIG_FILE_LOCATION: "/home/node/app/config/configuration.yaml"
      - TZ: "Europe/Helsinki" 
```