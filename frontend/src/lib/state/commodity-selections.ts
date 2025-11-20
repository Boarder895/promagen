// src/lib/state/commodity-selections.ts
// -----------------------------------------------------------------------------
// LocalStorage-backed state for the user's commodities ribbon selections.
// Stored as a simple array of up to 7 CommodityId strings.
// -----------------------------------------------------------------------------

import type { CommodityId } from '@/types/finance-ribbon';

const STORAGE_KEY = 'promagen.commoditySelections.v1';
const MAX_COMMODITIES = 7;

function sanitiseIds(ids: CommodityId[]): CommodityId[] {
  const seen = new Set<string>();
  const result: CommodityId[] = [];

  for (const raw of ids) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    result.push(lower);
    if (result.length >= MAX_COMMODITIES) break;
  }

  return result;
}

function loadRaw(): CommodityId[] | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    const ids = parsed.filter((value) => typeof value === 'string') as string[];
    const cleaned = sanitiseIds(ids);

    return cleaned.length > 0 ? cleaned : null;
  } catch {
    return null;
  }
}

/**
 * Read the stored commodity IDs for the paid ribbon.
 * Returns null when nothing has been stored yet or the data is invalid.
 */
export function loadUserCommoditySelections(): CommodityId[] | null {
  return loadRaw();
}

/**
 * Persist a new commodities selection for the ribbon.
 * The array is cleaned (trimmed, deduped) and capped at 7 entries.
 */
export function saveUserCommoditySelections(ids: CommodityId[]): void {
  if (typeof window === 'undefined') return;

  const cleaned = sanitiseIds(ids);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
  } catch {
    // Ignore quota / private-mode errors; the UI will fall back to free selection.
  }
}
