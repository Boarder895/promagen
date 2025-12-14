// C:\Users\Proma\Projects\promagen\frontend\src\lib\state\fx-selections.ts
// -----------------------------------------------------------------------------
// LocalStorage-backed state for the user's FX ribbon pair selections.
//
// IMPORTANT:
// - No hard "5 pairs" cap.
// - We store canonical SSOT ids like "gbp-usd".
// -----------------------------------------------------------------------------

import type { FxPairId } from '@/types/finance-ribbon';

const STORAGE_KEY = 'promagen.fxSelections.v2';

function normaliseId(value: string): FxPairId {
  return value
    .trim()
    .replace(/[_\s]+/g, '-')
    .toLowerCase() as FxPairId;
}

function sanitiseIds(ids: FxPairId[]): FxPairId[] {
  const seen = new Set<string>();
  const result: FxPairId[] = [];

  for (const raw of ids) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const id = normaliseId(trimmed);
    if (!id) continue;

    if (seen.has(id)) continue;
    seen.add(id);

    result.push(id);
  }

  return result;
}

function loadRaw(): FxPairId[] | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    const ids = parsed.filter((value) => typeof value === 'string') as string[];
    const cleaned = sanitiseIds(ids as FxPairId[]);

    return cleaned.length > 0 ? cleaned : null;
  } catch {
    return null;
  }
}

/**
 * Read the stored FX pair IDs for the paid ribbon.
 * Returns null when nothing has been stored yet or the data is invalid.
 */
export function loadUserFxSelections(): FxPairId[] | null {
  return loadRaw();
}

/**
 * Persist a new FX pair selection for the ribbon.
 * The array is cleaned (trimmed, canonicalised, deduped).
 */
export function saveUserFxSelections(ids: FxPairId[]): void {
  if (typeof window === 'undefined') return;

  const cleaned = sanitiseIds(ids);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
  } catch {
    // Ignore quota / private-mode errors – the ribbon will simply fall back
    // to defaults when persistence is unavailable.
  }
}
