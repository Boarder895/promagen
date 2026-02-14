// Named exports only. No default exports.
//
// Canonical 20-provider list for Promagen (frontend is the source of truth).

export type ProviderId =
  | "openai"        // DALL·E 3 / GPT-Image
  | "stability"     // Stability AI
  | "leonardo"      // Leonardo AI
  | "i23rf"         // I23RF (renamed from 123RF)
  | "artistly"      // Artistly
  | "adobe"         // Adobe Firefly
  | "midjourney"    // Midjourney
  | "canva"         // Canva Text-to-Image
  | "bing"          // Bing Image Creator
  | "ideogram"      // Ideogram
  | "picsart"       // Picsart
  | "fotor"         // Fotor
  | "nightcafe"     // NightCafe
  | "playground"    // Playground AI
  | "pixlr"         // Pixlr
  | "deepai"        // DeepAI
  | "novelai"       // NovelAI
  | "lexica"        // Lexica
  | "openart"       // OpenArt
  | "flux";         // Flux Schnell

export type ProviderKind = "api" | "ui";

export interface ProviderMeta {
  id: ProviderId;
  name: string;
  kind: ProviderKind;
  notes?: string;
  supportsAutomation: boolean; // true if "api"
  uiOnly: boolean;             // true if "ui"
  hasAffiliate?: boolean;
}

// Canonical list (order stable)
export const PROVIDERS: ProviderMeta[] = [
  { id: "openai",     name: "DALL·E 3 / GPT-Image", kind: "api", supportsAutomation: true,  uiOnly: false, hasAffiliate: false },
  { id: "stability",  name: "Stability AI",            kind: "api", supportsAutomation: true,  uiOnly: false, hasAffiliate: false },
  { id: "leonardo",   name: "Leonardo AI",             kind: "api", supportsAutomation: true,  uiOnly: false, hasAffiliate: true  },
  { id: "i23rf",      name: "I23RF",                   kind: "ui",  supportsAutomation: false, uiOnly: true,  hasAffiliate: true  },
  { id: "artistly",   name: "Artistly",                kind: "ui",  supportsAutomation: false, uiOnly: true,  hasAffiliate: true  },
  { id: "adobe",      name: "Adobe Firefly",           kind: "ui",  supportsAutomation: false, uiOnly: true,  hasAffiliate: true  },
  { id: "midjourney", name: "Midjourney",              kind: "ui",  supportsAutomation: false, uiOnly: true,  hasAffiliate: false },
  { id: "canva",      name: "Canva Text-to-Image",     kind: "ui",  supportsAutomation: false, uiOnly: true,  hasAffiliate: true  },
  { id: "bing",       name: "Bing Image Creator",      kind: "ui",  supportsAutomation: false, uiOnly: true,  hasAffiliate: false },
  { id: "ideogram",   name: "Ideogram",                kind: "ui",  supportsAutomation: false, uiOnly: true,  hasAffiliate: true  },
  { id: "picsart",    name: "Picsart",                 kind: "ui",  supportsAutomation: false, uiOnly: true,  hasAffiliate: true  },
  { id: "fotor",      name: "Fotor",                   kind: "ui",  supportsAutomation: false, uiOnly: true,  hasAffiliate: true  },
  { id: "nightcafe",  name: "NightCafe",               kind: "ui",  supportsAutomation: false, uiOnly: true,  hasAffiliate: true  },
  { id: "playground", name: "Playground AI",           kind: "ui",  supportsAutomation: false, uiOnly: true,  hasAffiliate: false },
  { id: "pixlr",      name: "Pixlr",                   kind: "ui",  supportsAutomation: false, uiOnly: true,  hasAffiliate: true  },
  { id: "deepai",     name: "DeepAI",                  kind: "api", supportsAutomation: true,  uiOnly: false, hasAffiliate: false },
  { id: "novelai",    name: "NovelAI",                 kind: "api", supportsAutomation: true,  uiOnly: false, hasAffiliate: false },
  { id: "lexica",     name: "Lexica",                  kind: "api", supportsAutomation: true,  uiOnly: false, hasAffiliate: true  },
  { id: "openart",    name: "OpenArt",                 kind: "ui",  supportsAutomation: false, uiOnly: true,  hasAffiliate: true  },
  { id: "flux",       name: "Flux Schnell",            kind: "api", supportsAutomation: true,  uiOnly: false, hasAffiliate: false },
];

export const PROVIDER_IDS: ProviderId[] = PROVIDERS.map(p => p.id);

export const PROVIDERS_BY_ID: Record<ProviderId, ProviderMeta> = PROVIDERS.reduce(
  (acc, p) => { acc[p.id] = p; return acc; },
  {} as Record<ProviderId, ProviderMeta>
);

// Primary list used by UI
export const openAIProviders = PROVIDERS;

// Helpers
export const getProvider = (id: ProviderId): ProviderMeta | undefined => PROVIDERS_BY_ID[id];
export const API_PROVIDERS: ProviderMeta[] = PROVIDERS.filter(p => p.kind === "api");
export const UI_ONLY_PROVIDERS: ProviderMeta[] = PROVIDERS.filter(p => p.kind === "ui");









