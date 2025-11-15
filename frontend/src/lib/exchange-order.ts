// frontend/src/lib/exchange-order.ts
// Exchange ordering + rail split (strict, no 'any', SSR-safe)

import RAW_EXCHANGES, {
  type Exchange as RawExchange,
} from "@/data/exchanges";
import EXCHANGES_SELECTED_RAW from "@/data/exchanges.selected.json";
import EXCHANGES_CATALOG_RAW from "@/data/exchanges.catalog.json";
import type { Exchange as UiExchange } from "@/lib/exchanges";

/**
 * Public shape used by the homepage rails.
 * This extends the base UiExchange with a guaranteed longitude,
 * which is used for both ordering and display.
 */
export type Exchange = UiExchange & {
  /** Geographic longitude in decimal degrees; east positive, west negative. */
  longitude: number;
};

export type Rails = { left: Exchange[]; right: Exchange[] };

type SelectedJson = { ids?: unknown };

type CatalogRow = {
  id?: unknown;
  longitude?: unknown;
};

/**
 * Convert a loose value into a finite number, or fall back.
 */
function toFinite(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Normalised list of selected ids from the JSON config.
 * Ignores invalid and empty entries.
 */
function getSelectedIds(raw: unknown): string[] {
  if (
    !raw ||
    typeof raw !== "object" ||
    !("ids" in (raw as Record<string, unknown>))
  ) {
    return [];
  }

  const ids = (raw as SelectedJson).ids;
  if (!Array.isArray(ids)) return [];

  return ids
    .map((id) => String(id ?? "").trim())
    .filter((id) => id.length > 0);
}

/**
 * Longitude lookup table built from exchanges.catalog.json.
 * We treat this as the single source of truth for co-ordinates.
 */
function buildLongitudeIndex(): Map<string, number> {
  const rows = Array.isArray(EXCHANGES_CATALOG_RAW)
    ? (EXCHANGES_CATALOG_RAW as unknown[])
    : [];

  const map = new Map<string, number>();

  for (const row of rows) {
    const entry = row as CatalogRow;
    const id = String(entry.id ?? "").trim();
    if (!id || map.has(id)) continue;

    map.set(id, toFinite(entry.longitude, 0));
  }

  return map;
}

let longitudeIndex: Map<string, number> | null = null;

function ensureLongitudeIndex(): Map<string, number> {
  if (!longitudeIndex) {
    longitudeIndex = buildLongitudeIndex();
  }
  return longitudeIndex;
}

/**
 * Safe longitude lookup by id, with a numeric fallback.
 */
function longitudeForId(id: string, fallback = 0): number {
  const index = ensureLongitudeIndex();
  const value = index.get(id);
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

/**
 * Map the raw catalog exchange into the richer Exchange shape.
 * We only fill the required fields; the rest stay optional on UiExchange.
 */
function mapRawToUi(raw: RawExchange): Exchange {
  const id = String(raw.id ?? "").trim();

  const nameSource =
    (raw as { name?: string }).name ??
    (raw.exchange as string | undefined) ??
    id;

  const name = String(nameSource).trim();

  const country = String(raw.country ?? "").trim();
  const countryCode = String(raw.iso2 ?? "").trim().toUpperCase();
  const city = raw.city ? String(raw.city).trim() : undefined;
  const tz = String(raw.tz ?? "").trim();

  // Prefer a numeric longitude on the raw record if present, but fall back
  // to the catalog index so we always have a stable, finite value.
  const rawLongitude = (raw as { longitude?: unknown }).longitude;
  const longitude =
    typeof rawLongitude === "number" && Number.isFinite(rawLongitude)
      ? rawLongitude
      : longitudeForId(id, 0);

  const ui: Exchange = {
    id,
    name,
    city,
    country,
    countryCode,
    tz,
    longitude,
  };

  return ui;
}

/**
 * Build a map of id → Exchange from the raw dataset.
 * Duplicate ids are ignored after the first occurrence.
 */
function buildExchangeIndex(): Map<string, Exchange> {
  const list = Array.isArray(RAW_EXCHANGES)
    ? (RAW_EXCHANGES as unknown as RawExchange[])
    : [];

  const map = new Map<string, Exchange>();

  for (const raw of list) {
    const id = String(raw.id ?? "").trim();
    if (!id || map.has(id)) continue;

    map.set(id, mapRawToUi(raw));
  }

  return map;
}

/**
 * Load the selected exchanges (by id) and resolve them to Exchange objects.
 * If an id is configured but missing from data/exchanges, we create a
 * minimal placeholder so the homepage can still render in dev.
 */
function loadSelectedExchanges(): Exchange[] {
  const selectedIds = getSelectedIds(EXCHANGES_SELECTED_RAW as unknown);
  if (!selectedIds.length) return [];

  const byId = buildExchangeIndex();
  const result: Exchange[] = [];

  for (const id of selectedIds) {
    const base = byId.get(id);

    if (base) {
      result.push(base);
    } else {
      // Fallback when an id is in selected but missing from data/exchanges.
      // This uses safe defaults and a zero longitude so ordering still works.
      const placeholder = mapRawToUi({
        id,
        city: "",
        exchange: id,
        country: "",
        iso2: "",
        tz: "Etc/UTC",
        longitude: 0,
        latitude: 0,
        hoursTemplate: "",
        holidaysRef: "",
        hemisphere: "",
      } as unknown as RawExchange);

      result.push(placeholder);
    }
  }

  if (process.env.NODE_ENV !== "production") {
    const missing = selectedIds.filter((value) => !byId.has(value));
    if (missing.length) {
      // Dev-only insight so you can keep the config honest.
      // This is intentionally noisy only in development.
      console.warn(
        "[exchange-order] Selected ids missing from data/exchanges:",
        missing,
      );
    }
  }

  return result;
}

// We treat higher positive longitudes as "further east".
function sortEastToWest(exchanges: Exchange[]): Exchange[] {
  const copy = exchanges.slice();

  copy.sort((a, b) => {
    const ax = longitudeForId(a.id, a.longitude);
    const bx = longitudeForId(b.id, b.longitude);

    // Descending: largest (most east) first, most negative (west) last.
    return bx - ax;
  });

  return copy;
}

/**
 * Returns the left/right rails for the homepage:
 * - Loads the selected exchanges
 * - Orders them east→west using longitude
 * - Splits them into two rails, with the left rail containing the
 *   more easterly half (ceil) and the right containing the more
 *   westerly half (reversed for visual symmetry).
 */
export function getRailsForHomepage(): Rails {
  const selected = loadSelectedExchanges();
  if (!selected.length) return { left: [], right: [] };

  const ordered = sortEastToWest(selected);

  const half = Math.ceil(ordered.length / 2);
  const left = ordered.slice(0, half);
  const right = ordered.slice(half).reverse();

  return { left, right };
}

/**
 * Convenience helper that returns the full east→west list of exchanges
 * for the homepage, reconstructed from the rails.
 */
export function getHomepageExchanges(): Exchange[] {
  const { left, right } = getRailsForHomepage();
  if (!left.length && !right.length) return [];
  // `ordered` was `[...left, ...rightOriginal]` before the right rail
  // was reversed for display, so undo that reversal here.
  return [...left, ...right.slice().reverse()];
}

// Legacy helper used in tests for id-only splitting.
export type ExchangeRef = { id: string };
export type ExchangeIds = { ids: string[] } | string[];

/**
 * Split a list of exchange ids into left/right "rails" purely by position.
 * This keeps tests loosely coupled to the full Exchange shape.
 */
export function splitIds(
  exchanges: ExchangeIds,
): { left: ExchangeRef[]; right: ExchangeRef[] } {
  const ids = Array.isArray(exchanges)
    ? exchanges.slice()
    : (exchanges?.ids ?? []).slice();

  const half = Math.ceil(ids.length / 2);

  return {
    left: ids.slice(0, half).map((id): ExchangeRef => ({ id })),
    right: ids.slice(half).map((id): ExchangeRef => ({ id })),
  };
}
