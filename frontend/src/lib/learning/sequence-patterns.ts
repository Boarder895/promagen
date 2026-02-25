// src/lib/learning/sequence-patterns.ts
// ============================================================================
// COLLECTIVE INTELLIGENCE ENGINE — Sequence Pattern Computation
// ============================================================================
//
// Layer 2 of the nightly aggregation cron.
//
// Tracks which categories users fill first when building a prompt.
// Groups events by session, orders by attempt_number, then detects which
// categories went from empty → non-empty between successive attempts.
// Aggregates fill-order sequences per tier.
//
// This informs the "next empty dropdown highlights" feature — when a user
// has filled subject + style, the system knows that lighting is the most
// common next choice and can highlight it.
//
// Pure computation layer — no I/O, no database access.
// Called by the aggregate cron route.
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 9.2
//
// Version: 1.0.0
// Created: 2026-02-25
//
// Existing features preserved: Yes.
// ============================================================================

import type { PromptEventRow } from '@/lib/learning/database';

// ============================================================================
// OUTPUT TYPES
// ============================================================================

/** A specific category fill order observed across sessions */
export interface FillSequence {
  /** Ordered list of categories as they were filled: ["subject", "style", "lighting", ...] */
  order: string[];
  /** Fraction of sessions that used this exact sequence (0–1) */
  frequency: number;
  /** Average final prompt score for sessions that followed this sequence */
  avgScore: number;
}

/** Per-category priority within a tier */
export interface CategoryPriority {
  /** Category name (e.g., "subject", "style") */
  category: string;
  /** How often this category is the first one filled (0–1) */
  fillFrequency: number;
  /** Average score of prompts where this category was filled at each position */
  avgPositionalScore: number;
}

/** Per-tier sequence data */
export interface TierSequenceData {
  /** Number of qualifying sessions in this tier */
  sessionCount: number;
  /** Top 3 most common fill-order sequences */
  topSequences: FillSequence[];
  /** Per-category first-fill priority */
  categoryPriority: CategoryPriority[];
}

/** Full sequence patterns output — stored via upsertLearnedWeights */
export interface SequencePatterns {
  /** Schema version for forward compat */
  version: string;
  /** ISO timestamp of generation */
  generatedAt: string;
  /** Total sessions processed across all tiers */
  sessionCount: number;
  /** Per-tier data keyed by tier number (1–4) */
  tiers: Record<string, TierSequenceData>;
}

// ============================================================================
// INTERNAL TYPES
// ============================================================================

/** Represents one session's ordered attempts */
interface SessionAttempt {
  attemptNumber: number;
  /** Category names that have at least one non-empty selection */
  filledCategories: Set<string>;
  /** The final score of this attempt (used for the session's last attempt) */
  score: number;
  /** Tier of this attempt */
  tier: number;
}

/** A session's computed fill order + metadata */
interface SessionFillOrder {
  /** The order in which categories were first filled */
  order: string[];
  /** Score of the final attempt in the session */
  finalScore: number;
  /** Tier of the session (from the first attempt) */
  tier: number;
}

// ============================================================================
// MAIN COMPUTATION
// ============================================================================

/**
 * Compute sequence patterns from qualifying prompt events.
 *
 * Algorithm:
 * 1. Group events by session_id, order by attempt_number
 * 2. For each session, detect fill order: which categories go from
 *    empty → non-empty between successive attempts
 * 3. Aggregate per tier: count frequency of each unique fill sequence
 * 4. Compute category priority: how often each category is filled first
 * 5. Output top 3 sequences per tier + category priority list
 *
 * @param events — Qualifying PromptEventRow[] from database
 * @param referenceDate — "Now" for timestamp (default: Date.now())
 * @returns SequencePatterns ready for storage
 */
export function computeSequencePatterns(
  events: PromptEventRow[],
  referenceDate: Date = new Date(),
): SequencePatterns {
  // ── Step 1: Group by session, order by attempt ──────────────────────────
  const sessionMap = new Map<string, SessionAttempt[]>();

  for (const evt of events) {
    let attempts = sessionMap.get(evt.session_id);
    if (!attempts) {
      attempts = [];
      sessionMap.set(evt.session_id, attempts);
    }

    // Determine which categories are filled (have at least one non-empty value)
    const filled = new Set<string>();
    for (const [category, values] of Object.entries(evt.selections)) {
      if (Array.isArray(values) && values.some((v) => typeof v === 'string' && v.length > 0)) {
        filled.add(category);
      }
    }

    attempts.push({
      attemptNumber: evt.attempt_number,
      filledCategories: filled,
      score: evt.score,
      tier: evt.tier,
    });
  }

  // ── Step 2: Compute fill order per session ──────────────────────────────
  const sessionFillOrders: SessionFillOrder[] = [];

  for (const [, attempts] of sessionMap) {
    // Sort by attempt number ascending
    attempts.sort((a, b) => a.attemptNumber - b.attemptNumber);

    // Need at least 1 attempt
    if (attempts.length === 0) continue;

    const fillOrder = extractFillOrder(attempts);
    if (fillOrder.order.length > 0) {
      sessionFillOrders.push(fillOrder);
    }
  }

  // ── Step 3–5: Aggregate per tier ────────────────────────────────────────
  const tierGroups = new Map<number, SessionFillOrder[]>();
  for (const sfo of sessionFillOrders) {
    let group = tierGroups.get(sfo.tier);
    if (!group) {
      group = [];
      tierGroups.set(sfo.tier, group);
    }
    group.push(sfo);
  }

  const tiers: Record<string, TierSequenceData> = {};

  for (const [tier, sessions] of tierGroups) {
    tiers[String(tier)] = computeTierSequences(sessions);
  }

  return {
    version: '1.0.0',
    generatedAt: referenceDate.toISOString(),
    sessionCount: sessionFillOrders.length,
    tiers,
  };
}

