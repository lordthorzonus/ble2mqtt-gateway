jest.mock("fs");

import { readFileSync } from "fs";

const mockReadFileSync = readFileSync as jest.Mock;

const exampleConfiguration = `
mqtt:
  host: mqtt.lan.fi
  port: 8883
  username: a
  password: b
  client_id: c

gateways:
  base_topic: mqtt
  ruuvitag:
    allow_unknown: true
    devices:
      - name: fridge_ruuvitag
        id: da21045d81a8
      - name: balcony_ruuvitag
        id: 641cae0910b5
  miflora:
    devices:
      - name: other_plant
        id: c47c8d6e07cf
      - name: some_plant
        id: c47c8d6e069c

homeassistant:
  discovery_topic: homeassistant
`;

describe("Config", () => {
    afterEach(() => {
        jest.resetAllMocks();
        jest.resetModules();
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    describe("getConfiguration()", () => {
        it("should return the proper configuration given in the env variable", () => {
            process.env.CONFIG_FILE_LOCATION = "test";
            mockReadFileSync.mockReturnValue(exampleConfiguration);
            expect(jest.requireActual("./config").getConfiguration()).toMatchSnapshot();
            expect(mockReadFileSync).toHaveBeenCalledWith("test", "utf-8");
        });
    });
});
