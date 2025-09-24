export const ALL_PROVIDERS = [
  { id: "openai",     name: "OpenAI" },
  { id: "stability",  name: "Stability AI" },
  { id: "leonardo",   name: "Leonardo AI" },
  { id: "artistly",   name: "Artistly" },
  { id: "firefly",    name: "Adobe Firefly" },
  { id: "ideogram",   name: "Ideogram" },
  { id: "midjourney", name: "MidJourney" },
  { id: "bing",       name: "Bing Image Creator" },
  { id: "canva",      name: "Canva Text-to-Image" },
  { id: "nightcafe",  name: "NightCafe" },
  { id: "playground", name: "Playground AI" },
  { id: "pixlr",      name: "Pixlr" },
  { id: "fotor",      name: "Fotor" },
  { id: "openart",    name: "OpenArt" },
  { id: "deepai",     name: "DeepAI" },
  { id: "lexica",     name: "Lexica" },
  { id: "novelai",    name: "NovelAI" },
  { id: "recraft",    name: "Recraft" },
  { id: "123rf",      name: "123RF" }, // 👈 brand is "123RF"
  { id: "flux",       name: "Flux Schnell" },
] as const;

export type ProviderId = (typeof ALL_PROVIDERS)[number]["id"];

export type ProviderKey = ProviderId;

export const PROVIDERS = ALL_PROVIDERS.map((p) => ({
  key: p.id as ProviderKey,
  name: p.name,
}));

export function buildAffiliateUrl(
  provider: { key: ProviderKey; name: string },
  opts: { prompt?: string; meta?: Record<string, unknown> }
): string {
  const base = affiliateMap[provider.key] ?? affiliateMap["openai"];
  const params = new URLSearchParams();
  if (opts.prompt) params.set("prompt", opts.prompt);
  if (opts.meta) params.set("meta", JSON.stringify(opts.meta));
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

const affiliateMap: Record<ProviderKey, string> = {
  openai:     process.env.NEXT_PUBLIC_AFFILIATE_OPENAI     ?? "https://labs.openai.com/",
  stability:  process.env.NEXT_PUBLIC_AFFILIATE_SD         ?? "https://stability.ai/",
  leonardo:   process.env.NEXT_PUBLIC_AFFILIATE_LEONARDO   ?? "https://app.leonardo.ai/",
  artistly:   "https://www.artistly.ai/",
  firefly:    "https://www.adobe.com/products/firefly.html",
  ideogram:   "https://ideogram.ai/",
  midjourney: process.env.NEXT_PUBLIC_AFFILIATE_MIDJOURNEY ?? "https://www.midjourney.com/home",
  bing:       "https://www.bing.com/images/create",
  canva:      "https://www.canva.com/apps/text-to-image",
  nightcafe:  "https://creator.nightcafe.studio/",
  playground: "https://playgroundai.com/",
  pixlr:      "https://pixlr.com/",
  fotor:      "https://www.fotor.com/",
  openart:    "https://openart.ai/",
  deepai:     "https://deepai.org/",
  lexica:     "https://lexica.art/",
  novelai:    "https://novelai.net/",
  recraft:    "https://www.recraft.ai/",
  "123rf":    "https://www.123rf.com/",
  flux:       "https://flux-ai.org/",
};
