export type ProviderItem = {
  id: string;
  name: string;
  url: string;
  affiliateUrl: string | null;
  tagline: string | null;
};

export const TOP20_PROVIDERS: ProviderItem[] = [
  { id: `openai`, name: `OpenAI DALL·E / GPT‑Image`, url: `https://openai.com/dall-e`, affiliateUrl: null, tagline: `Blueprints of imagination, priced by attention.` },
  { id: `stability`, name: `Stability AI / Stable Diffusion`, url: `https://stability.ai`, affiliateUrl: null, tagline: `Diffusing light and liquidity across every canvas.` },
  { id: `leonardo`, name: `Leonardo AI`, url: `https://leonardo.ai`, affiliateUrl: null, tagline: `High-speed creativity with studio-grade control.` },
  { id: `i23rf`, name: `I23RF AI Generator`, url: `https://www.123rf.com/ai`, affiliateUrl: null, tagline: `Stock‑grade imagery meets real‑world licensing.` },
  { id: `artistly`, name: `Artistly`, url: `https://artistly.ai`, affiliateUrl: null, tagline: `One‑sentence prompts that trade like ideas.` },
  { id: `adobe`, name: `Adobe Firefly`, url: `https://www.adobe.com/sensei/generative-ai/firefly.html`, affiliateUrl: null, tagline: `Enterprise‑calm, gallery‑bold.` },
  { id: `midjourney`, name: `Midjourney`, url: `https://www.midjourney.com`, affiliateUrl: null, tagline: `Where creative futures are traded in dreams.` },
  { id: `canva`, name: `Canva Text‑to‑Image`, url: `https://www.canva.com`, affiliateUrl: null, tagline: `Design flows like liquidity.` },
  { id: `bing`, name: `Bing Image Creator`, url: `https://www.bing.com/create`, affiliateUrl: null, tagline: `Daily boosts, instant vibes.` },
  { id: `ideogram`, name: `Ideogram`, url: `https://ideogram.ai`, affiliateUrl: null, tagline: `Typography that rallies like a market open.` },
  { id: `picsart`, name: `Picsart`, url: `https://picsart.com`, affiliateUrl: null, tagline: `Social‑native creativity with production polish.` },
  { id: `fotor`, name: `Fotor`, url: `https://www.fotor.com`, affiliateUrl: null, tagline: `Quick wins, polished finishes.` },
  { id: `nightcafe`, name: `NightCafe`, url: `https://creator.nightcafe.studio`, affiliateUrl: null, tagline: `Community heat, gallery shine.` },
  { id: `playground`, name: `Playground AI`, url: `https://playground.com`, affiliateUrl: null, tagline: `Fast riffs, pro controls.` },
  { id: `pixlr`, name: `Pixlr`, url: `https://pixlr.com`, affiliateUrl: null, tagline: `Lightweight edits at market speed.` },
  { id: `deepai`, name: `DeepAI`, url: `https://deepai.org`, affiliateUrl: null, tagline: `Developer-simple, instantly integrated.` },
  { id: `novelai`, name: `NovelAI`, url: `https://novelai.net`, affiliateUrl: null, tagline: `Stories and scenes with a novelist’s cadence.` },
  { id: `lexica`, name: `Lexica`, url: `https://lexica.art`, affiliateUrl: null, tagline: `Search, sample, and sprint to a look.` },
  { id: `openart`, name: `OpenArt`, url: `https://openart.ai`, affiliateUrl: null, tagline: `Discover, remix, and run across models.` },
  { id: `flux`, name: `Flux Schnell`, url: `https://blackforestlabs.ai/flux`, affiliateUrl: null, tagline: `Latency low, ideas high‑frequency.` }
];
