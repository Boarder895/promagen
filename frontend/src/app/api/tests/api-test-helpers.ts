// src/app/api/tests/api-test-helpers.ts
// ────────────────────────────────────────────────────────────────────────────
// Shared type guards and utilities for API route tests.
//
// Import these instead of duplicating type checks in every test file.
//
// Existing features preserved: Yes — new file, nothing modified.
// ────────────────────────────────────────────────────────────────────────────

import type { FxApiResponse } from '@/types/finance-ribbon';

// ─── Type guards ─────────────────────────────────────────────────────────────

/**
 * Type guard: is the value a plain JS object (not null, not array)?
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Type guard: does the value conform to the FxApiResponse contract?
 * Validates meta envelope + each quote in the data array.
 */
export function isFxApiResponse(x: unknown): x is FxApiResponse {
  if (!isPlainObject(x)) return false;

  const meta = x.meta;
  const data = x.data;

  if (!isPlainObject(meta)) return false;
  if (!Array.isArray(data)) return false;

  if (typeof meta.buildId !== 'string') return false;
  if (typeof meta.mode !== 'string') return false;
  if (typeof meta.sourceProvider !== 'string') return false;
  if (typeof meta.asOf !== 'string') return false;

  for (const item of data) {
    if (!isPlainObject(item)) return false;
    if (typeof item.id !== 'string') return false;
    if (typeof item.base !== 'string') return false;
    if (typeof item.quote !== 'string') return false;
    if (typeof item.label !== 'string') return false;
    if (typeof item.category !== 'string') return false;

    const price = item.price;
    const change = item.change;
    const changePct = item.changePct;

    const priceOk =
      price === null || (typeof price === 'number' && Number.isFinite(price));
    const changeOk =
      change === null || (typeof change === 'number' && Number.isFinite(change));
    const changePctOk =
      changePct === null || (typeof changePct === 'number' && Number.isFinite(changePct));

    if (!priceOk || !changeOk || !changePctOk) return false;
  }

  return true;
}

// ─── Contract snapshot utility ───────────────────────────────────────────────

/**
 * Recursively extracts just the keys (structure) from an object.
 * Values are replaced with their `typeof` string. Arrays show the
 * shape of the first element (if present).
 *
 * Used by contract snapshot tests to detect shape drift without
 * being sensitive to volatile values like timestamps or counts.
 *
 * Example:
 *   extractKeyStructure({ ok: true, asOf: "2026-01-01", exchanges: [{ id: "lse" }] })
 *   → { asOf: "string", exchanges: [{ id: "string" }], ok: "boolean" }
 */
export function extractKeyStructure(value: unknown, depth = 0): unknown {
  if (depth > 5) return '<<max depth>>';

  if (Array.isArray(value)) {
    if (value.length === 0) return '<<empty array>>';
    return [extractKeyStructure(value[0], depth + 1)];
  }

  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      result[key] = extractKeyStructure(value[key], depth + 1);
    }
    return result;
  }

  if (value === null) return 'null';
  return typeof value;
}
