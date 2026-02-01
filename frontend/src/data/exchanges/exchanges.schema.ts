// src/data/exchanges/exchanges.schema.ts
// ============================================================================
// EXCHANGE ZOD SCHEMAS - Runtime validation for exchange data
// ============================================================================
// Validates exchanges.catalog.json and API responses.
// Ensures type safety at runtime, especially for external data.
//
// UPDATED v2.0.0 (30 Jan 2026):
// - Multi-index support: MarketstackConfigSchema now validates availableIndices
// - Backward compatible with legacy single benchmark format
// ============================================================================

import { z } from 'zod';

/**
 * Hemisphere enum - geographic position indicator.
 */
export const HemisphereSchema = z.enum(['NE', 'NW', 'SE', 'SW', '']);

/**
 * Single index option schema.
 * Represents one available index for an exchange.
 */
export const IndexOptionSchema = z.object({
  /**
   * Marketstack benchmark key for /v2/indexinfo endpoint.
   * @example "nikkei_225", "de40", "us500"
   */
  benchmark: z.string().regex(/^[a-z0-9_-]+$/, 'Benchmark must be lowercase alphanumeric with underscores/hyphens'),

  /**
   * Human-readable index name.
   * @example "Nikkei 225", "DAX 40", "S&P 500"
   */
  indexName: z.string().min(1),
});

/**
 * Marketstack configuration schema for an exchange.
 * Links exchange to its benchmark indices in Marketstack API.
 * Supports multiple indices per exchange (Pro Promagen feature).
 */
export const MarketstackConfigSchema = z.object({
  /**
   * Default benchmark key used when no user preference is set.
   * Always the first/primary index for this exchange.
   * @example "nikkei_225", "de40", "us500"
   */
  defaultBenchmark: z.string().regex(/^[a-z0-9_-]+$/, 'Benchmark must be lowercase alphanumeric with underscores/hyphens'),

  /**
   * Default index display name matching defaultBenchmark.
   * @example "Nikkei 225", "DAX 40", "S&P 500"
   */
  defaultIndexName: z.string().min(1),

  /**
   * All available indices for this exchange.
   * Pro users can choose which index to display.
   * Array must contain at least one index (the default).
   */
  availableIndices: z.array(IndexOptionSchema).min(1, 'At least one index must be available'),
});

/**
 * Legacy Marketstack config schema for backward compatibility.
 * Used for data that hasn't been migrated to multi-index format.
 * @deprecated Use MarketstackConfigSchema for new data
 */
export const LegacyMarketstackConfigSchema = z.object({
  benchmark: z.string().regex(/^[a-z0-9_-]+$/, 'Benchmark must be lowercase alphanumeric with underscores/hyphens'),
  indexName: z.string().min(1),
});

/**
 * Union schema that accepts both new and legacy formats.
 * Transforms legacy format to new format for consistency.
 */
export const MarketstackConfigUnionSchema = z.union([
  MarketstackConfigSchema,
  LegacyMarketstackConfigSchema.transform((legacy) => ({
    defaultBenchmark: legacy.benchmark,
    defaultIndexName: legacy.indexName,
    availableIndices: [{ benchmark: legacy.benchmark, indexName: legacy.indexName }],
  })),
]);

/**
 * Full Exchange schema matching exchanges.catalog.json structure.
 */
export const ExchangeSchema = z.object({
  // Required fields
  id: z.string().regex(/^[a-z0-9-]+$/, 'ID must be lowercase kebab-case'),
  city: z.string().min(1),
  exchange: z.string().min(1),
  country: z.string().min(1),
  iso2: z.string().length(2).toUpperCase(),
  tz: z.string().min(1),
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
  hoursTemplate: z.string().min(1),
  holidaysRef: z.string().min(1),
  hemisphere: HemisphereSchema,

  // Marketstack integration (supports both new and legacy format)
  marketstack: MarketstackConfigUnionSchema,

  // Hover color for UI (required - unique per exchange)
  hoverColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be valid hex color'),

  // Optional fields
  ribbonLabel: z.string().optional(),
  name: z.string().optional(),
  countryCode: z.string().optional(),
  offsetMinutes: z.number().nullable().optional(),
  region: z.enum(['APAC', 'EMEA', 'AMERICAS']).optional(),
  tradingCurrency: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  micCode: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * Array of exchanges (full catalog).
 */
export const ExchangeCatalogSchema = z.array(ExchangeSchema);

/**
 * Selected exchanges configuration with index preferences.
 * Pro Promagen: each selection can include a benchmark preference.
 */
export const ExchangeSelectionSchema = z.object({
  /**
   * Exchange ID.
   */
  exchangeId: z.string().regex(/^[a-z0-9-]+$/),

  /**
   * User's chosen benchmark for this exchange.
   * If not set, uses exchange's defaultBenchmark.
   */
  benchmark: z.string().regex(/^[a-z0-9_-]+$/).optional(),
});

/**
 * Array of exchange selections with index preferences.
 */
export const ExchangeSelectionsSchema = z.array(ExchangeSelectionSchema);

/**
 * Legacy selected exchanges configuration (IDs only).
 * @deprecated Use ExchangeSelectionsSchema for new code
 */
export const ExchangeSelectedSchema = z.object({
  ids: z.array(z.string().regex(/^[a-z0-9-]+$/)),
});

/**
 * Index quote from Marketstack API response.
 */
export const IndexQuoteResponseSchema = z.object({
  benchmark: z.string(),
  price: z.string().transform((v) => parseFloat(v)),
  price_change_day: z.string().transform((v) => parseFloat(v)),
  percentage_day: z.string().transform((v) => parseFloat(v.replace('%', ''))),
  date: z.string(),
});

/**
 * Batch index quotes response from gateway.
 */
export const IndicesResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      benchmark: z.string(),
      indexName: z.string(),
      price: z.number(),
      change: z.number(),
      percentChange: z.number(),
      asOf: z.string(),
    })
  ),
  meta: z
    .object({
      cached: z.boolean().optional(),
      ttl: z.number().optional(),
      source: z.string().optional(),
    })
    .optional(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type IndexOption = z.infer<typeof IndexOptionSchema>;
export type MarketstackConfig = z.infer<typeof MarketstackConfigSchema>;
export type ExchangeFromSchema = z.infer<typeof ExchangeSchema>;
export type ExchangeCatalog = z.infer<typeof ExchangeCatalogSchema>;
export type ExchangeSelection = z.infer<typeof ExchangeSelectionSchema>;
export type ExchangeSelections = z.infer<typeof ExchangeSelectionsSchema>;
export type ExchangeSelected = z.infer<typeof ExchangeSelectedSchema>;
export type IndexQuoteResponse = z.infer<typeof IndexQuoteResponseSchema>;
export type IndicesResponse = z.infer<typeof IndicesResponseSchema>;
