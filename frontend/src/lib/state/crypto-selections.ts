// src/lib/state/crypto-selections.ts
// -----------------------------------------------------------------------------
// LocalStorage-backed state for the user's crypto ribbon selections.
// Stored as a simple array of up to 5 CryptoId strings.
// -----------------------------------------------------------------------------

import type { CryptoId } from '@/types/finance-ribbon';

const STORAGE_KEY = 'promagen.cryptoSelections.v1';
const MAX_ASSETS = 5;

function sanitiseIds(ids: CryptoId[]): CryptoId[] {
  const seen = new Set<string>();
  const result: CryptoId[] = [];

  for (const raw of ids) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const upper = trimmed.toUpperCase();
    if (seen.has(upper)) continue;
    seen.add(upper);
    result.push(upper);
    if (result.length >= MAX_ASSETS) break;
  }

  return result;
}

function loadRaw(): CryptoId[] | null {
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
 * Read the stored crypto IDs for the paid ribbon.
 * Returns null when nothing has been stored yet or the data is invalid.
 */
export function loadUserCryptoSelections(): CryptoId[] | null {
  return loadRaw();
}

/**
 * Persist a new crypto selection for the ribbon.
 * The array is cleaned (trimmed, uppercased, deduped) and capped at 5 entries.
 */
export function saveUserCryptoSelections(ids: CryptoId[]): void {
  if (typeof window === 'undefined') return;

  const cleaned = sanitiseIds(ids);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
  } catch {
    // Ignore quota / private-mode errors; the UI will fall back to free selection.
  }
}
