// src/lib/providers.ts
// Promagen canonical provider registry — FRONTEND is the source of truth.
// Named exports only.

export const PROVIDER_IDS = [
  'openai', 'stability', 'leonardo', 'i23rf', 'artistly',
  'adobe', 'midjourney', 'canva', 'bing', 'ideogram',
  'picsart', 'fotor', 'nightcafe', 'playground', 'pixlr',
  'deepai', 'novelai', 'lexica', 'openart', 'flux',
] as const;

export type ProviderId = typeof PROVIDER_IDS[number];

export interface Provider {
  id: ProviderId;
  name: string;

  // Core booleans used across UI
  hasApi: boolean;
  /** Some UIs check this; keep optional to avoid breaking older code. */
  supportsAutomation?: boolean;

  // Affiliate/partner
  /** true if we have any affiliate arrangement for this provider */
  hasAffiliate?: boolean;
  /** actual affiliate URL or code (nullable) */
  affiliate?: string | null;

  // Optional info
  website?: string;
  notes?: string;
}

// Back-compat: some components still import ProviderMeta
export type ProviderMeta = Provider;

export const PROVIDERS: Readonly<Provider[]> = [
  { id: 'openai',     name: 'OpenAI DALL·E/GPT-Image', hasApi: true,  supportsAutomation: true,  hasAffiliate: false, affiliate: null, website: 'https://openai.com' },
  { id: 'stability',  name: 'Stability AI',            hasApi: true,  supportsAutomation: true,  hasAffiliate: false, affiliate: null, website: 'https://stability.ai' },
  { id: 'leonardo',   name: 'Leonardo AI',             hasApi: true,  supportsAutomation: true,  hasAffiliate: true,  affiliate: null, website: 'https://leonardo.ai' },
  { id: 'i23rf',      name: 'I23RF',                   hasApi: false, supportsAutomation: false, hasAffiliate: false, affiliate: null, website: 'https://www.123rf.com' },
  { id: 'artistly',   name: 'Artistly',                hasApi: false, supportsAutomation: false, hasAffiliate: true,  affiliate: null, website: 'https://artistly.ai' },
  { id: 'adobe',      name: 'Adobe Firefly',           hasApi: false, supportsAutomation: false, hasAffiliate: true,  affiliate: null, website: 'https://www.adobe.com' },
  { id: 'midjourney', name: 'Midjourney',              hasApi: false, supportsAutomation: false, hasAffiliate: false, affiliate: null, website: 'https://www.midjourney.com' },
  { id: 'canva',      name: 'Canva Text-to-Image',     hasApi: false, supportsAutomation: false, hasAffiliate: true,  affiliate: null, website: 'https://www.canva.com' },
  { id: 'bing',       name: 'Bing Image Creator',      hasApi: false, supportsAutomation: false, hasAffiliate: false, affiliate: null, website: 'https://www.bing.com' },
  { id: 'ideogram',   name: 'Ideogram',                hasApi: false, supportsAutomation: false, hasAffiliate: true,  affiliate: null, website: 'https://ideogram.ai' },
  { id: 'picsart',    name: 'Picsart',                 hasApi: false, supportsAutomation: false, hasAffiliate: true,  affiliate: null, website: 'https://picsart.com' },
  { id: 'fotor',      name: 'Fotor',                   hasApi: false, supportsAutomation: false, hasAffiliate: true,  affiliate: null, website: 'https://www.fotor.com' },
  { id: 'nightcafe',  name: 'NightCafe',               hasApi: false, supportsAutomation: false, hasAffiliate: true,  affiliate: null, website: 'https://nightcafe.studio' },
  { id: 'playground', name: 'Playground AI',           hasApi: false, supportsAutomation: false, hasAffiliate: true,  affiliate: null, website: 'https://playground.com' },
  { id: 'pixlr',      name: 'Pixlr',                   hasApi: false, supportsAutomation: false, hasAffiliate: true,  affiliate: null, website: 'https://pixlr.com' },
  { id: 'deepai',     name: 'DeepAI',                  hasApi: true,  supportsAutomation: true,  hasAffiliate: false, affiliate: null, website: 'https://deepai.org' },
  { id: 'novelai',    name: 'NovelAI',                 hasApi: true,  supportsAutomation: true,  hasAffiliate: false, affiliate: null, website: 'https://novelai.net' },
  { id: 'lexica',     name: 'Lexica',                  hasApi: true,  supportsAutomation: true,  hasAffiliate: false, affiliate: null, website: 'https://lexica.art' },
  { id: 'openart',    name: 'OpenArt',                 hasApi: false, supportsAutomation: false, hasAffiliate: true,  affiliate: null, website: 'https://openart.ai' },
  { id: 'flux',       name: 'Flux Schnell',            hasApi: false, supportsAutomation: false, hasAffiliate: false, affiliate: null, website: 'https://blackforestlabs.ai' },
] as const;

// Fast lookups
const PROVIDER_MAP: ReadonlyMap<ProviderId, Provider> = new Map(
  PROVIDERS.map((p) => [p.id, p])
);

// Sync API (no Promises)
export const getProviders = (): Provider[] => [...PROVIDERS];
export const getProviderById = (id: ProviderId): Provider | undefined => PROVIDER_MAP.get(id);
export const providersWithApi = (): Provider[] => PROVIDERS.filter((p) => p.hasApi);
export const assertProviderId = (id: string): id is ProviderId =>
  (PROVIDER_IDS as readonly string[]).includes(id);







