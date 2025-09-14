export const PROVIDERS = [
  "openai",
  "stability",
  "leonardo",
  "artistly",
  "firefly",
  "ideogram",
  "midjourney",
  "bing",
  "canva",
  "nightcafe",
  "playground",
  "pixlr",
  "fotor",
  "openart",
  "deepai",
  "lexica",
  "novelai",
  "recraft",
  "i23rf",  // ← renamed from "123rf"
  "flux"
] as const;

export type ProviderId = typeof PROVIDERS[number];
