// frontend/src/lib/exchange-order.ts
// Exchange ordering + rail split (strict, zero 'any', SSR-safe)

import EXCHANGES_SELECTED_RAW from "@/data/exchanges.selected.json";
import EXCHANGES_CATALOG_RAW from "@/data/exchanges.catalog.json";

export type Exchange = {
  id: string;
  name: string;
  country?: string;
  longitude: number;
};

export type Rails = { left: Exchange[]; right: Exchange[] };

type SelectedJson = { ids?: unknown };

type CatalogEntry = {
  id?: unknown;
  exchange?: unknown;
  country?: unknown;
  longitude?: unknown;
};

function toFinite(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function isSelectedJson(value: unknown): value is SelectedJson {
  return !!value && typeof value === "object" && "ids" in (value as Record<string, unknown>);
}

function toSelectedIds(raw: unknown): string[] {
  if (!isSelectedJson(raw)) return [];
  const { ids } = raw;
  if (!Array.isArray(ids)) return [];
  return ids.map((id) => String(id)).filter((id) => id.length > 0);
}

function toCatalogEntry(obj: unknown): CatalogEntry | null {
  if (!obj || typeof obj !== "object") return null;
  return obj as CatalogEntry;
}

// Map the selected ids to catalog entries, then into Exchange objects.
function loadSelectedExchanges(): Exchange[] {
  const selectedIds = toSelectedIds(EXCHANGES_SELECTED_RAW as unknown);
  if (!selectedIds.length) return [];

  const catalogArray = Array.isArray(EXCHANGES_CATALOG_RAW)
    ? (EXCHANGES_CATALOG_RAW as unknown[])
    : [];

  const byId = new Map<string, CatalogEntry>();

  for (const raw of catalogArray) {
    const entry = toCatalogEntry(raw);
    if (!entry || entry.id == null) continue;
    byId.set(String(entry.id), entry);
  }

  const result: Exchange[] = [];

  for (const id of selectedIds) {
    const entry = byId.get(id);
    if (!entry) continue;

    const nameSource = entry.exchange ?? entry.id ?? id;
    const name = String(nameSource);

    result.push({
      id,
      name,
      country: typeof entry.country === "string" ? entry.country : undefined,
      longitude: toFinite(entry.longitude, 0),
    });
  }

  return result;
}

// Sort most easterly → most westerly using longitude.
// We treat higher positive longitudes as "further east".
function sortEastToWest(exchanges: Exchange[]): Exchange[] {
  const copy = exchanges.slice();
  copy.sort((a, b) => {
    const ax = toFinite(a.longitude, 0);
    const bx = toFinite(b.longitude, 0);
    // Descending: largest (most east) first, most negative (west) last.
    return bx - ax;
  });
  return copy;
}

// Public helper for the homepage rails.
// Uses exchanges.selected.json as the single source of truth.
export function getRailsForHomepage(): Rails {
  const selected = loadSelectedExchanges();
  if (!selected.length) return { left: [], right: [] };

  const ordered = sortEastToWest(selected);

  const half = Math.ceil(ordered.length / 2);
  const left = ordered.slice(0, half);
  const right = ordered.slice(half).reverse();

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
