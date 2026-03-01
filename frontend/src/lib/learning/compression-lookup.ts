// src/lib/learning/compression-lookup.ts
// ============================================================================
// COMPRESSION INTELLIGENCE — Lookup Functions
// ============================================================================
//
// Phase 7.9, Parts 7.9b + 7.9c — Real-time Integration Bridge.
//
// Bridge between the raw CompressionProfilesData (from nightly cron Layer 17)
// and the suggestion engine's per-option scoring pipeline.
//
// Provides:
// 1. buildCompressionLookup()        — converts profiles data → fast Maps for O(1)
// 2. lookupOptimalLength()           — returns tier-level length profile
// 3. lookupPlatformOptimalLength()   — returns platform-specific length profile
// 4. lookupBestOptimalChars()        — confidence-blended platform+tier length
// 5. lookupExpendability()           — returns expendability score for a term (0–1)
// 6. isExpendable()                  — boolean convenience: term exceeds threshold
//
// Same pattern as temporal-lookup.ts (Phase 7.8).
//
// Pure functions — no I/O, no side effects.
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 7.9
//
// Version: 1.1.0 — Added platform confidence blending for length lookups
// Created: 2026-02-28
//
// Existing features preserved: Yes.
// ============================================================================

import { LEARNING_CONSTANTS } from '@/lib/learning/constants';

import type {
  CompressionProfilesData,
  OptimalLengthProfile,
  PlatformLengthProfile,
  ExpendableTerm,
} from '@/lib/learning/compression-intelligence';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Fast lookup structure for compression profiles.
 * Built once from nightly cron output, reused across all scoring calls.
 */
export interface CompressionLookup {
  /** Per-tier optimal length profiles: tier → profile */
  lengthByTier: Map<number, OptimalLengthProfile>;

  /** Per-tier expendable term maps: tier → (term → ExpendableTerm) */
  expendableByTier: Map<number, Map<string, ExpendableTerm>>;

  /** Flat expendable lookup: "tier:term" → expendability score (0–1) */
  expendableByKey: Map<string, number>;

  /** Per-tier platform length profiles: tier → (platformId → PlatformLengthProfile) */
  platformLengthByTierPlatform: Map<number, Map<string, PlatformLengthProfile>>;

  /** Total events that produced this data */
  totalEventsAnalysed: number;

  /** ISO timestamp of when this data was generated */
  generatedAt: string;
}

// ============================================================================
// BUILD LOOKUP
// ============================================================================

/**
 * Convert CompressionProfilesData into a fast lookup structure.
 *
 * Called once when data is fetched (API response or hook hydration),
 * then reused for all scoring calls until next refresh.
 *
 * @param data — CompressionProfilesData from the API (null = no data yet)
 * @returns CompressionLookup with O(1) lookups, or null if no data
 */
export function buildCompressionLookup(
  data: CompressionProfilesData | null | undefined,
): CompressionLookup | null {
  if (!data) return null;

  // ── Length profiles by tier ────────────────────────────────────────
  const lengthByTier = new Map<number, OptimalLengthProfile>();

  if (data.lengthProfiles) {
    for (const [tierKey, profile] of Object.entries(data.lengthProfiles)) {
      const tier = parseInt(tierKey, 10);
      if (!isNaN(tier)) {
        lengthByTier.set(tier, profile);
      }
    }
  }

  // ── Expendable terms by tier and flat key ──────────────────────────
  const expendableByTier = new Map<number, Map<string, ExpendableTerm>>();
  const expendableByKey = new Map<string, number>();

  if (data.expendableTerms) {
    for (const [tierKey, terms] of Object.entries(data.expendableTerms)) {
      const tier = parseInt(tierKey, 10);
      if (isNaN(tier)) continue;

      const termMap = new Map<string, ExpendableTerm>();
      for (const entry of terms) {
        termMap.set(entry.term, entry);
        expendableByKey.set(`${tierKey}:${entry.term}`, entry.expendability);
      }
      expendableByTier.set(tier, termMap);
    }
  }

  // ── Platform length profiles by tier + platform ────────────────────
  const platformLengthByTierPlatform = new Map<number, Map<string, PlatformLengthProfile>>();

  if (data.platformLengthProfiles) {
    for (const [tierKey, tierData] of Object.entries(data.platformLengthProfiles)) {
      const tier = parseInt(tierKey, 10);
      if (isNaN(tier)) continue;

      const platformMap = new Map<string, PlatformLengthProfile>();
      for (const platform of tierData.platforms) {
        platformMap.set(platform.platformId, platform);
      }
      platformLengthByTierPlatform.set(tier, platformMap);
    }
  }

  return {
    lengthByTier,
    expendableByTier,
    expendableByKey,
    platformLengthByTierPlatform,
    totalEventsAnalysed: data.totalEventsAnalysed,
    generatedAt: data.generatedAt,
  };
}

