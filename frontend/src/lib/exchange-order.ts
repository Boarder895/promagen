// frontend/src/lib/exchange-order.ts
// Exchange ordering + rail split (strict, zero 'any', SSR-safe)

import EXCHANGES_RAW from "@/data/exchanges.selected.json";

export type Exchange = {
  id: string;
  name: string;
  country?: string;
  longitude: number;
};

export type Rails = { left: Exchange[]; right: Exchange[] };

function toFinite(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toExchange(obj: unknown): Exchange | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  if (!("id" in o) || !("name" in o)) return null;
  return {
    id: String(o.id),
    name: String(o.name),
    country: typeof o.country === "string" ? o.country : undefined,
    longitude: toFinite(o.longitude, 0),
  };
}

function loadSelected(): Exchange[] {
  const raw: unknown = EXCHANGES_RAW as unknown;
  const arr: unknown[] = Array.isArray(raw)
    ? raw
    : typeof raw === "object" && raw !== null && Array.isArray((raw as { items?: unknown[] }).items)
    ? (raw as { items: unknown[] }).items
    : [];

  const out: Exchange[] = [];
  for (const item of arr) {
    const ex = toExchange(item);
    if (ex) out.push(ex);
  }
  out.sort((a, b) => a.longitude - b.longitude);
  return out;
}

export function getRailsForHomepage(): Rails {
  const sorted = loadSelected();
  const half = Math.ceil(sorted.length / 2);
  const left = sorted.slice(0, half);
  const right = sorted.slice(half).slice().reverse();
  return { left, right };
}

// Legacy helper for tests (strict, no 'any')
export type ExchangeRef = { id: string };
export type ExchangeIds = { ids: string[] } | string[];

export function splitIds(exchanges: ExchangeIds): { left: ExchangeRef[]; right: ExchangeRef[] } {
  const ids = Array.isArray(exchanges) ? exchanges.slice() : (exchanges?.ids ?? []).slice();
  const half = Math.ceil(ids.length / 2);
  return {
    left: ids.slice(0, half).map((id): ExchangeRef => ({ id })),
    right: ids.slice(half).map((id): ExchangeRef => ({ id })),
  };
}
