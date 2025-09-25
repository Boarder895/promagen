// src/lib/providers.ts

export type Provider = {
  id: string;          // lowercase slug (e.g., "openai")
  name: string;        // display name
  api?: boolean;       // has public API integration
  affiliate?: boolean; // affiliate programme
  website?: string;
};

// --- Canonical provider list (20) ---
const LIST: Provider[] = [
  { id: "openai",        name: "OpenAI",               api: true,  affiliate: false, website: "https://openai.com" },
  { id: "stability",     name: "Stability AI",         api: true,  affiliate: true,  website: "https://platform.stability.ai" },
  { id: "leonardo",      name: "Leonardo",             api: true,  affiliate: true,  website: "https://leonardo.ai" },
  { id: "i23rf",         name: "I23RF",                api: false, affiliate: true,  website: "https://www.123rf.com" },
  { id: "artistly",      name: "Artistly",             api: false, affiliate: true,  website: "https://artistly.ai" },
  { id: "adobe-firefly", name: "Adobe Firefly",        api: false, affiliate: true,  website: "https://www.adobe.com/products/firefly.html" },
  { id: "midjourney",    name: "Midjourney",           api: false, affiliate: false, website: "https://www.midjourney.com" },
  { id: "canva",         name: "Canva",                api: false, affiliate: true,  website: "https://www.canva.com" },
  { id: "bing",          name: "Bing Image Creator",   api: false, affiliate: false, website: "https://www.bing.com/create" },
  { id: "ideogram",      name: "Ideogram",             api: false, affiliate: true,  website: "https://ideogram.ai" },
  { id: "picsart",       name: "Picsart",              api: true,  affiliate: true,  website: "https://picsart.com" },
  { id: "fotor",         name: "Fotor",                api: false, affiliate: true,  website: "https://www.fotor.com" },
  { id: "nightcafe",     name: "NightCafe",            api: false, affiliate: true,  website: "https://creator.nightcafe.studio" },
  { id: "playground",    name: "Playground AI",        api: false, affiliate: true,  website: "https://playground.com" },
  { id: "pixlr",         name: "Pixlr",                api: false, affiliate: true,  website: "https://pixlr.com" },
  { id: "deepai",        name: "DeepAI",               api: true,  affiliate: false, website: "https://deepai.org" },
  { id: "novelai",       name: "NovelAI",              api: true,  affiliate: true,  website: "https://novelai.net" },
  { id: "lexica",        name: "Lexica",               api: true,  affiliate: true,  website: "https://lexica.art" },
  { id: "openart",       name: "OpenArt",              api: false, affiliate: true,  website: "https://openart.ai" },
  { id: "flux-schnell",  name: "Flux Schnell",         api: true,  affiliate: false, website: "https://blackforestlabs.ai" },
];

// ---- Exports so every import style compiles ----
export const ALL_PROVIDERS: Provider[] = LIST;
export const PROVIDERS: Provider[] = LIST;

// Keys & helpers (no const assertion)
export type ProviderKey = Provider["id"];
export const PROVIDER_IDS: ProviderKey[] = LIST.map((p) => p.id);
export const PROVIDER_MAP: Record<ProviderKey, Provider> =
  Object.fromEntries(LIST.map((p) => [p.id, p])) as Record<ProviderKey, Provider>;

export function getById(id: ProviderKey): Provider | undefined {
  return PROVIDER_MAP[id];
}

export function byKind(kind: "all" | "api" | "manual" = "all"): Provider[] {
  if (kind === "api") return LIST.filter((p) => !!p.api);
  if (kind === "manual") return LIST.filter((p) => !p.api);
  return LIST;
}

/** Append query params to a URL. */
export function withQuery(
  base: string,
  params: Record<string, string | number | boolean | null | undefined>
): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    usp.set(k, String(v));
  }
  const q = usp.toString();
  return q ? (base.includes("?") ? `${base}&${q}` : `${base}?${q}`) : base;
}

export default LIST;
export type { Provider as PromagenProvider };






