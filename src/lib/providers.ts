// src/lib/providers.ts — 20-provider registry
export const PROVIDERS = [
  "openai","stability","leonardo","deepai","google_imagen","lexica","novelai",
  "edenai","runware","hive","recraft","artistly","canva","adobe_firefly",
  "midjourney","bing_image_creator","nightcafe","playground","pixlr","fotor"
] as const;

export type Provider = typeof PROVIDERS[number];

export const PROVIDER_LABELS: Record<Provider,string> = {
  openai: "OpenAI",
  stability: "Stability",
  leonardo: "Leonardo",
  deepai: "DeepAI",
  google_imagen: "Google Imagen",
  lexica: "Lexica",
  novelai: "NovelAI",
  edenai: "EdenAI",
  runware: "Runware",
  hive: "Hive",
  recraft: "Recraft",
  artistly: "Artistly",
  canva: "Canva",
  adobe_firefly: "Adobe Firefly",
  midjourney: "Midjourney",
  bing_image_creator: "Bing Image Creator",
  nightcafe: "NightCafe",
  playground: "Playground AI",
  pixlr: "Pixlr",
  fotor: "Fotor"
};


