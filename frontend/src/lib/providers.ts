// Canonical provider registry — named exports only.

export const PROVIDER_IDS = [
  "openai","stability","leonardo","i23rf","artistly","adobe","midjourney","canva","bing",
  "ideogram","picsart","fotor","nightcafe","playground","pixlr","deepai","novelai","lexica",
  "openart","flux",
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export type Provider = {
  id: ProviderId;
  name: string;
  hasApi: boolean;           // true = programmatic API; false = UI-only
  affiliate?: number | string; // optional; some UI reads this
};

const LIST: Provider[] = [
  { id: "openai",     name: "OpenAI DALL·E/GPT-Image", hasApi: true },
  { id: "stability",  name: "Stability AI",            hasApi: true },
  { id: "leonardo",   name: "Leonardo AI",             hasApi: true },
  { id: "i23rf",      name: "I23RF",                   hasApi: false },
  { id: "artistly",   name: "Artistly",                hasApi: false },
  { id: "adobe",      name: "Adobe Firefly",           hasApi: false },
  { id: "midjourney", name: "Midjourney",              hasApi: false },
  { id: "canva",      name: "Canva Text-to-Image",     hasApi: false },
  { id: "bing",       name: "Bing Image Creator",      hasApi: false },
  { id: "ideogram",   name: "Ideogram",                hasApi: false },
  { id: "picsart",    name: "Picsart",                 hasApi: false },
  { id: "fotor",      name: "Fotor",                   hasApi: false },
  { id: "nightcafe",  name: "NightCafe",               hasApi: false },
  { id: "playground", name: "Playground AI",           hasApi: false },
  { id: "pixlr",      name: "Pixlr",                   hasApi: false },
  { id: "deepai",     name: "DeepAI",                  hasApi: true },
  { id: "novelai",    name: "NovelAI",                 hasApi: true },
  { id: "lexica",     name: "Lexica",                  hasApi: true },
  { id: "openart",    name: "OpenArt",                 hasApi: false },
  { id: "flux",       name: "Flux Schnell",            hasApi: true },
];

// Primary constant stays immutable (truth source)
export const PROVIDERS = LIST as ReadonlyArray<Provider>;

// State-friendly helpers return mutable copies (for React setState)
export function getProvidersSync(): Provider[] {
  return [...PROVIDERS];
}
export async function getProviders(): Promise<Provider[]> {
  return [...PROVIDERS];
}
export const providers: Provider[] = [...PROVIDERS];

// Helpers
export const PROVIDER_MAP: Readonly<Record<ProviderId, Provider>> = Object.freeze(
  Object.fromEntries(PROVIDERS.map((p) => [p.id, p])) as Record<ProviderId, Provider>
);
export function getProvidersWithApi(): Provider[] {
  return PROVIDERS.filter((p) => p.hasApi).map((p) => ({ ...p }));
}