// ============================================================================
// LENGTH LOOKUPS
// ============================================================================

/**
 * Look up the optimal prompt length profile for a tier.
 *
 * Returns the full profile including optimal chars, diminishing returns
 * point, and histogram. Returns null if no data exists for this tier.
 *
 * @param lookup — Pre-built CompressionLookup (null = no learned data)
 * @param tier — Platform tier (1–4)
 * @returns OptimalLengthProfile or null
 */
export function lookupOptimalLength(
  lookup: CompressionLookup | null,
  tier: number,
): OptimalLengthProfile | null {
  if (!lookup) return null;
  return lookup.lengthByTier.get(tier) ?? null;
}

/**
 * Look up the platform-specific optimal length profile.
 *
 * Falls back to the tier-level profile when no platform-specific data
 * exists (platform had fewer events than COMPRESSION_PLATFORM_MIN_EVENTS).
 *
 * @param lookup — Pre-built CompressionLookup (null = no learned data)
 * @param tier — Platform tier (1–4)
 * @param platformId — Platform slug (e.g. "midjourney", "leonardo")
 * @returns PlatformLengthProfile if platform data exists, null otherwise.
 *          Use lookupOptimalLength() as fallback for the tier-level profile.
 */
export function lookupPlatformOptimalLength(
  lookup: CompressionLookup | null,
  tier: number,
  platformId: string,
): PlatformLengthProfile | null {
  if (!lookup) return null;

  const platformMap = lookup.platformLengthByTierPlatform.get(tier);
  if (!platformMap) return null;

  return platformMap.get(platformId) ?? null;
}

/**
 * Get the best available optimal chars for a tier + platform combination.
 *
 * Uses confidence blending when platform data exists but has moderate
 * event counts. Instead of binary (platform or tier), blends smoothly:
 *
 *   confidence = min(1.0, platformEvents / CONFIDENCE_THRESHOLD)
 *   result = tierOptimal + (platformOptimal - tierOptimal) × confidence
 *
 * At 50 events (min threshold): confidence ≈ 0.10 → mostly tier
 * At 250 events:                confidence = 0.50 → equal blend
 * At 500+ events:               confidence = 1.00 → pure platform
 *
 * Falls back to tier-level when no platform data exists; returns
 * null if neither exists (no compression data yet).
 *
 * @param lookup — Pre-built CompressionLookup (null = no learned data)
 * @param tier — Platform tier (1–4)
 * @param platformId — Platform slug (null = tier-level only)
 * @returns Blended optimal character count, or null if no data
 */
export function lookupBestOptimalChars(
  lookup: CompressionLookup | null,
  tier: number,
  platformId: string | null,
): number | null {
  if (!lookup) return null;

  // Always need tier-level as baseline
  const tierProfile = lookupOptimalLength(lookup, tier);
  const tierOptimal = tierProfile?.optimalChars ?? null;

  // Try platform-specific with confidence blending
  if (platformId) {
    const platformProfile = lookupPlatformOptimalLength(lookup, tier, platformId);
    if (platformProfile && tierOptimal !== null) {
      // Confidence ramp: smooth blend from tier → platform as events grow
      const confidence = Math.min(
        1.0,
        platformProfile.eventCount / LEARNING_CONSTANTS.COMPRESSION_PLATFORM_CONFIDENCE_THRESHOLD,
      );

      // Blend: tier + (platform - tier) × confidence
      const blended = tierOptimal + (platformProfile.optimalChars - tierOptimal) * confidence;
      return Math.round(blended);
    }

    // Platform data exists but no tier baseline — use platform directly
    if (platformProfile) return platformProfile.optimalChars;
  }

  // Fall back to tier-level
  return tierOptimal;
}

