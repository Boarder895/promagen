import { GenRequest, Provider } from "../types";

// 1x1 transparent PNG
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABfgF5n1oQ9wAAAABJRU5ErkJggg==",
  "base64"
);

export const echoProvider: Provider = {
  id: "echo",
  available: () => true,
  async generate(_req: GenRequest) {
    return tinyPng;
  },
};
