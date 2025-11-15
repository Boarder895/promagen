// frontend/src/__tests__/exchange-order.test.ts
// Ensures homepage exchange ordering and rail split remain stable.

import {
  getHomepageExchanges,
  getRailsForHomepage,
  splitIds,
} from "@/lib/exchange-order";
import type { Exchange } from "@/lib/exchange-order";
import SELECTED_RAW from "@/data/exchanges.selected.json";
import CATALOG_RAW from "@/data/exchanges.catalog.json";

type SelectedJson = { ids: string[] };

function getSelectedIds(): string[] {
  const raw = SELECTED_RAW as SelectedJson | unknown;
  if (!raw || typeof raw !== "object" || !("ids" in raw)) return [];
  const ids = (raw as SelectedJson).ids;
  return Array.isArray(ids) ? ids.slice() : [];
}

type CatalogEntry = {
  id?: unknown;
  longitude?: unknown;
};

function toFinite(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function buildLongitudeIndex(): Map<string, number> {
  const map = new Map<string, number>();
  const rows = Array.isArray(CATALOG_RAW) ? (CATALOG_RAW as unknown[]) : [];
  for (const row of rows) {
    const entry = row as CatalogEntry;
    const rawId = entry.id;
    const id =
      typeof rawId === "string" ? rawId.trim() : String(rawId ?? "").trim();
    if (!id) continue;
    if (!map.has(id)) {
      map.set(id, toFinite(entry.longitude, 0));
    }
  }
  return map;
}

describe("exchange-order – homepage rails", () => {
  const EXPECTED_EAST_TO_WEST: string[] = [
    "nzx-wellington",
    "asx-sydney",
    "tse-tokyo",
    "hkex-hong-kong",
    "set-bangkok",
    "nse-mumbai",
    "dfm-dubai",
    "moex-moscow",
    "jse-johannesburg",
    "lse-london",
    "b3-sao-paulo",
    "cboe-chicago",
  ];

  it("getRailsForHomepage splits the selected exchanges into left/right rails", () => {
    const { left, right } = getRailsForHomepage();

    const leftIds = left.map((e: Exchange) => e.id);
    const rightIds = right.map((e: Exchange) => e.id);

    expect(leftIds).toEqual(EXPECTED_EAST_TO_WEST.slice(0, 6));
    expect(rightIds).toEqual(EXPECTED_EAST_TO_WEST.slice(6).reverse());
  });

  it("getHomepageExchanges returns all selected ids ordered east→west", () => {
    const selectedIds = getSelectedIds();
    const exchanges = getHomepageExchanges();

    const resultIds = exchanges.map((e) => e.id);

    // Same set of ids as the config.
    expect(new Set(resultIds)).toEqual(new Set(selectedIds));

    // Ordered strictly east→west by longitude.
    const longitudeIndex = buildLongitudeIndex();
    const longs = resultIds.map((id) => longitudeIndex.get(id) ?? 0);
    const sorted = longs.slice().sort((a, b) => b - a);

    expect(longs).toEqual(sorted);
  });

  it("splitIds mirrors the rail split logic for raw id arrays", () => {
    const selectedIds = getSelectedIds();
    const { left, right } = splitIds(selectedIds);

    expect(left.map((e) => e.id)).toEqual(selectedIds.slice(0, 6));
    expect(right.map((e) => e.id)).toEqual(selectedIds.slice(6));
  });
});
