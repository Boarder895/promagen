// src/lib/learning/compression-intelligence.ts
// ============================================================================
// COMPRESSION INTELLIGENCE — Learned Compression Profiles Engine
// ============================================================================
//
// Phase 7.9, Parts 7.9a + 7.9b + 7.9c — Core Algorithm + Platform-Aware + Override List.
//
// Adds data-driven prompt compression knowledge to the learning pipeline.
// Three capabilities:
//
// 1. Optimal length profiles — Per-tier analysis of prompt character length
//    vs outcome score. Identifies the "sweet spot" where prompts perform
//    best and the point of diminishing returns.
//
// 2. Expendable term detection — Cross-references four learning signals
//    (replacement rate, quality score, redundancy, anti-patterns) to
//    identify terms that are safe to remove during compression.
//    Protected by a curated override list (compression-overrides.ts).
//
// 3. Platform-aware length profiles — Per-platform length sweet spots
//    within each tier. Midjourney prompts have different optimal lengths
//    than DALL-E prompts. Falls back to tier profile when platform data
//    is insufficient (< COMPRESSION_PLATFORM_MIN_EVENTS events).
//
// This module is a pure computation layer — no I/O, no database access.
// Called by the nightly aggregation cron (Layer 17).
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 7.9
//
// Version: 1.2.0 — Added expendable term override list (safety net)
// Created: 2026-02-28
//
// Existing features preserved: Yes.
// ============================================================================

import { LEARNING_CONSTANTS } from '@/lib/learning/constants';
import { computeOutcomeScore } from '@/lib/learning/outcome-score';
import type { PromptEventRow } from '@/lib/learning/database';
import type { TermQualityScores } from '@/lib/learning/term-quality-scoring';
import type { IterationInsightsData } from '@/lib/learning/iteration-tracking';
import type { RedundancyGroupsData } from '@/lib/learning/redundancy-detection';
import type { AntiPatternData } from '@/lib/learning/anti-pattern-detection';
import { isOverriddenTerm } from '@/lib/learning/compression-overrides';

// ============================================================================
// OUTPUT TYPES — Optimal Length
// ============================================================================

/** A single length bucket's performance data */
export interface LengthBucket {
  /** Lower bound of the bucket (character count) */
  bucket: number;
  /** Average outcome score for prompts in this bucket */
  avgOutcome: number;
  /** Number of events in this bucket */
  count: number;
}

/** Per-tier optimal prompt length profile */
export interface OptimalLengthProfile {
  /** Tier number (1–4) */
  tier: number;
  /** Character length with the highest average outcome */
  optimalChars: number;
  /** Character length where outcome drops >15% from peak (diminishing returns) */
  diminishingReturnsAt: number;
  /** Average outcome score at the optimal length */
  optimalOutcome: number;
  /** Total events analysed for this tier */
  eventCount: number;
  /** Full histogram of length buckets for admin dashboard */
  lengthHistogram: LengthBucket[];
}

// ============================================================================
// OUTPUT TYPES — Platform-Aware Length Profiles
// ============================================================================

/** Per-platform optimal length profile within a tier */
export interface PlatformLengthProfile {
  /** Platform slug (e.g. "midjourney", "leonardo", "dall-e-3") */
  platformId: string;
  /** Tier number (1–4) */
  tier: number;
  /** Character length with the highest average outcome on this platform */
  optimalChars: number;
  /** Character length where outcome drops >15% from peak */
  diminishingReturnsAt: number;
  /** Average outcome score at the optimal length */
  optimalOutcome: number;
  /** Total events analysed for this platform on this tier */
  eventCount: number;
  /** Delta from tier-level optimal (positive = platform prefers longer) */
  deltaFromTier: number;
  /** Length histogram (same buckets as tier, but platform-specific counts) */
  lengthHistogram: LengthBucket[];
}

/** Per-tier collection of platform length profiles */
export interface TierPlatformLengthData {
  /** Number of platforms that qualified (met min events threshold) */
  qualifiedPlatforms: number;
  /** Total platforms seen (including below-threshold) */
  totalPlatforms: number;
  /** Platform profiles sorted by eventCount descending */
  platforms: PlatformLengthProfile[];
}