// ============================================================================
// FILL ORDER EXTRACTION
// ============================================================================

/**
 * Given a session's ordered attempts, determine the order in which
 * categories were first filled.
 *
 * For single-attempt sessions: all filled categories are treated as
 * filled simultaneously (added in alphabetical order for consistency).
 *
 * For multi-attempt sessions: categories that appear as newly filled
 * between attempt N and attempt N+1 are recorded in that position.
 *
 * @param attempts — Sorted by attemptNumber ascending
 * @returns SessionFillOrder with detected fill sequence
 */
function extractFillOrder(attempts: SessionAttempt[]): SessionFillOrder {
  const order: string[] = [];
  const seen = new Set<string>();

  // First attempt's filled categories are all "position 1"
  const first = attempts[0]!;

  if (attempts.length === 1) {
    // Single attempt: all categories filled at once, sorted for determinism
    const sorted = Array.from(first.filledCategories).sort();
    return {
      order: sorted,
      finalScore: first.score,
      tier: first.tier,
    };
  }

  // Multi-attempt: track newly filled categories between successive attempts
  // First attempt's categories are all "first filled"
  const firstFilled = Array.from(first.filledCategories).sort();
  for (const cat of firstFilled) {
    order.push(cat);
    seen.add(cat);
  }

  // Walk subsequent attempts
  for (let i = 1; i < attempts.length; i++) {
    const current = attempts[i]!;
    // Find categories that are newly filled (weren't in any previous attempt)
    const newlyFilled: string[] = [];
    for (const cat of current.filledCategories) {
      if (!seen.has(cat)) {
        newlyFilled.push(cat);
        seen.add(cat);
      }
    }
    // Sort for determinism within the same attempt
    newlyFilled.sort();
    for (const cat of newlyFilled) {
      order.push(cat);
    }
  }

  // Final score = last attempt's score
  const last = attempts[attempts.length - 1]!;

  return {
    order,
    finalScore: last.score,
    tier: first.tier,
  };
}

// ============================================================================
// PER-TIER AGGREGATION
// ============================================================================

/**
 * Aggregate fill-order sessions into tier-level statistics.
 *
 * @param sessions — All SessionFillOrder entries for one tier
 * @returns TierSequenceData with top sequences + category priority
 */
function computeTierSequences(sessions: SessionFillOrder[]): TierSequenceData {
  const sessionCount = sessions.length;
  if (sessionCount === 0) {
    return { sessionCount: 0, topSequences: [], categoryPriority: [] };
  }

  // ── Count frequency of each unique fill sequence ────────────────────────
  const sequenceCounts = new Map<
    string,
    { count: number; totalScore: number }
  >();

  for (const session of sessions) {
    // Use JSON key for grouping (order matters)
    const key = session.order.join('→');
    const entry = sequenceCounts.get(key) ?? { count: 0, totalScore: 0 };
    entry.count += 1;
    entry.totalScore += session.finalScore;
    sequenceCounts.set(key, entry);
  }

  // ── Build top sequences (sorted by frequency desc, top 3) ──────────────
  const sequenceEntries = Array.from(sequenceCounts.entries()).map(
    ([key, { count, totalScore }]) => ({
      order: key.split('→'),
      frequency: count / sessionCount,
      avgScore: Math.round(totalScore / count),
      count,
    }),
  );

  sequenceEntries.sort((a, b) => b.count - a.count);

  const topSequences: FillSequence[] = sequenceEntries
    .slice(0, 3)
    .map(({ order, frequency, avgScore }) => ({
      order,
      frequency: Math.round(frequency * 1000) / 1000, // 3 decimal places
      avgScore,
    }));

  // ── Category priority: how often each category is first-filled ──────────
  // "First filled" = the first category in the fill order
  const firstFillCounts = new Map<
    string,
    { count: number; totalScore: number }
  >();

  for (const session of sessions) {
    if (session.order.length === 0) continue;
    // The first category in the fill order
    const firstCat = session.order[0]!;
    const entry = firstFillCounts.get(firstCat) ?? {
      count: 0,
      totalScore: 0,
    };
    entry.count += 1;
    entry.totalScore += session.finalScore;
    firstFillCounts.set(firstCat, entry);
  }

  const categoryPriority: CategoryPriority[] = Array.from(
    firstFillCounts.entries(),
  )
    .map(([category, { count, totalScore }]) => ({
      category,
      fillFrequency: Math.round((count / sessionCount) * 1000) / 1000,
      avgPositionalScore: Math.round(totalScore / count),
    }))
    .sort((a, b) => b.fillFrequency - a.fillFrequency);

  return {
    sessionCount,
    topSequences,
    categoryPriority,
  };
}
