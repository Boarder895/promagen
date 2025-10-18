﻿// Promagen Top 20 Platforms â€” single source of truth (ordered by popularity)
export type Platform = {
  id: string; // stable ID for your system (slug-like)
  name: string; // display name
  rank: number; // 1 = most popular
  kind: 'api' | 'affiliate' | 'ui_only'; // how we integrate today
  markers: string[]; // UI badges/emojis, e.g. ["âš™ï¸"], ["ðŸ’¸"], ["ðŸŒ"]
  notes?: string; // short hint for tooltips
  website?: string; // optional link (for future affiliate deep-links)
};

export const PLATFORMS_20: Platform[] = [
  {
    id: 'canva',
    name: 'Canva Text-to-Image',
    rank: 1,
    kind: 'affiliate',
    markers: ['ðŸ’¸'],
    notes: 'Affiliate-first',
  },
  {
    id: 'openai',
    name: 'OpenAI (DALLÂ·E / GPT-Image)',
    rank: 2,
    kind: 'api',
    markers: ['âš™ï¸'],
    notes: 'API-ready later',
  },
  {
    id: 'midjourney',
    name: 'Midjourney',
    rank: 3,
    kind: 'ui_only',
    markers: ['ðŸŒ'],
    notes: 'Discord UI only',
  },
  {
    id: 'stability',
    name: 'Stability AI (Stable Diffusion)',
    rank: 4,
    kind: 'api',
    markers: ['âš™ï¸'],
    notes: 'API-ready later',
  },
  { id: 'adobe-firefly', name: 'Adobe Firefly', rank: 5, kind: 'affiliate', markers: ['ðŸ’¸'] },
  {
    id: 'bing',
    name: 'Bing Image Creator',
    rank: 6,
    kind: 'ui_only',
    markers: ['ðŸŒ'],
    notes: 'Microsoft ecosystem',
  },
  {
    id: 'leonardo',
    name: 'Leonardo AI',
    rank: 7,
    kind: 'api',
    markers: ['âš™ï¸', 'ðŸ’¸'],
    notes: 'API + affiliate',
  },
  { id: 'pixlr', name: 'Pixlr', rank: 8, kind: 'affiliate', markers: ['ðŸ’¸'] },
  { id: 'nightcafe', name: 'NightCafe', rank: 9, kind: 'affiliate', markers: ['ðŸ’¸'] },
  { id: 'fotor', name: 'Fotor', rank: 10, kind: 'affiliate', markers: ['ðŸ’¸'] },
  { id: 'deepai', name: 'DeepAI', rank: 11, kind: 'api', markers: ['âš™ï¸'] },
  {
    id: 'picsart',
    name: 'Picsart',
    rank: 12,
    kind: 'api',
    markers: ['âš™ï¸', 'ðŸ’¸'],
    notes: 'API + affiliate',
  },
  { id: 'ideogram', name: 'Ideogram', rank: 13, kind: 'affiliate', markers: ['ðŸ’¸'] },
  {
    id: 'bluewillow',
    name: 'BlueWillow',
    rank: 14,
    kind: 'ui_only',
    markers: ['ðŸŒ'],
    notes: 'Discord UI',
  },
  { id: 'openart', name: 'OpenArt', rank: 15, kind: 'affiliate', markers: ['ðŸ’¸'] },
  { id: 'playground', name: 'Playground AI', rank: 16, kind: 'ui_only', markers: ['ðŸŒ'] },
  { id: 'novelai', name: 'NovelAI', rank: 17, kind: 'api', markers: ['âš™ï¸', 'ðŸ’¸'] },
  {
    id: 'flux-schnell',
    name: 'Flux Schnell',
    rank: 18,
    kind: 'api',
    markers: ['âš™ï¸'],
    notes: 'New model family',
  },
  { id: 'artistly', name: 'Artistly', rank: 19, kind: 'affiliate', markers: ['ðŸ’¸'] },
  {
    id: 'krea',
    name: 'Krea',
    rank: 20,
    kind: 'affiliate',
    markers: ['ðŸ’¸'],
    notes: 'Artist programme',
  },
];

// convenience maps
export const PLATFORMS_BY_ID = Object.fromEntries(PLATFORMS_20.map((p) => [p.id, p]));