// ============================================================================
// OUTPUT TYPES — Expendable Terms
// ============================================================================

/** Signals contributing to a term's expendability score */
export interface ExpendabilitySignals {
  /** How often users replace this term in iterations (0–1, null if no data) */
  replacementRate: number | null;
  /** Inverted quality score: 1 - quality (0–1, null if no data) */
  qualityPenalty: number | null;
  /** Whether a redundancy group contains a better alternative */
  hasRedundantAlternative: boolean;
  /** Number of anti-pattern pairs this term appears in */
  antiPatternCount: number;
}

/** A term identified as safe to remove during compression */
export interface ExpendableTerm {
  /** The vocabulary term */
  term: string;
  /** Category the term belongs to */
  category: string;
  /** Tier this analysis applies to */
  tier: number;
  /** Combined expendability score (0–1, higher = safer to remove) */
  expendability: number;
  /** Individual signal breakdown */
  signals: ExpendabilitySignals;
}

// ============================================================================
// OUTPUT TYPES — Combined
// ============================================================================

/** Complete compression profiles output — stored in learned_weights table */
export interface CompressionProfilesData {
  /** Schema version */
  version: string;
  /** ISO timestamp of generation */
  generatedAt: string;
  /** Total events analysed across all tiers */
  totalEventsAnalysed: number;
  /** Per-tier optimal length profiles (keys: "1", "2", "3", "4") */
  lengthProfiles: Record<string, OptimalLengthProfile>;
  /** Per-tier expendable term lists (keys: "1", "2", "3", "4") */
  expendableTerms: Record<string, ExpendableTerm[]>;
  /** Per-tier platform-aware length profiles (keys: "1", "2", "3", "4").
   *  Each tier contains profiles for all platforms with enough data.
   *  Falls back to the tier-level profile when a platform has insufficient events. */
  platformLengthProfiles: Record<string, TierPlatformLengthData>;
}

// ============================================================================
// MAIN ORCHESTRATOR
// ============================================================================

/**
 * Run all compression intelligence analysis on a set of events.
 *
 * Cross-references event data with outputs from four previous learning layers:
 * - Term quality scores (Phase 6)
 * - Iteration insights / weak terms (Phase 7.2)
 * - Redundancy groups (Phase 7.3)
 * - Anti-patterns (Phase 7.1)
 *
 * @param events — ALL qualifying prompt events
 * @param termQuality — Phase 6 output (null if not yet generated)
 * @param iterationInsights — Phase 7.2 output (null if not yet generated)
 * @param redundancyGroups — Phase 7.3 output (null if not yet generated)
 * @param antiPatterns — Phase 7.1 output (null if not yet generated)
 * @returns CompressionProfilesData ready for upsert into learned_weights
 */
