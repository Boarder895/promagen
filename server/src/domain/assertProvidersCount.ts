export const ALL_PROVIDERS = [
  { id: "openai",    name: "OpenAI" },
  { id: "stability", name: "Stability AI" },
  { id: "leonardo",  name: "Leonardo AI" },
  { id: "artistly",  name: "Artistly" },
  { id: "firefly",   name: "Adobe Firefly" },
  { id: "ideogram",  name: "Ideogram" },
  { id: "midjourney",name: "MidJourney" },
  { id: "bing",      name: "Bing Image Creator" },
  { id: "canva",     name: "Canva Text-to-Image" },
  { id: "nightcafe", name: "NightCafe" },
  { id: "playground",name: "Playground AI" },
  { id: "pixlr",     name: "Pixlr" },
  { id: "fotor",     name: "Fotor" },
  { id: "openart",   name: "OpenArt" },
  { id: "deepai",    name: "DeepAI" },
  { id: "lexica",    name: "Lexica" },
  { id: "novelai",   name: "NovelAI" },
  { id: "recraft",   name: "Recraft" },
  { id: "i23rf",     name: "I23RF" },  // ← display name “I23RF”
  { id: "flux",      name: "Flux Schnell" }
] as const;

export type ProviderId = typeof ALL_PROVIDERS[number]["id"];

