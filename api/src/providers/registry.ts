// BACKEND · EXPRESS
// File: C:\Users\Martin Yarnold\Projects\promagen\api\src\providers\registry.ts

export type ProviderId =
  | "openai" | "stability" | "leonardo" | "i23rf" | "artistly"
  | "adobe_firefly" | "midjourney" | "canva" | "bing" | "ideogram"
  | "picsart" | "fotor" | "nightcafe" | "playground" | "pixlr"
  | "deepai" | "novelai" | "lexica" | "openart" | "flux_schnell";

export type IntegrationKind = "api" | "ui-only";

export interface ProviderMeta {
  id: ProviderId;
  name: string;
  integration: IntegrationKind;
  affiliateEnabled: boolean;
  website: string;
  notes?: string;
}

export const PROVIDERS: ProviderMeta[] = [
  { id: "openai", name: "OpenAI (GPT-Image)", integration: "api", affiliateEnabled: false, website: "https://api.openai.com" },
  { id: "stability", name: "Stability AI", integration: "api", affiliateEnabled: false, website: "https://api.stability.ai" },
  { id: "leonardo", name: "Leonardo AI", integration: "api", affiliateEnabled: true, website: "https://cloud.leonardo.ai" },

  { id: "i23rf", name: "I23RF", integration: "ui-only", affiliateEnabled: false, website: "https://www.123rf.com" },
  { id: "artistly", name: "Artistly", integration: "ui-only", affiliateEnabled: true, website: "https://artistly.ai" },
  { id: "adobe_firefly", name: "Adobe Firefly", integration: "ui-only", affiliateEnabled: true, website: "https://firefly.adobe.com" },
  { id: "midjourney", name: "Midjourney", integration: "ui-only", affiliateEnabled: false, website: "https://www.midjourney.com" },
  { id: "canva", name: "Canva", integration: "ui-only", affiliateEnabled: true, website: "https://www.canva.com" },
  { id: "bing", name: "Bing Image Creator", integration: "ui-only", affiliateEnabled: false, website: "https://www.bing.com/create" },
  { id: "ideogram", name: "Ideogram", integration: "ui-only", affiliateEnabled: true, website: "https://ideogram.ai" },
  { id: "picsart", name: "Picsart", integration: "ui-only", affiliateEnabled: true, website: "https://picsart.com" },
  { id: "fotor", name: "Fotor", integration: "ui-only", affiliateEnabled: true, website: "https://www.fotor.com" },
  { id: "nightcafe", name: "NightCafe", integration: "ui-only", affiliateEnabled: true, website: "https://creator.nightcafe.studio" },
  { id: "playground", name: "Playground AI", integration: "ui-only", affiliateEnabled: false, website: "https://playground.com" },
  { id: "pixlr", name: "Pixlr", integration: "ui-only", affiliateEnabled: true, website: "https://pixlr.com" },
  { id: "deepai", name: "DeepAI", integration: "ui-only", affiliateEnabled: false, website: "https://deepai.org" },
  { id: "novelai", name: "NovelAI", integration: "ui-only", affiliateEnabled: false, website: "https://novelai.net" },
  { id: "lexica", name: "Lexica", integration: "ui-only", affiliateEnabled: true, website: "https://lexica.art" },
  { id: "openart", name: "OpenArt", integration: "ui-only", affiliateEnabled: true, website: "https://openart.ai" },
  { id: "flux_schnell", name: "Flux Schnell", integration: "ui-only", affiliateEnabled: false, website: "https://blackforestlabs.ai" },
];
