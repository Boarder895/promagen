/**
 * @file src/lib/voting/validation.ts
 * @description Zod schemas for vote request validation
 * 
 * Security: Strict validation at API boundary.
 * All input must be validated before processing.
 * Uses transform to sanitize data.
 */

import { z } from 'zod';
import type { SIGNAL_WEIGHTS} from './constants';
import { MIN_IDEMPOTENCY_KEY_LENGTH } from './constants';

// ============================================================================
// PRIMITIVE SCHEMAS
// ============================================================================

/**
 * Valid signal types.
 */
export const SignalTypeSchema = z.enum([
  'card_like',
  'image_like',
  'comment',
  'image_upload',
]);

/**
 * Provider ID schema.
 * Lowercase alphanumeric with hyphens, max 50 chars.
 */
export const ProviderIdSchema = z
  .string()
  .min(1, 'Provider ID is required')
  .max(50, 'Provider ID too long')
  .regex(/^[a-z0-9-]+$/, 'Invalid provider ID format')
  .transform((id) => id.toLowerCase().trim());

/**
 * Idempotency key schema.
 * Alphanumeric with hyphens, min 16 chars.
 */
export const IdempotencyKeySchema = z
  .string()
  .min(MIN_IDEMPOTENCY_KEY_LENGTH, `Idempotency key must be at least ${MIN_IDEMPOTENCY_KEY_LENGTH} characters`)
  .max(64, 'Idempotency key too long')
  .regex(/^[a-zA-Z0-9-]+$/, 'Invalid idempotency key format');

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

/**
 * POST /api/providers/vote request body schema.
 */
export const VoteRequestSchema = z.object({
  /** Provider to vote for */
  providerId: ProviderIdSchema,
  
  /** Type of engagement signal */
  signalType: SignalTypeSchema,
  
  /** Unique request identifier for deduplication */
  idempotencyKey: IdempotencyKeySchema,
}).strict(); // Reject unknown fields

/**
 * GET /api/providers/vote query params schema.
 */
export const VoteQuerySchema = z.object({
  /** Optional provider ID to get specific stats */
  providerId: ProviderIdSchema.optional(),
});

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

/**
 * Vote success response schema.
 */
export const VoteSuccessResponseSchema = z.object({
  success: z.literal(true),
  vote: z.object({
    providerId: z.string(),
    weight: z.number().positive(),
    rank: z.number().int().positive().nullable(),
  }),
});

/**
 * Vote error response schema.
 */
export const VoteErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.enum([
    'INVALID_REQUEST',
    'INVALID_PROVIDER',
    'INVALID_SIGNAL_TYPE',
    'UNAUTHORIZED',
    'RATE_LIMITED',
    'DAILY_LIMIT',
    'ALREADY_VOTED',
    'REPLAY_DETECTED',
    'SUSPICIOUS_REQUEST',
    'INTERNAL_ERROR',
  ]),
});

// ============================================================================
// STORAGE SCHEMAS
// ============================================================================

/**
 * Vote metadata schema.
 */
export const VoteMetadataSchema = z.object({
  ipHash: z.string().length(64), // SHA-256 hex
  uaHash: z.string().length(64),
  origin: z.string().nullable(),
  idempotencyKey: z.string(),
});

/**
 * Stored vote record schema.
 */
export const VoteRecordSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().length(64), // SHA-256 hex
  providerId: ProviderIdSchema,
  signalType: SignalTypeSchema,
  baseWeight: z.number().int().positive(),
  finalWeight: z.number().positive(),
  userTier: z.enum(['free', 'paid']),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  meta: VoteMetadataSchema,
});

/**
 * Rate limit state schema.
 */
export const RateLimitStateSchema = z.object({
  count: z.number().int().nonnegative(),
  windowStart: z.number().int().positive(),
  dailyVotes: z.array(z.string()),
  lastRequest: z.number().int().positive(),
});

/**
 * Provider vote stats schema.
 */
export const ProviderVoteStatsSchema = z.object({
  providerId: z.string(),
  totalWeightedVotes: z.number().nonnegative(),
  totalVoteCount: z.number().int().nonnegative(),
  signals: z.object({
    cardLikes: z.number().int().nonnegative(),
    imageLikes: z.number().int().nonnegative(),
    comments: z.number().int().nonnegative(),
    imageUploads: z.number().int().nonnegative(),
  }),
  bayesianScore: z.number().min(0).max(100),
  communityRank: z.number().int().positive(),
  lastCalculated: z.string().datetime(),
});

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate vote request body.
 * Returns parsed data or throws ZodError.
 */
export function validateVoteRequest(body: unknown) {
  return VoteRequestSchema.parse(body);
}

/**
 * Safe validation that returns result instead of throwing.
 */
export function safeValidateVoteRequest(body: unknown) {
  return VoteRequestSchema.safeParse(body);
}

/**
 * Check if signal type is valid.
 */
export function isValidSignalType(value: unknown): value is keyof typeof SIGNAL_WEIGHTS {
  return SignalTypeSchema.safeParse(value).success;
}

/**
 * Validate provider ID exists in catalog.
 * Uses provider list for validation.
 */
export function validateProviderExists(
  providerId: string,
  providerIds: Set<string>
): boolean {
  return providerIds.has(providerId);
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ValidatedVoteRequest = z.infer<typeof VoteRequestSchema>;
export type ValidatedVoteRecord = z.infer<typeof VoteRecordSchema>;
export type ValidatedRateLimitState = z.infer<typeof RateLimitStateSchema>;
export type ValidatedProviderStats = z.infer<typeof ProviderVoteStatsSchema>;
