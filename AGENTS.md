# BLE2MQTT Gateway

## Verification

- Run all tests with `npm test`, or a single file with `npm test -- src/config.test.ts`. Tests use Vitest.
- For code changes, run the affected tests, `npm run typecheck`, `npm run build`, and `npm run lint`. Report failures and any checks not run, with reasons.
- For runtime debugging, see the development modes in `README.md`. These scan real BLE devices but log instead of publishing MQTT messages.

## Code conventions

- Use Effect for side effects and `Data.TaggedError` for typed errors. Keep transformations pure where possible.
- Use Effect Schema for new validation. Existing Zod validation, including `src/config.ts`, is legacy code to migrate when that migration is part of the task.
- Fix production types without type assertions. Tests may use assertions when needed for fixtures or mocks.
- Use Luxon's `DateTime` and `Duration` for dates and time calculations.
- Follow `.prettierrc`, `.oxlintrc.json`, `eslint.config.mjs`, and `tsconfig.json` for formatting, linting, and compiler settings.
- `npm run lint` runs oxlint first (through `effect-tsgo oxlint`, which adds the Effect rules), then ESLint for Prettier and the few rules oxlint lacks. Plain `npx oxlint` cannot load the `effecttsgo` plugin.

## Task-specific references

### Home Assistant discovery

When changing discovery messages in `src/mqtt/home-assistant/`, consult the relevant MQTT entity format and device classes:

- https://www.home-assistant.io/integrations/sensor.mqtt/
- https://www.home-assistant.io/integrations/sensor#device-class
- https://www.home-assistant.io/integrations/binary_sensor/#device-class
- https://developers.home-assistant.io/docs/core/entity/sensor/

### RuuviTag parsing

When changing parsers in `src/gateways/ruuvitag/ruuvitag-parser/`, consult the relevant Ruuvi specification:

- https://docs.ruuvi.com/communication/bluetooth-advertisements
- https://docs.ruuvi.com/communication/bluetooth-advertisements/data-format-6
- https://docs.ruuvi.com/communication/bluetooth-advertisements/data-format-e1

Account for the manufacturer header and format byte when translating documented offsets into buffer offsets. Check the existing parser and packet fixtures rather than copying offsets directly.
