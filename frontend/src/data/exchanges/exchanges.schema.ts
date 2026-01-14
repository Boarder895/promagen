// src/data/exchanges/exchanges.schema.ts
// ============================================================================
// EXCHANGE ZOD SCHEMAS - Runtime validation for exchange data
// ============================================================================
// Validates exchanges.catalog.json and API responses.
// Ensures type safety at runtime, especially for external data.
// ============================================================================

import { z } from 'zod';

/**
 * Hemisphere enum - geographic position indicator.
 */
export const HemisphereSchema = z.enum(['NE', 'NW', 'SE', 'SW', '']);

/**
 * Marketstack configuration for an exchange.
 * Links exchange to its benchmark index in Marketstack API.
 */
export const MarketstackConfigSchema = z.object({
  /**
   * Marketstack benchmark key for /v2/indexinfo endpoint.
   * @example "nikkei_225", "sp500", "ftse_100"
   */
  benchmark: z.string().regex(/^[a-z0-9_]+$/, 'Benchmark must be lowercase alphanumeric with underscores'),

  /**
   * Human-readable index name.
   * @example "Nikkei 225", "S&P 500", "FTSE 100"
   */
  indexName: z.string().min(1),
});

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

  // Marketstack integration (required for index data)
  marketstack: MarketstackConfigSchema,

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
 * Selected exchanges configuration.
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

// Type exports derived from schemas
export type MarketstackConfig = z.infer<typeof MarketstackConfigSchema>;
export type ExchangeFromSchema = z.infer<typeof ExchangeSchema>;
export type ExchangeCatalog = z.infer<typeof ExchangeCatalogSchema>;
export type ExchangeSelected = z.infer<typeof ExchangeSelectedSchema>;
export type IndexQuoteResponse = z.infer<typeof IndexQuoteResponseSchema>;
export type IndicesResponse = z.infer<typeof IndicesResponseSchema>;
