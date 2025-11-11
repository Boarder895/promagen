//
// Stage 1: Provider types + stub data (no APIs yet).
//
export type Provider = {
  id: string;            // stable id, e.g., "openai"
  name: string;          // display label
  slug: string;          // used in routes like /providers/[slug]
  affiliateUrl?: string; // external link (Stage 1 click-out)
  logoRef?: string;      // path or key to a logo asset
  score?: number;        // leaderboard value (stub in Stage 1)
  apiEnabled?: boolean;  // Stage 3 toggles to true for in-app API runs
};

export const providers: Provider[] = [
  { id: "midjourney", name: "Midjourney", slug: "midjourney", affiliateUrl: "", score: 0 },
  { id: "openai", name: "OpenAI (DALL?E)", slug: "openai", affiliateUrl: "", score: 0 },
  { id: "stability", name: "Stability (SDXL)", slug: "stability", affiliateUrl: "", score: 0 },
  { id: "adobe", name: "Adobe Firefly", slug: "adobe", affiliateUrl: "", score: 0 },
  { id: "ideogram", name: "Ideogram", slug: "ideogram", affiliateUrl: "", score: 0 },
  { id: "leonardo", name: "Leonardo", slug: "leonardo", affiliateUrl: "", score: 0 },
  { id: "playground", name: "Playground", slug: "playground", affiliateUrl: "", score: 0 },
  { id: "canva", name: "Canva", slug: "canva", affiliateUrl: "", score: 0 },
  { id: "bing", name: "Microsoft Designer", slug: "bing", affiliateUrl: "", score: 0 },
  { id: "nightcafe", name: "NightCafe", slug: "nightcafe", affiliateUrl: "", score: 0 },
  { id: "lexica", name: "Lexica", slug: "lexica", affiliateUrl: "", score: 0 },
  { id: "openart", name: "OpenArt", slug: "openart", affiliateUrl: "", score: 0 },
  { id: "recraft", name: "Recraft", slug: "recraft", affiliateUrl: "", score: 0 },
  { id: "runwayml", name: "RunwayML", slug: "runwayml", affiliateUrl: "", score: 0 },
  { id: "picsart", name: "Picsart", slug: "picsart", affiliateUrl: "", score: 0 },
  { id: "deepai", name: "DeepAI", slug: "deepai", affiliateUrl: "", score: 0 },
  { id: "novelai", name: "NovelAI", slug: "novelai", affiliateUrl: "", score: 0 },
  { id: "flux", name: "FLUX", slug: "flux", affiliateUrl: "", score: 0 },
  { id: "starryai", name: "StarryAI", slug: "starryai", affiliateUrl: "", score: 0 },
  { id: "wombo", name: "WOMBO", slug: "wombo", affiliateUrl: "", score: 0 }
];

// Convenience helpers
export type ProviderId = Provider["id"];

export function getProvider(idOrSlug: string): Provider | undefined {
  return providers.find(p => p.id === idOrSlug || p.slug === idOrSlug);
}

export function sortByScore(list: Provider[] = providers): Provider[] {
  return [...list].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}



