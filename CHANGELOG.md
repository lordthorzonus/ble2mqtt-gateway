# Changelog

## [0.15.0] - 2025-09-21

### Added

- **RuuviTag Air Quality Support**: Preliminary support for RuuviTag air quality sensors with Data Format 6 and E1
    - PM1.0, PM2.5, PM4.0, PM10.0 particulate matter measurements
    - CO2, VOC (Volatile Organic Compounds), and NOX readings
    - Luminosity measurements
    - Calibration status monitoring
    - Indoor air quality index calculations (IAQI) with couple of different algorithms
    - Data Format 6 packets are automatically filtered out when E1 format is detected from the same device
### Configuration

- **Device Model Setting**: Added optional `model` configuration for RuuviTag devices
    - `environmental`: Standard RuuviTag with temperature, humidity, pressure (default)
    - `air-quality`: Air quality RuuviTag with PM, CO2, VOC, NOX sensors
    - If using unknown devices, this is auto-detected based on the sensor data.

**Example configuration for air quality RuuviTag:**

```yaml
gateways:
    ruuvitag:
        devices:
            - name: "Living Room Air Quality"
              id: "aa:bb:cc:dd:ee:ff"
              model: "air-quality" # Optional: falls back to "environmental" if not specified
```
