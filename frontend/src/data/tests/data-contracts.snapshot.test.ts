// src/data/tests/data-contracts.snapshot.test.ts
// ────────────────────────────────────────────────────────────────────────────
// Internal data contract snapshot tests.
//
// Purpose:
//   The SSOT JSON files in src/data/ are the foundation every API route
//   builds on. If a key is renamed or removed in fx-pairs.json, the
//   /api/fx route silently breaks. These snapshot tests detect that drift
//   the moment it happens — before it reaches production.
//
// How it works:
//   extractKeyStructure() replaces values with their typeof string and
//   recursively processes nested objects/arrays. The resulting skeleton
//   is snapshot-tested. Any added/removed/renamed key triggers a diff
//   that must be explicitly approved with `pnpm test -- -u`.
//
// Group: data (runs in the `test:data` Jest project)
//
// Existing features preserved: Yes — new file, nothing modified.
// ────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from '@jest/globals';

// ─── extractKeyStructure (self-contained — no cross-project imports) ─────────

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function extractKeyStructure(value: unknown, depth = 0): unknown {
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

// ─── SSOT data imports ───────────────────────────────────────────────────────

import fxPairs from '@/data/fx/fx-pairs.json';
import exchangesCatalog from '@/data/exchanges/exchanges.catalog.json';
import providersJson from '@/data/providers/providers.json';

// ─── FX Pairs ────────────────────────────────────────────────────────────────

describe('Internal contract: fx-pairs.json', () => {
  it('first entry structure matches snapshot', () => {
    expect(Array.isArray(fxPairs)).toBe(true);
    expect(fxPairs.length).toBeGreaterThan(0);

    const structure = extractKeyStructure(fxPairs[0]);
    expect(structure).toMatchSnapshot();
  });

  it('every entry has the required keys', () => {
    const requiredKeys = ['id', 'base', 'quote', 'label'] as const;

    for (const pair of fxPairs) {
      for (const key of requiredKeys) {
        expect(pair).toHaveProperty(key);
        expect(typeof (pair as Record<string, unknown>)[key]).toBe('string');
      }
    }
  });
});

// ─── Exchanges Catalog ───────────────────────────────────────────────────────

describe('Internal contract: exchanges.catalog.json', () => {
  it('first entry structure matches snapshot', () => {
    expect(Array.isArray(exchangesCatalog)).toBe(true);
    expect(exchangesCatalog.length).toBeGreaterThan(0);

    const structure = extractKeyStructure(exchangesCatalog[0]);
    expect(structure).toMatchSnapshot();
  });

  it('every entry has the required keys', () => {
    const requiredKeys = ['id', 'city', 'exchange', 'country', 'iso2', 'tz'] as const;

    for (const ex of exchangesCatalog) {
      for (const key of requiredKeys) {
        expect(ex).toHaveProperty(key);
        expect(typeof (ex as Record<string, unknown>)[key]).toBe('string');
      }
    }
  });
});

// ─── Providers Catalog ───────────────────────────────────────────────────────

describe('Internal contract: providers.json', () => {
  it('first entry structure matches snapshot', () => {
    const providers = Array.isArray(providersJson) ? providersJson : [];
    expect(providers.length).toBeGreaterThan(0);

    const structure = extractKeyStructure(providers[0]);
    expect(structure).toMatchSnapshot();
  });

  it('every entry has the required keys', () => {
    const providers = Array.isArray(providersJson) ? providersJson : [];
    const requiredKeys = ['id', 'name', 'website'] as const;

    for (const p of providers) {
      for (const key of requiredKeys) {
        expect(p).toHaveProperty(key);
        expect(typeof (p as Record<string, unknown>)[key]).toBe('string');
      }
    }
  });
});

// ─── FX SSOT function: getDefaultFxPairsWithIndexForTier ─────────────────────

import { getDefaultFxPairsWithIndexForTier } from '@/data/fx';

describe('Internal contract: getDefaultFxPairsWithIndexForTier()', () => {
  it('free tier returns ordered SSOT pairs with expected shape', () => {
    const pairs = getDefaultFxPairsWithIndexForTier('free');

    expect(Array.isArray(pairs)).toBe(true);
    expect(pairs.length).toBeGreaterThan(0);

    const structure = extractKeyStructure(pairs[0]);
    expect(structure).toMatchSnapshot();
  });

  it('every pair has a unique id', () => {
    const pairs = getDefaultFxPairsWithIndexForTier('free');
    const ids = pairs.map((p) => p.id);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(ids.length);
  });
});