export function analyseCompressionProfiles(
  events: PromptEventRow[],
  termQuality: TermQualityScores | null,
  iterationInsights: IterationInsightsData | null,
  redundancyGroups: RedundancyGroupsData | null,
  antiPatterns: AntiPatternData | null,
): CompressionProfilesData {
  const C = LEARNING_CONSTANTS;

  // ── Group events by tier ──────────────────────────────────────────
  const tierGroups = groupByTier(events);

  // ── Build lookup indexes from dependency data ─────────────────────
  const qualityIndex = buildQualityIndex(termQuality);
  const weakTermIndex = buildWeakTermIndex(iterationInsights);
  const redundancyIndex = buildRedundancyIndex(redundancyGroups);
  const antiPatternIndex = buildAntiPatternIndex(antiPatterns);

  // ── Compute per-tier profiles ─────────────────────────────────────
  const lengthProfiles: Record<string, OptimalLengthProfile> = {};
  const expendableTerms: Record<string, ExpendableTerm[]> = {};
  const platformLengthProfiles: Record<string, TierPlatformLengthData> = {};

  for (const [tier, tierEvents] of tierGroups) {
    const tierKey = String(tier);

    // Skip tiers without enough data
    if (tierEvents.length < C.COMPRESSION_MIN_EVENTS_PER_TIER) continue;

    // Optimal length analysis
    const tierProfile = computeOptimalLength(
      tierEvents,
      tier,
      C.COMPRESSION_LENGTH_BUCKET_SIZE,
      C.COMPRESSION_MIN_EVENTS_PER_BUCKET,
      C.COMPRESSION_DIMINISHING_RETURNS_DROP,
    );
    lengthProfiles[tierKey] = tierProfile;

    // Expendable term detection
    expendableTerms[tierKey] = computeExpendableTerms(
      tierEvents,
      tier,
      qualityIndex,
      weakTermIndex,
      redundancyIndex,
      antiPatternIndex,
      C.COMPRESSION_MIN_TERM_EVENTS,
      C.COMPRESSION_MIN_EXPENDABILITY,
      C.COMPRESSION_MAX_EXPENDABLE_PER_TIER,
    );

    // Platform-aware length profiles
    platformLengthProfiles[tierKey] = computePlatformLengthProfiles(
      tierEvents,
      tier,
      tierProfile.optimalChars,
      C.COMPRESSION_PLATFORM_MIN_EVENTS,
      C.COMPRESSION_LENGTH_BUCKET_SIZE,
      C.COMPRESSION_MIN_EVENTS_PER_BUCKET,
      C.COMPRESSION_DIMINISHING_RETURNS_DROP,
      C.COMPRESSION_MAX_PLATFORMS_PER_TIER,
    );
  }

  return {
    version: '1.1.0',
    generatedAt: new Date().toISOString(),
    totalEventsAnalysed: events.length,
    lengthProfiles,
    expendableTerms,
    platformLengthProfiles,
  };
}

// ============================================================================
// OPTIMAL LENGTH ANALYSIS
// ============================================================================

/**
 * Compute the optimal prompt length profile for a single tier.
 *
 * Algorithm:
 * 1. Bucket events by prompt character length (bucketSize-char intervals)
 * 2. For each bucket with ≥ minEventsPerBucket events, compute average outcome
 * 3. Find the bucket with the highest average outcome → optimalChars
 * 4. Scan rightward from peak: first bucket where outcome drops > dropThreshold
 *    from peak → diminishingReturnsAt
 * 5. Produce full histogram for admin dashboard visibility
 *
 * @param events — Events for a single tier
 * @param tier — Tier number (1–4)
 * @param bucketSize — Character width per bucket (default: 20)
 * @param minEventsPerBucket — Minimum events for a bucket to count
 * @param dropThreshold — Fractional drop from peak to trigger diminishing returns
 * @returns OptimalLengthProfile
 */
export function computeOptimalLength(
  events: PromptEventRow[],
  tier: number,
  bucketSize: number,
  minEventsPerBucket: number,
  dropThreshold: number,
): OptimalLengthProfile {
  // ── Bucket events by char_length ──────────────────────────────────
  const bucketMap = new Map<number, { totalOutcome: number; count: number }>();

  for (const evt of events) {
    const bucketKey = Math.floor(evt.char_length / bucketSize) * bucketSize;
    const outcome = computeOutcomeScore(evt.outcome as Record<string, boolean>);

    const existing = bucketMap.get(bucketKey);
    if (existing) {
      existing.totalOutcome += outcome;
      existing.count++;
    } else {
      bucketMap.set(bucketKey, { totalOutcome: outcome, count: 1 });
    }
  }

  // ── Build histogram (only buckets with enough events) ─────────────
  const histogram: LengthBucket[] = [];

  for (const [bucket, data] of bucketMap) {
    if (data.count < minEventsPerBucket) continue;
    histogram.push({
      bucket,
      avgOutcome: round4(data.totalOutcome / data.count),
      count: data.count,
    });
  }

  // Sort by bucket ascending (shortest → longest prompts)
  histogram.sort((a, b) => a.bucket - b.bucket);

  // ── Find peak bucket ──────────────────────────────────────────────
  let peakIdx = 0;
  let peakOutcome = 0;

  for (let i = 0; i < histogram.length; i++) {
    const entry = histogram[i];
    if (entry && entry.avgOutcome > peakOutcome) {
      peakOutcome = entry.avgOutcome;
      peakIdx = i;
    }
  }

  const peakEntry = histogram[peakIdx];
  const optimalChars = peakEntry ? peakEntry.bucket : 0;

  // ── Find diminishing returns point ────────────────────────────────
  // Scan rightward from peak; first bucket below threshold
  let diminishingReturnsAt = optimalChars;

  for (let i = peakIdx + 1; i < histogram.length; i++) {
    const entry = histogram[i];
    if (!entry) continue;

    const dropFraction = (peakOutcome - entry.avgOutcome) / Math.max(peakOutcome, 0.001);
    if (dropFraction > dropThreshold) {
      diminishingReturnsAt = entry.bucket;
      break;
    }
    // If we reach the end without a significant drop, the last bucket is the DR point
    diminishingReturnsAt = entry.bucket;
  }

  return {
    tier,
    optimalChars,
    diminishingReturnsAt,
    optimalOutcome: round4(peakOutcome),
    eventCount: events.length,
    lengthHistogram: histogram,
  };
}

