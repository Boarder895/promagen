// src/lib/fixtures.ts
// Minimal fixtures that won't fight the type system.
// Named exports only.

import { MarketList } from "@/lib/markets";
import { computeMarket } from "@/lib/markets"
import type { ExchangeStatus } from "@/lib/exchangeStatus";

// Keep providers loose so MIGBoard accepts them regardless of exact shape.
export const providers20: any[] = [
  { id: "openai", name: "OpenAI" },
  { id: "stability", name: "Stability AI" },
  { id: "adobe", name: "Adobe" },
  { id: "midjourney", name: "Midjourney" },
  { id: "canva", name: "Canva" },
  { id: "ideogram", name: "Ideogram" },
  { id: "playground", name: "Playground" },
  { id: "lexica", name: "Lexica" },
  { id: "picsart", name: "Picsart" },
  { id: "fotor", name: "Fotor" },
  { id: "pixlr", name: "Pixlr" },
  { id: "deepai", name: "DeepAI" },
  { id: "novelai", name: "NovelAI" },
  { id: "openart", name: "OpenArt" },
  { id: "flux", name: "FLUX" },
  { id: "leonardo", name: "Leonardo" },
  { id: "bing", name: "Bing Image Creator" },
  { id: "i23rf", name: "123RF" },
  { id: "artistly", name: "Artistly" },
  { id: "runway", name: "Runway" },
];

// Handy fallback snapshot of the 16 exchanges (used only if someone imports it).
export const exchanges16: ExchangeStatus[] = MarketList.map((m) => computeMarket(m));


