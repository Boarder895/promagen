// Named exports only.
export type ProviderId =
  | 'openai' | 'stability' | 'leonardo' | 'i23rf' | 'artistly'
  | 'adobe' | 'midjourney' | 'canva' | 'bing' | 'ideogram'
  | 'picsart' | 'fotor' | 'nightcafe' | 'playground' | 'pixlr'
  | 'deepai' | 'novelai' | 'lexica' | 'openart' | 'flux';

export type AffiliateInfo = {
  id: ProviderId;
  name: string;
  url: string | null;          // put real affiliate URLs as you approve them
  label: string;               // short CTA label
  requiresDisclosure: boolean; // UK â€œAffiliate linkâ€ badge
};

// Canonical 20-provider list (kept in sync with project memory).
export const AFFILIATES: Record<ProviderId, AffiliateInfo> = {
  openai:    { id: 'openai',    name: 'OpenAI DALLÂ·E/GPT-Image', url: null, label: 'Learn more', requiresDisclosure: false },
  stability: { id: 'stability', name: 'Stability AI',            url: null, label: 'Free trial', requiresDisclosure: false },
  leonardo:  { id: 'leonardo',  name: 'Leonardo AI',             url: null, label: 'Affiliate',  requiresDisclosure: true  },
  i23rf:     { id: 'i23rf',     name: 'I23RF',                   url: null, label: 'Affiliate',  requiresDisclosure: true  },
  artistly:  { id: 'artistly',  name: 'Artistly',                url: null, label: 'Affiliate',  requiresDisclosure: true  },
  adobe:     { id: 'adobe',     name: 'Adobe Firefly',           url: null, label: 'Try',        requiresDisclosure: false },
  midjourney:{ id: 'midjourney',name: 'Midjourney',              url: null, label: 'Guide',      requiresDisclosure: false },
  canva:     { id: 'canva',     name: 'Canva Text-to-Image',     url: null, label: 'Affiliate',  requiresDisclosure: true  },
  bing:      { id: 'bing',      name: 'Bing Image Creator',      url: null, label: 'Try',        requiresDisclosure: false },
  ideogram:  { id: 'ideogram',  name: 'Ideogram',                url: null, label: 'Affiliate',  requiresDisclosure: true  },
  picsart:   { id: 'picsart',   name: 'Picsart',                 url: null, label: 'Affiliate',  requiresDisclosure: true  },
  fotor:     { id: 'fotor',     name: 'Fotor',                   url: null, label: 'Affiliate',  requiresDisclosure: true  },
  nightcafe: { id: 'nightcafe', name: 'NightCafe',               url: null, label: 'Affiliate',  requiresDisclosure: true  },
  playground:{ id: 'playground',name: 'Playground AI',           url: null, label: 'Affiliate',  requiresDisclosure: true  },
  pixlr:     { id: 'pixlr',     name: 'Pixlr',                   url: null, label: 'Affiliate',  requiresDisclosure: true  },
  deepai:    { id: 'deepai',    name: 'DeepAI',                  url: null, label: 'Docs',       requiresDisclosure: false },
  novelai:   { id: 'novelai',   name: 'NovelAI',                 url: null, label: 'Pricing',    requiresDisclosure: false },
  lexica:    { id: 'lexica',    name: 'Lexica',                  url: null, label: 'Pricing',    requiresDisclosure: false },
  openart:   { id: 'openart',   name: 'OpenArt',                 url: null, label: 'Affiliate',  requiresDisclosure: true  },
  flux:      { id: 'flux',      name: 'Flux Schnell',            url: null, label: 'Docs',       requiresDisclosure: false },
};

export const PROVIDER_IDS = Object.keys(AFFILIATES) as ProviderId[];

export const PROVIDER_MAP: Record<ProviderId, { name: string; url: string | null }> =
  Object.fromEntries(PROVIDER_IDS.map((id) => [id, { name: AFFILIATES[id].name, url: AFFILIATES[id].url }])) as Record<
    ProviderId,
    { name: string; url: string | null }
  >;






