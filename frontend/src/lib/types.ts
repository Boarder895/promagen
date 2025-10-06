// src/lib/types.ts
// Provider types live here. Exchange types are re-exported from ./markets.
// Named exports only.

export type ProviderId =
  | "openai" | "stability" | "adobe" | "midjourney" | "canva" | "ideogram"
  | "playground" | "lexica" | "picsart" | "fotor" | "pixlr" | "deepai"
  | "novelai" | "openart" | "flux" | "leonardo" | "bing" | "i23rf"
  | "artistly" | "runway";

export type Provider = { id: ProviderId; name: string };

// Keep this loose enough for MIGBoard
export type TrendDeltas = { up: number; down: number };

export type ProviderScore = {
  id: ProviderId;
  score?: number;          // overall score (optional)
  points?: number;         // raw points (optional)
  deltas?: TrendDeltas;    // 24h/7d etc. deltas (optional)
};

// Canonical exchange types â€” re-export only (do NOT redeclare here)
export type { Market as Exchange, MarketId as ExchangeId } from "./markets";

