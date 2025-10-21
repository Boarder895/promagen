// frontend/src/app/providers/top20.ts

// Strict data contract for a provider tile (no `any`).
export type ProviderTile = {
  id: string;                 // stable id, e.g. "openai"
  name: string;               // display name
  url: string;                // canonical site url
  affiliateUrl?: string | null; // optional affiliate link
  tagline: string;            // short description
  score: number;              // 0..100 for your leaderboard
  trend: 'Up' | 'Down' | 'Flat';
};

// IMPORTANT: This must be an ARRAY of ProviderTile.
// Paste your 20 rows here (from your Excel / JSON). Two examples shown; keep your existing 20.
export const TOP20_PROVIDERS: ProviderTile[] = [
  {
    id: 'openai',
    name: 'OpenAI DALL·E / GPT-Image',
    url: 'https://openai.com',
    affiliateUrl: null,
    tagline: 'Blueprints of imagination, picked by attention.',
    score: 88,
    trend: 'Flat',
  },
  {
    id: 'stability',
    name: 'Stability AI / Stable Diffusion',
    url: 'https://stability.ai',
    affiliateUrl: null,
    tagline: 'Diffusing light and focus every camera.',
    score: 86,
    trend: 'Up',
  },

  // 👉 Replace/add the rest of your 18 providers below, keeping the same shape.
];