// ============================================================================
// PLATFORM-AWARE LENGTH PROFILES
// ============================================================================

/**
 * Compute per-platform optimal length profiles within a single tier.
 *
 * Groups events by platform slug (PromptEventRow.platform), then runs
 * the same length bucketing algorithm per platform. Only platforms with
 * >= minPlatformEvents qualify — the rest fall back to the tier profile.
 *
 * @param events — Events for a single tier
 * @param tier — Tier number (1–4)
 * @param tierOptimalChars — The tier-level optimal chars (for delta calculation)
 * @param minPlatformEvents — Minimum events per platform to qualify
 * @param bucketSize — Character width per bucket
 * @param minEventsPerBucket — Minimum events per bucket to count
 * @param dropThreshold — Fractional drop from peak for diminishing returns
 * @param maxPlatforms — Maximum platform profiles stored per tier (storage cap)
 * @returns TierPlatformLengthData with qualified platform profiles
 */
export function computePlatformLengthProfiles(
  events: PromptEventRow[],
  tier: number,
  tierOptimalChars: number,
  minPlatformEvents: number,
  bucketSize: number,
  minEventsPerBucket: number,
  dropThreshold: number,
  maxPlatforms: number,
): TierPlatformLengthData {
  // ── Group events by platform ──────────────────────────────────────
  const platformGroups = new Map<string, PromptEventRow[]>();

  for (const evt of events) {
    const pid = evt.platform;
    if (!pid || typeof pid !== 'string') continue;

    let group = platformGroups.get(pid);
    if (!group) {
      group = [];
      platformGroups.set(pid, group);
    }
    group.push(evt);
  }

  const totalPlatforms = platformGroups.size;

  // ── Compute per-platform profiles ─────────────────────────────────
  const platforms: PlatformLengthProfile[] = [];

  for (const [platformId, platformEvents] of platformGroups) {
    if (platformEvents.length < minPlatformEvents) continue;

    // Reuse the same bucketing algorithm
    const profile = computeOptimalLength(
      platformEvents,
      tier,
      bucketSize,
      // Platform has fewer events, so relax bucket min to 5 (or half of tier min)
      Math.max(3, Math.floor(minEventsPerBucket / 2)),
      dropThreshold,
    );

    platforms.push({
      platformId,
      tier,
      optimalChars: profile.optimalChars,
      diminishingReturnsAt: profile.diminishingReturnsAt,
      optimalOutcome: profile.optimalOutcome,
      eventCount: profile.eventCount,
      deltaFromTier: profile.optimalChars - tierOptimalChars,
      lengthHistogram: profile.lengthHistogram,
    });
  }

  // Sort by eventCount descending (most data first), cap at max
  platforms.sort((a, b) => b.eventCount - a.eventCount);

  return {
    qualifiedPlatforms: Math.min(platforms.length, maxPlatforms),
    totalPlatforms,
    platforms: platforms.slice(0, maxPlatforms),
  };
}

// ============================================================================
// EXPENDABLE TERM DETECTION
// ============================================================================

