// Promagen Top 20 Platforms — single source of truth (ordered by popularity)
export type Platform = {
  id: string; // stable ID for your system (slug-like)
  name: string; // display name
  rank: number; // 1 = most popular
  kind: 'api' | 'affiliate' | 'ui_only'; // how we integrate today
  markers: string[]; // UI badges/emojis, e.g. ["??"], ["??"], ["??"]
  notes?: string; // short hint for tooltips
  website?: string; // optional link (for future affiliate deep-links)
};

export const PLATFORMS_20: Platform[] = [
  {
    id: 'canva',
    name: 'Canva Text-to-Image',
    rank: 1,
    kind: 'affiliate',
    markers: ['??'],
    notes: 'Affiliate-first',
  },
  {
    id: 'openai',
    name: 'OpenAI (DALL·E / GPT-Image)',
    rank: 2,
    kind: 'api',
    markers: ['??'],
    notes: 'API-ready later',
  },
  {
    id: 'midjourney',
    name: 'Midjourney',
    rank: 3,
    kind: 'ui_only',
    markers: ['??'],
    notes: 'Discord UI only',
  },
  {
    id: 'stability',
    name: 'Stability AI (Stable Diffusion)',
    rank: 4,
    kind: 'api',
    markers: ['??'],
    notes: 'API-ready later',
  },
  { id: 'adobe-firefly', name: 'Adobe Firefly', rank: 5, kind: 'affiliate', markers: ['??'] },
  {
    id: 'bing',
    name: 'Bing Image Creator',
    rank: 6,
    kind: 'ui_only',
    markers: ['??'],
    notes: 'Microsoft ecosystem',
  },
  {
    id: 'leonardo',
    name: 'Leonardo AI',
    rank: 7,
    kind: 'api',
    markers: ['??', '??'],
    notes: 'API + affiliate',
  },
  { id: 'pixlr', name: 'Pixlr', rank: 8, kind: 'affiliate', markers: ['??'] },
  { id: 'nightcafe', name: 'NightCafe', rank: 9, kind: 'affiliate', markers: ['??'] },
  { id: 'fotor', name: 'Fotor', rank: 10, kind: 'affiliate', markers: ['??'] },
  { id: 'deepai', name: 'DeepAI', rank: 11, kind: 'api', markers: ['??'] },
  {
    id: 'picsart',
    name: 'Picsart',
    rank: 12,
    kind: 'api',
    markers: ['??', '??'],
    notes: 'API + affiliate',
  },
  { id: 'ideogram', name: 'Ideogram', rank: 13, kind: 'affiliate', markers: ['??'] },
  {
    id: 'bluewillow',
    name: 'BlueWillow',
    rank: 14,
    kind: 'ui_only',
    markers: ['??'],
    notes: 'Discord UI',
  },
  { id: 'openart', name: 'OpenArt', rank: 15, kind: 'affiliate', markers: ['??'] },
  { id: 'playground', name: 'Playground AI', rank: 16, kind: 'ui_only', markers: ['??'] },
  { id: 'novelai', name: 'NovelAI', rank: 17, kind: 'api', markers: ['??', '??'] },
  {
    id: 'flux-schnell',
    name: 'Flux Schnell',
    rank: 18,
    kind: 'api',
    markers: ['??'],
    notes: 'New model family',
  },
  { id: 'artistly', name: 'Artistly', rank: 19, kind: 'affiliate', markers: ['??'] },
  {
    id: 'krea',
    name: 'Krea',
    rank: 20,
    kind: 'affiliate',
    markers: ['??'],
    notes: 'Artist programme',
  },
];

// convenience maps
export const PLATFORMS_BY_ID = Object.fromEntries(PLATFORMS_20.map((p) => [p.id, p]));







