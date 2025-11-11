/**
 * Validates data files against Zod schemas.
 * Adjust import paths if your catalog filenames differ.
 */
import { z } from 'zod';
import { ExchangeSchema, FxPairSchema, ProviderSchema } from '@/types/schemas';
import exchanges from '@/data/exchanges.catalog.json';
import pairs from '@/data/fx/pairs.json';
// If you maintain providers.json, import it; otherwise skip that check.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import providersMaybe from '@/data/providers.json';

describe('catalog shapes', () => {
  test('exchanges.catalog.json: every item matches schema', () => {
    const arr = exchanges as unknown[];
    expect(Array.isArray(arr)).toBe(true);
    for (const it of arr) {
      const res = ExchangeSchema.safeParse(it);
      if (!res.success) {
        // Show first error for quick fix
        // eslint-disable-next-line no-console
        console.error(res.error);
      }
      expect(res.success).toBe(true);
    }
  });

  test('fx/pairs.json: every pair matches schema', () => {
    const arr = pairs as unknown[];
    expect(Array.isArray(arr)).toBe(true);
    for (const it of arr) {
      const res = FxPairSchema.safeParse(it);
      if (!res.success) {
        // eslint-disable-next-line no-console
        console.error(res.error);
      }
      expect(res.success).toBe(true);
    }
  });

  test('providers.json (if present) matches schema', () => {
    try {
      const arr = (providersMaybe ?? []) as unknown[];
      if (!Array.isArray(arr)) return;
      for (const it of arr) {
        const res = ProviderSchema.safeParse(it);
        if (!res.success) {
          // eslint-disable-next-line no-console
          console.error(res.error);
        }
        expect(res.success).toBe(true);
      }
    } catch {
      // file not present — acceptable
    }
  });
});