/**
 * Detect expendable terms for a single tier by cross-referencing four signals.
 *
 * Algorithm per term:
 * 1. Gather replacement rate from iteration insights (Phase 7.2)
 * 2. Gather quality penalty = 1 - qualityScore/100 from term quality (Phase 6)
 * 3. Check if a redundancy group has a better alternative (Phase 7.3)
 * 4. Count anti-pattern pair memberships (Phase 7.1)
 * 5. Compute combined expendability:
 *    0.35 × replacementRate +
 *    0.30 × qualityPenalty +
 *    0.20 × hasRedundantAlternative (boolean → 1.0 or 0.0) +
 *    0.15 × min(1.0, antiPatternCount / 3)
 * 6. Filter by minimum expendability threshold
 * 7. Sort descending, cap per tier
 *
 * @param events — Events for a single tier
 * @param tier — Tier number (1–4)
 * @param qualityIndex — Map of "tier:term" → quality score (0–100)
 * @param weakTermIndex — Map of "tier:term" → replacement rate (0–1)
 * @param redundancyIndex — Set of "tier:term" strings that have better alternatives
 * @param antiPatternIndex — Map of "tier:term" → number of anti-pattern pairs
 * @param minTermEvents — Minimum events a term must appear in
 * @param minExpendability — Minimum combined score to qualify
 * @param maxPerTier — Cap on expendable terms per tier
 * @returns Sorted array of ExpendableTerm
 */
export function computeExpendableTerms(
  events: PromptEventRow[],
  tier: number,
  qualityIndex: Map<string, number>,
  weakTermIndex: Map<string, number>,
  redundancyIndex: Set<string>,
  antiPatternIndex: Map<string, number>,
  minTermEvents: number,
  minExpendability: number,
  maxPerTier: number,
): ExpendableTerm[] {
  const tierKey = String(tier);

  // ── Count term appearances and track categories ───────────────────
  const termData = new Map<string, { count: number; category: string }>();

  for (const evt of events) {
    const termToCategory = buildTermCategoryMap(evt.selections);
    for (const [term, category] of termToCategory) {
      const existing = termData.get(term);
      if (existing) {
        existing.count++;
      } else {
        termData.set(term, { count: 1, category });
      }
    }
  }

  // ── Score each qualifying term ────────────────────────────────────
  const results: ExpendableTerm[] = [];
  const W = LEARNING_CONSTANTS;

  for (const [term, data] of termData) {
    if (data.count < minTermEvents) continue;

    // Override safety net: skip terms in the curated protection list.
    // These are high-value visual/technical terms that should never be
    // flagged as expendable regardless of what the signals say.
    if (isOverriddenTerm(term)) continue;

    const lookupKey = `${tierKey}:${term}`;

    // Signal 1: Replacement rate (Phase 7.2)
    const replacementRate = weakTermIndex.get(lookupKey) ?? null;

    // Signal 2: Quality penalty (Phase 6) — invert so low quality = high penalty
    const rawQuality = qualityIndex.get(lookupKey) ?? null;
    const qualityPenalty = rawQuality !== null
      ? round4(1 - rawQuality / 100)
      : null;

    // Signal 3: Redundancy (Phase 7.3) — has a better alternative?
    const hasRedundantAlternative = redundancyIndex.has(lookupKey);

    // Signal 4: Anti-pattern count (Phase 7.1)
    const antiPatternCount = antiPatternIndex.get(lookupKey) ?? 0;

    // ── Combined expendability score ──────────────────────────────
    let expendability = 0;
    let signalCount = 0;

    if (replacementRate !== null) {
      expendability += W.COMPRESSION_WEIGHT_REPLACEMENT * replacementRate;
      signalCount++;
    }
    if (qualityPenalty !== null) {
      expendability += W.COMPRESSION_WEIGHT_QUALITY * qualityPenalty;
      signalCount++;
    }
    if (hasRedundantAlternative) {
      expendability += W.COMPRESSION_WEIGHT_REDUNDANCY * 1.0;
      signalCount++;
    }
    if (antiPatternCount > 0) {
      expendability += W.COMPRESSION_WEIGHT_ANTIPATTERN * Math.min(1.0, antiPatternCount / 3);
      signalCount++;
    }

    // Require at least 2 contributing signals to avoid false positives
    if (signalCount < 2) continue;

    expendability = round4(expendability);

    if (expendability < minExpendability) continue;

    results.push({
      term,
      category: data.category,
      tier,
      expendability,
      signals: {
        replacementRate,
        qualityPenalty,
        hasRedundantAlternative,
        antiPatternCount,
      },
    });
  }

  // Sort by expendability descending (most expendable first)
  results.sort((a, b) => b.expendability - a.expendability);

  return results.slice(0, maxPerTier);
}

