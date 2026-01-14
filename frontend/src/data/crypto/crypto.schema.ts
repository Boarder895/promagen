import { z } from 'zod';

const cryptoIdSchema = z
  .string()
  .min(1, 'id is required')
  .regex(/^[a-z0-9_]+$/, 'id must be lowercase and contain only a–z, 0–9, and _');

const cryptoSymbolSchema = z
  .string()
  .min(1, 'symbol is required')
  .regex(/^[A-Z0-9]{2,12}$/, 'symbol must be uppercase alphanumeric (2–12 chars)');

/**
 * One crypto asset in the master catalogue.
 *
 * This schema is intentionally permissive via `.passthrough()` so we can
 * add fields over time without breaking older builds.
 */
export const cryptoCatalogAssetSchema = z
  .object({
    id: cryptoIdSchema,
    symbol: cryptoSymbolSchema,
    name: z.string().min(1, 'name is required'),

    // Display label for ribbon (full name, e.g., "Bitcoin" instead of "BTC")
    ribbonLabel: z.string().min(1, 'ribbonLabel is required').optional(),

    // Optional convenience fields (safe to omit)
    rankHint: z
      .number()
      .int('rankHint must be an integer')
      .positive('rankHint must be positive')
      .optional(),
    isActive: z.boolean().optional(),
    isSelectableInRibbon: z.boolean().optional(),
    tags: z.array(z.string().min(1)).optional(),

    // Tooltip fields (optional)
    yearFounded: z
      .number()
      .int('yearFounded must be an integer')
      .min(2008, 'yearFounded must be 2008 or later')
      .max(2030, 'yearFounded must be 2030 or earlier')
      .optional(),

    founder: z.string().max(100, 'founder must be 100 characters or less').optional(),

    fact: z.string().max(150, 'fact must be 150 characters or less').optional(),
  })
  .passthrough();

export type CryptoCatalogAsset = z.infer<typeof cryptoCatalogAssetSchema>;

export const cryptoAssetsCatalogSchema = z
  .array(cryptoCatalogAssetSchema)
  .length(100, 'assets.catalog.json must contain exactly 100 crypto assets')
  .superRefine((items, ctx) => {
    const seenIds = new Set<string>();
    const seenSymbols = new Set<string>();
    const seenRankHints = new Set<number>();

    items.forEach((item, index) => {
      if (seenIds.has(item.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'id'],
          message: `Duplicate id "${item.id}"`,
        });
      } else {
        seenIds.add(item.id);
      }

      const sym = item.symbol.toUpperCase();
      if (seenSymbols.has(sym)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'symbol'],
          message: `Duplicate symbol "${sym}"`,
        });
      } else {
        seenSymbols.add(sym);
      }

      if (typeof item.rankHint === 'number') {
        if (item.rankHint < 1 || item.rankHint > 100) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [index, 'rankHint'],
            message: 'rankHint must be between 1 and 100',
          });
        }

        if (seenRankHints.has(item.rankHint)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [index, 'rankHint'],
            message: `Duplicate rankHint ${item.rankHint}`,
          });
        } else {
          seenRankHints.add(item.rankHint);
        }
      }
    });
  });

export type CryptoAssetsCatalog = z.infer<typeof cryptoAssetsCatalogSchema>;

export const cryptoDefaultsSchema = z
  .object({
    ids: z
      .array(cryptoIdSchema)
      .length(8, 'defaults.json must contain exactly 8 crypto ids for the ribbon'),
  })
  .passthrough()
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    value.ids.forEach((id, index) => {
      if (seen.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ids', index],
          message: `Duplicate id "${id}" in defaults`,
        });
      } else {
        seen.add(id);
      }
    });
  });

export type CryptoDefaults = z.infer<typeof cryptoDefaultsSchema>;
