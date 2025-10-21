export type Provider = {
  id: string;
  name: string;
  tagline: string;
  website: string;
  affiliateUrl?: string;
};

export const PROVIDERS: Provider[] = [
  { id:"openai", name:"OpenAI DALL·E / GPT-Image", tagline:"Blueprints of imagination, priced by attention.", website:"https://openai.com/dall-e" },
  { id:"stability", name:"Stability AI / Stable Diffusion", tagline:"Diffusing light and liquidity across every canvas.", website:"https://stability.ai" },
  { id:"leonardo", name:"Leonardo AI", tagline:"High-speed creativity with studio-grade control.", website:"https://leonardo.ai" },
  { id:"i23rf", name:"I23RF AI Generator", tagline:"Stock-grade imagery meets real-world licensing.", website:"https://www.123rf.com/ai" },
  { id:"artistly", name:"Artistly", tagline:"One-sentence prompts that trade like ideas.", website:"https://artistly.ai" },
  { id:"firefly", name:"Adobe Firefly", tagline:"Enterprise-calm, gallery-bold.", website:"https://www.adobe.com/products/firefly.html" },
  { id:"midjourney", name:"Midjourney", tagline:"Where creative futures are traded in dreams.", website:"https://www.midjourney.com" },
  { id:"canva", name:"Canva Text-to-Image", tagline:"Design flows like liquidity.", website:"https://www.canva.com" },
  { id:"bing", name:"Bing Image Creator", tagline:"Daily boosts, instant vibes.", website:"https://www.bing.com/images/create" },
  { id:"ideogram", name:"Ideogram", tagline:"Typography that rallies like a market open.", website:"https://ideogram.ai" },
  { id:"picsart", name:"Picsart", tagline:"Social-native creativity with production polish.", website:"https://picsart.com" },
  { id:"fotor", name:"Fotor", tagline:"Quick wins, polished finishes.", website:"https://www.fotor.com" },
  { id:"nightcafe", name:"NightCafe", tagline:"Community heat, gallery shine.", website:"https://creator.nightcafe.studio" },
  { id:"playground", name:"Playground AI", tagline:"Fast riffs, pro controls.", website:"https://playgroundai.com" },
  { id:"pixlr", name:"Pixlr", tagline:"Lightweight edits at market speed.", website:"https://pixlr.com" },
  { id:"deepai", name:"DeepAI", tagline:"Developer-simple, instantly integrated.", website:"https://deepai.org" },
  { id:"novelai", name:"NovelAI", tagline:"Stories and scenes with a novelist’s cadence.", website:"https://novelai.net" },
  { id:"lexica", name:"Lexica", tagline:"Search, sample, and sprint to a look.", website:"https://lexica.art" },
  { id:"openart", name:"OpenArt", tagline:"Discover, remix, and run across models.", website:"https://openart.ai" },
  { id:"flux", name:"Flux Schnell", tagline:"Latency low, ideas high-frequency.", website:"https://flux.dev" }
];