// ============================================================================
// EXPENDABILITY LOOKUPS
// ============================================================================

/**
 * Look up the expendability score for a term in a given tier.
 *
 * Returns a value between 0 and 1:
 * - 0    = not expendable (term is valuable or has insufficient data)
 * - 0.4+ = expendable (passed minimum threshold)
 * - 1.0  = maximally expendable (all signals agree it's safe to remove)
 *
 * @param lookup — Pre-built CompressionLookup (null = no learned data)
 * @param term — The vocabulary term to check
 * @param tier — Platform tier (1–4)
 * @returns Expendability score 0–1 (0 = not found / not expendable)
 */
export function lookupExpendability(
  lookup: CompressionLookup | null,
  term: string,
  tier: number,
): number {
  if (!lookup) return 0;
  return lookup.expendableByKey.get(`${String(tier)}:${term}`) ?? 0;
}

/**
 * Check whether a term is flagged as expendable in a given tier.
 *
 * Convenience wrapper: returns true if expendability >= threshold.
 *
 * @param lookup — Pre-built CompressionLookup (null = no learned data)
 * @param term — The vocabulary term to check
 * @param tier — Platform tier (1–4)
 * @returns true if term is flagged as expendable
 */
export function isExpendable(
  lookup: CompressionLookup | null,
  term: string,
  tier: number,
): boolean {
  return lookupExpendability(lookup, term, tier) >= LEARNING_CONSTANTS.COMPRESSION_MIN_EXPENDABILITY;
}

/**
 * Get the full ExpendableTerm entry for a term in a given tier.
 *
 * Returns the complete signal breakdown — useful for admin dashboard
 * tooltips and debugging why a term was flagged.
 *
 * @param lookup — Pre-built CompressionLookup (null = no learned data)
 * @param term — The vocabulary term to check
 * @param tier — Platform tier (1–4)
 * @returns Full ExpendableTerm entry, or null if not expendable
 */
export function lookupExpendableEntry(
  lookup: CompressionLookup | null,
  term: string,
  tier: number,
): ExpendableTerm | null {
  if (!lookup) return null;

  const tierMap = lookup.expendableByTier.get(tier);
  if (!tierMap) return null;

  return tierMap.get(term) ?? null;
}

/**
 * Get all expendable terms for a tier, sorted by expendability descending.
 *
 * @param lookup — Pre-built CompressionLookup (null = no learned data)
 * @param tier — Platform tier (1–4)
 * @returns Array of ExpendableTerm (empty if no data)
 */
export function listExpendableTerms(
  lookup: CompressionLookup | null,
  tier: number,
): ExpendableTerm[] {
  if (!lookup) return [];

  const tierMap = lookup.expendableByTier.get(tier);
  if (!tierMap) return [];

  // Map values are already sorted from the engine (desc by expendability)
  return Array.from(tierMap.values());
}

/**
 * Get all platform length profiles for a tier.
 *
 * @param lookup — Pre-built CompressionLookup (null = no learned data)
 * @param tier — Platform tier (1–4)
 * @returns Array of PlatformLengthProfile sorted by eventCount desc (empty if no data)
 */
export function listPlatformProfiles(
  lookup: CompressionLookup | null,
  tier: number,
): PlatformLengthProfile[] {
  if (!lookup) return [];

  const platformMap = lookup.platformLengthByTierPlatform.get(tier);
  if (!platformMap) return [];

  return Array.from(platformMap.values()).sort((a, b) => b.eventCount - a.eventCount);
}
