import { z } from 'zod';

/**
 * Allowed asset classes for providers.
 * This is the canonical enum used across the API brain.
 */
export const ProviderKindEnum = z.enum([
  'fx',
  'commodities',
  'crypto',
  'equities',
  'holidays',
  'time',
  'weather',
]);

/**
 * High-level provider lifecycle status.
 * This is intentionally a bit broader than the current data so new providers
 * can be added without changing the schema.
 */
const ProviderStatusEnum = z.enum(['active', 'planned', 'experimental', 'deprecated', 'disabled']);

/**
 * Where authentication material is sent on the HTTP request.
 * Some providers genuinely have no auth for specific plans, hence "none".
 */
const AuthLocationSchema = z.enum(['header', 'query', 'body', 'none']);

/**
 * Supported authentication models for providers.
 *
 * - header_token:    e.g. "Authorization: Token {API_KEY}"
 * - query_api_key:   e.g. "?apikey=YOUR_API_KEY"
 * - none:            provider does not require explicit auth (public data)
 */
const AuthTypeEnum = z.enum(['header_token', 'query_api_key', 'none']);

const NonEmptyString = z.string().min(1, 'Expected a non-empty string');

const AuthConfigSchema = z.object({
  type: AuthTypeEnum,
  location: AuthLocationSchema,
  header_name: NonEmptyString.optional(),
  header_format: NonEmptyString.optional(),
  field_name: NonEmptyString.optional(),
  notes: NonEmptyString,
});

/**
 * Normalised quota shape for a provider.
 *
 * Every provider may expose different official quotas. We normalise them into
 * per-day / per-month / per-minute / per-second blocks plus a reset window.
 */
const QuotaNumberSchema = z.number().int().min(0).nullable();

const QuotaWindowSchema = z.object({
  max_calls: QuotaNumberSchema,
  notes: NonEmptyString,
});

const QuotaPerMonthSchema = QuotaWindowSchema.extend({
  reset_day: z.number().int().min(1).max(31).nullable(),
});

/**
 * How the provider's usage window resets.
 *
 * "none" is supported for cases where the upstream provider does not document
 * a clear reset window and we treat usage as effectively rolling / opaque.
 */
const ResetWindowKindSchema = z.enum([
  'calendar-day',
  'calendar-month',
  'rolling-24h',
  'rolling-30d',
  'none',
]);

const ResetWindowSchema = z.object({
  kind: ResetWindowKindSchema,
  notes: NonEmptyString,
});

/**
 * Exported quota schema + type so other modules (like quota.ts) can use
 * exactly the same structure.
 */
export const ProviderQuotaSchema = z.object({
  per_day: QuotaWindowSchema,
  per_month: QuotaPerMonthSchema,
  per_minute: QuotaWindowSchema,
  per_second: QuotaWindowSchema,
  reset_window: ResetWindowSchema,
});

export type ProviderQuota = z.infer<typeof ProviderQuotaSchema>;

/**
 * Credits / billing model for a provider.
 *
 * - per_request:                 every HTTP request counts as one credit
 * - per_symbol:                  cost scales with the number of symbols
 * - per_request_credit_weighted: requests have different weights by endpoint
 */
const CreditsModelTypeSchema = z.enum(['per_request', 'per_symbol', 'per_request_credit_weighted']);

const CreditsModelSchema = z.object({
  type: CreditsModelTypeSchema,
  default_credits_per_request: z.number().min(0),
  notes: NonEmptyString,
});

/**
 * Single provider entry in api.providers.catalog.json.
 */
const ApiProviderSchema = z.object({
  id: NonEmptyString,
  name: NonEmptyString,
  label: NonEmptyString,
  ui_label: NonEmptyString,
  short_label: NonEmptyString,
  website: NonEmptyString,
  dashboard_url: NonEmptyString,
  docs_url: NonEmptyString,
  base_url_rest: NonEmptyString,
  plan_name: NonEmptyString,
  status: ProviderStatusEnum,
  kinds_supported: z.array(ProviderKindEnum).min(1),
  roles_supported: z.array(NonEmptyString).min(1),
  auth: AuthConfigSchema,
  quota: ProviderQuotaSchema,
  credits_model: CreditsModelSchema,
  tags: z.array(NonEmptyString).default([]),
  notes: NonEmptyString,
});

export const ApiProvidersCatalogSchema = z.object({
  version: z.number().int().min(1),
  providers: z.array(ApiProviderSchema),
});

export type ApiProvidersCatalog = z.infer<typeof ApiProvidersCatalogSchema>;

/**
 * Validate an in-memory representation of api.providers.catalog.json.
 * Used by Tier-2 JSON validation tests and any tooling.
 */
export function validateApiProvidersCatalog(input: unknown): ApiProvidersCatalog {
  return ApiProvidersCatalogSchema.parse(input);
}