// ============================================================================
// INDEX BUILDERS — Extract lookup maps from dependency outputs
// ============================================================================

/**
 * Build a lookup from term quality scores: "tier:term" → score (0–100).
 *
 * @param data — Phase 6 TermQualityScores output
 * @returns Map for O(1) quality lookups
 */
export function buildQualityIndex(
  data: TermQualityScores | null,
): Map<string, number> {
  const index = new Map<string, number>();
  if (!data) return index;

  for (const [tierKey, tierData] of Object.entries(data.tiers)) {
    for (const [term, quality] of Object.entries(tierData.terms)) {
      index.set(`${tierKey}:${term}`, quality.score);
    }
  }

  return index;
}

/**
 * Build a lookup from iteration insights: "tier:term" → replacement rate (0–1).
 *
 * @param data — Phase 7.2 IterationInsightsData output
 * @returns Map for O(1) weak term lookups
 */
export function buildWeakTermIndex(
  data: IterationInsightsData | null,
): Map<string, number> {
  const index = new Map<string, number>();
  if (!data) return index;

  for (const [tierKey, tierData] of Object.entries(data.tiers)) {
    for (const entry of tierData.weakTerms) {
      index.set(`${tierKey}:${entry.term}`, entry.replacementRate);
    }
  }

  return index;
}

/**
 * Build a set of terms that have redundant alternatives: "tier:term".
 * A term is "redundant" if it appears in a redundancy group but is NOT
 * the canonical (most-used) member.
 *
 * @param data — Phase 7.3 RedundancyGroupsData output
 * @returns Set for O(1) redundancy checks
 */
export function buildRedundancyIndex(
  data: RedundancyGroupsData | null,
): Set<string> {
  const index = new Set<string>();
  if (!data) return index;

  for (const [tierKey, tierData] of Object.entries(data.tiers)) {
    for (const group of tierData.groups) {
      // Non-canonical members are expendable (canonical is the preferred term)
      for (const member of group.members) {
        if (member !== group.canonical) {
          index.add(`${tierKey}:${member}`);
        }
      }
    }
  }

  return index;
}

/**
 * Build a lookup from anti-pattern data: "tier:term" → count of pairs.
 *
 * @param data — Phase 7.1 AntiPatternData output
 * @returns Map for O(1) anti-pattern count lookups
 */
export function buildAntiPatternIndex(
  data: AntiPatternData | null,
): Map<string, number> {
  const index = new Map<string, number>();
  if (!data) return index;

  for (const [tierKey, tierData] of Object.entries(data.tiers)) {
    for (const pattern of tierData.patterns) {
      for (const term of pattern.terms) {
        const key = `${tierKey}:${term}`;
        index.set(key, (index.get(key) ?? 0) + 1);
      }
    }
  }

  return index;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Group events by tier.
 *
 * @param events — All events
 * @returns Map of tier → events
 */
function groupByTier(events: PromptEventRow[]): Map<number, PromptEventRow[]> {
  const groups = new Map<number, PromptEventRow[]>();

  for (const evt of events) {
    let group = groups.get(evt.tier);
    if (!group) {
      group = [];
      groups.set(evt.tier, group);
    }
    group.push(evt);
  }

  return groups;
}

/**
 * Build a Map of term → category from an event's selections.
 *
 * Each unique term maps to its category. If a term appears in multiple
 * categories within one event, the last one wins.
 *
 * @param selections — Record<category, string[]> from PromptEventRow
 * @returns Map<term, category>
 */
function buildTermCategoryMap(
  selections: Record<string, string[]>,
): Map<string, string> {
  const map = new Map<string, string>();

  for (const [category, values] of Object.entries(selections)) {
    if (!Array.isArray(values)) continue;
    for (const v of values) {
      if (typeof v === 'string' && v.length > 0) {
        map.set(v, category);
      }
    }
  }

  return map;
}

/** Round to 4 decimal places. */
function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
