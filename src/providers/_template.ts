import type { ProviderAdapter } from "./types";

/**
 * How to use:
 * 1) Copy this file to src/providers/<yourname>.ts
 * 2) Replace "yourname" below.
 * 3) Implement chat() and/or image() — whichever the provider supports.
 * 4) Add it to registry.ts
 * 5) Add enum value to Prisma if you store keys.
 */
export const yourNameAdapter: ProviderAdapter = {
  name: "yourname",

  // Omit this entire function if the provider doesn't have chat/completions.
  async chat({ messages, model, temperature, apiKey }) {
    // Call the provider's chat/completions endpoint here.
    // Return plain text.
    throw new Error("chat not implemented for 'yourname'");
  },

  // Omit this entire function if the provider doesn't have image generation.
  async image({ prompt, apiKey, model, size }) {
    // Call the provider's image generation endpoint here.
    // Return a { url } — can be https or a data URL.
    throw new Error("image not implemented for 'yourname'");
  },
};
