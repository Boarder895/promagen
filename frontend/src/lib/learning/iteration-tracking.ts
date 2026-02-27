// src/lib/learning/iteration-tracking.ts
// ============================================================================
// ITERATION TRACKING — Session Sequence Analysis Engine
// ============================================================================
//
// Phase 7.2, Part 7.2b — Core Algorithm.
//
// Analyses sequential prompt attempts within a session. When a user builds a
// prompt, copies it, returns to modify, and copies again — this module diffs
// each consecutive pair and extracts:
//
// 1. Category fix order — which categories users change FIRST when fixing
// 2. Score jumps — which category additions produce the biggest improvements
// 3. Weak terms — terms that get REPLACED most often (candidates for demotion)
// 4. Final-attempt identification — the last attempt is highest-confidence
// 5. Iteration stats — average attempts, multi-attempt session percentage
//
// Pure computation layer — no I/O, no database access.
// Called by the nightly aggregation cron (Layer 11).
//
// Authority: docs/authority/phase-7.2-iteration-tracking-buildplan.md § 5
//
// Version: 1.0.0
// Created: 26 February 2026
//
// Existing features preserved: Yes.
// ============================================================================

import { LEARNING_CONSTANTS } from '@/lib/learning/constants';
import type { PromptEventRow } from '@/lib/learning/database';

// ============================================================================
// OUTPUT TYPES
// ============================================================================

/** A term that users frequently replace — candidate for suggestion demotion */
export interface WeakTermEntry {
  /** The term that gets replaced frequently */
  term: string;
  /** Category this term belongs to */
  category: string;
  /** Times this term was replaced (present → absent in next attempt) */
  replacedCount: number;
  /** Times this term was retained (present in both attempts) */
  retainedCount: number;
  /** replacedCount / (replacedCount + retainedCount) */
  replacementRate: number;
  /** Normalised weakness score 0–1 (higher = weaker) */
  weaknessScore: number;
  /** Most common replacement term (what users swap it for), null if no clear winner */
  topReplacement: string | null;
}

/** Category fix priority — how often and how impactfully users change this category */
export interface CategoryFixEntry {
  /** Category name (e.g. "lighting", "style") */
  category: string;
  /** How often this category was the FIRST one changed in multi-attempt sessions (0–1) */
  firstFixRate: number;
  /** Average score jump when this category is added/changed */
  avgScoreJump: number;
  /** Combined fix value: firstFixRate × 0.6 + normalisedScoreJump × 0.4 */
  fixValue: number;
}

/** Score impact of changing a specific category */
export interface ScoreJumpEntry {
  /** Category that was changed */
  category: string;
  /** Average score delta when this category changes */
  avgDelta: number;
  /** Number of observations */
  count: number;
}

/** Per-tier iteration analysis results */
export interface TierIterationInsights {
  /** Total sessions analysed in this tier */
  sessionCount: number;
  /** Sessions with 2+ attempts */
  multiAttemptCount: number;
  /** Average attempts per multi-attempt session */
  avgIterations: number;
  /** Fraction of sessions that required 2+ attempts (0–1) */
  multiAttemptPercent: number;
  /** Categories users fix first (sorted by fixValue descending) */
  categoryFixOrder: CategoryFixEntry[];
  /** Score impact of category changes (sorted by avgDelta descending) */
  scoreJumps: ScoreJumpEntry[];
  /** Terms with highest replacement rates (sorted by weaknessScore descending) */
  weakTerms: WeakTermEntry[];
  /** Number of events identified as final attempts */
  finalAttemptCount: number;
}

/** Top-level iteration insights (stored in learned_weights) */
export interface IterationInsightsData {
  version: string;
  generatedAt: string;
  eventCount: number;
  sessionCount: number;
  totalWeakTerms: number;
  tiers: Record<string, TierIterationInsights>;
  global: TierIterationInsights;
}

// ============================================================================
// INTERNAL TYPES
// ============================================================================

/** A session grouped from raw events, sorted by attempt_number */
interface Session {
  sessionId: string;
  tier: number;
  events: PromptEventRow[];
}

/** Accumulator for weak term tracking */
interface TermTracker {
  replacedCount: number;
  retainedCount: number;
  /** category → replacement term → count */
  replacements: Map<string, number>;
  category: string;
}

/** Accumulator for per-category score jumps */
interface ScoreJumpAccumulator {
  totalDelta: number;
  count: number;
}

/** Accumulator for per-category first-fix counts */
interface FirstFixAccumulator {
  count: number;
}

// ============================================================================
// MAIN COMPUTATION
// ============================================================================

/**
 * Analyse iteration patterns across all sessions.
 *
 * Groups events by session_id, orders by attempt_number, computes diffs
 * between consecutive attempts, and aggregates per tier + global.
 *
 * @param events — ALL prompt events (no score floor, from fetchAllEventsForAntiPatterns)
 * @returns Iteration insights data, or null if insufficient data
 */
export function computeIterationInsights(
  events: PromptEventRow[],
): IterationInsightsData | null {
  if (!events || events.length === 0) {
    return null;
  }

  // ── Step 1: Group events by session_id ──
  const sessionMap = new Map<string, PromptEventRow[]>();
  for (const evt of events) {
    const list = sessionMap.get(evt.session_id);
    if (list) {
      list.push(evt);
    } else {
      sessionMap.set(evt.session_id, [evt]);
    }
  }

  // ── Step 2: Build sorted sessions with gap filtering ──
  const sessions: Session[] = [];
  for (const [sessionId, sessionEvents] of sessionMap) {
    // Sort by attempt_number ascending
    sessionEvents.sort((a, b) => a.attempt_number - b.attempt_number);

    // Filter by time gap: split sessions where gap > SESSION_GAP_MINUTES
    const contiguousRuns = splitByTimeGap(sessionEvents);

    for (const run of contiguousRuns) {
      if (run.length === 0) continue;
      sessions.push({
        sessionId: run.length > 1 ? `${sessionId}_run${contiguousRuns.indexOf(run)}` : sessionId,
        tier: run[0]!.tier,
        events: run,
      });
    }
  }

  // ── Step 3: Separate into per-tier + global buckets ──
  const tierBuckets = new Map<string, Session[]>();
  const allSessions: Session[] = [];

  for (const session of sessions) {
    const tierKey = `tier_${session.tier}`;
    const bucket = tierBuckets.get(tierKey);
    if (bucket) {
      bucket.push(session);
    } else {
      tierBuckets.set(tierKey, [session]);
    }
    allSessions.push(session);
  }

  // ── Step 4: Compute per tier ──
  const tiers: Record<string, TierIterationInsights> = {};
  for (const [tierKey, tierSessions] of tierBuckets) {
    tiers[tierKey] = analyseSessions(tierSessions);
  }

  // ── Step 5: Compute global ──
  const global = analyseSessions(allSessions);

  // ── Step 6: Check minimum data threshold ──
  if (global.multiAttemptCount < LEARNING_CONSTANTS.ITERATION_MIN_MULTI_SESSIONS) {
    // Still return the data so it can be monitored, but weakTerms will be
    // naturally sparse since MIN_REPLACED_COUNT acts as a per-term gate.
  }

  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    eventCount: events.length,
    sessionCount: sessions.length,
    totalWeakTerms: global.weakTerms.length,
    tiers,
    global,
  };
}

// ============================================================================
// SESSION ANALYSIS (per-tier or global)
// ============================================================================

/**
 * Analyse a set of sessions to produce iteration insights.
 *
 * For each multi-attempt session, diffs consecutive attempts to detect:
 * - Which categories changed (and in what order)
 * - Score deltas per category change
 * - Which terms were replaced vs retained
 */
function analyseSessions(sessions: Session[]): TierIterationInsights {
  const C = LEARNING_CONSTANTS;

  // Accumulators
  const weakTermTrackers = new Map<string, TermTracker>();
  const scoreJumpAccumulators = new Map<string, ScoreJumpAccumulator>();
  const firstFixCounts = new Map<string, FirstFixAccumulator>();

  let multiAttemptCount = 0;
  let totalIterations = 0;
  let finalAttemptCount = 0;

  for (const session of sessions) {
    const { events } = session;

    // Single-attempt sessions contribute to session count but not to analysis
    if (events.length < 2) continue;

    multiAttemptCount++;
    totalIterations += events.length;
    finalAttemptCount++; // Last event in every multi-attempt session is a final attempt

    // Track whether we've seen the first fix in this session
    let firstFixFound = false;

    for (let i = 0; i < events.length - 1; i++) {
      const current = events[i]!;
      const next = events[i + 1]!;

      const scoreDelta = next.score - current.score;
      const diff = diffSelections(current.selections, next.selections);

      // ── Track category changes and score jumps ──
      for (const cat of diff.changedCategories) {
        // Score jump accumulator
        const jumpAcc = scoreJumpAccumulators.get(cat);
        if (jumpAcc) {
          jumpAcc.totalDelta += scoreDelta;
          jumpAcc.count++;
        } else {
          scoreJumpAccumulators.set(cat, { totalDelta: scoreDelta, count: 1 });
        }

        // First fix tracking (only first category changed in the session)
        if (!firstFixFound) {
          firstFixFound = true;
          const fixAcc = firstFixCounts.get(cat);
          if (fixAcc) {
            fixAcc.count++;
          } else {
            firstFixCounts.set(cat, { count: 1 });
          }
        }
      }

      // ── Track term replacements and retentions ──
      for (const { term, category } of diff.removedTerms) {
        const key = `${category}::${term}`;
        const tracker = weakTermTrackers.get(key) ?? {
          replacedCount: 0,
          retainedCount: 0,
          replacements: new Map<string, number>(),
          category,
        };
        tracker.replacedCount++;

        // Find what replaced this term in the same category
        const addedInCategory = diff.addedTerms.filter(a => a.category === category);
        for (const added of addedInCategory) {
          tracker.replacements.set(
            added.term,
            (tracker.replacements.get(added.term) ?? 0) + 1,
          );
        }

        weakTermTrackers.set(key, tracker);
      }

      for (const { term, category } of diff.retainedTerms) {
        const key = `${category}::${term}`;
        const tracker = weakTermTrackers.get(key) ?? {
          replacedCount: 0,
          retainedCount: 0,
          replacements: new Map<string, number>(),
          category,
        };
        tracker.retainedCount++;
        weakTermTrackers.set(key, tracker);
      }
    }
  }

  // ── Build weak terms list ──
  const weakTerms: WeakTermEntry[] = [];
  for (const [key, tracker] of weakTermTrackers) {
    const total = tracker.replacedCount + tracker.retainedCount;
    if (total === 0) continue;
    if (tracker.replacedCount < C.ITERATION_MIN_REPLACED_COUNT) continue;

    const replacementRate = tracker.replacedCount / total;
    if (replacementRate < C.ITERATION_WEAK_TERM_THRESHOLD) continue;

    // Weakness score: normalised 0–1, clamp(rate / 0.60, 0, 1)
    const weaknessScore = Math.min(1.0, round4(replacementRate / 0.60));

    // Top replacement: most common replacement term
    let topReplacement: string | null = null;
    let topReplacementCount = 0;
    for (const [rep, count] of tracker.replacements) {
      if (count > topReplacementCount) {
        topReplacementCount = count;
        topReplacement = rep;
      }
    }

    const term = key.split('::')[1] ?? key;
    weakTerms.push({
      term,
      category: tracker.category,
      replacedCount: tracker.replacedCount,
      retainedCount: tracker.retainedCount,
      replacementRate: round4(replacementRate),
      weaknessScore,
      topReplacement,
    });
  }

  // Sort by weaknessScore desc, trim to max per tier
  weakTerms.sort((a, b) => b.weaknessScore - a.weaknessScore);
  const trimmedWeakTerms = weakTerms.slice(0, C.ITERATION_MAX_WEAK_TERMS_PER_TIER);

  // ── Build score jumps list ──
  const scoreJumps: ScoreJumpEntry[] = [];
  for (const [category, acc] of scoreJumpAccumulators) {
    if (acc.count === 0) continue;
    scoreJumps.push({
      category,
      avgDelta: round4(acc.totalDelta / acc.count),
      count: acc.count,
    });
  }
  scoreJumps.sort((a, b) => b.avgDelta - a.avgDelta);

  // ── Build category fix order ──
  // Normalise first-fix rates and combine with score jumps
  const maxScoreJump = Math.max(...scoreJumps.map(j => Math.abs(j.avgDelta)), 1);

  const categoryFixOrder: CategoryFixEntry[] = [];
  const allCategories = new Set([
    ...firstFixCounts.keys(),
    ...scoreJumpAccumulators.keys(),
  ]);

  for (const category of allCategories) {
    const firstFix = firstFixCounts.get(category);
    const jump = scoreJumpAccumulators.get(category);

    const firstFixRate = multiAttemptCount > 0
      ? round4((firstFix?.count ?? 0) / multiAttemptCount)
      : 0;

    const avgScoreJump = jump && jump.count > 0
      ? round4(jump.totalDelta / jump.count)
      : 0;

    // Normalise score jump to 0–1 range for combination
    const normalisedJump = maxScoreJump > 0
      ? Math.max(0, round4(avgScoreJump / maxScoreJump))
      : 0;

    const fixValue = round4(firstFixRate * 0.6 + normalisedJump * 0.4);

    categoryFixOrder.push({
      category,
      firstFixRate,
      avgScoreJump,
      fixValue,
    });
  }
  categoryFixOrder.sort((a, b) => b.fixValue - a.fixValue);

  // ── Build result ──
  return {
    sessionCount: sessions.length,
    multiAttemptCount,
    avgIterations: multiAttemptCount > 0
      ? round4(totalIterations / multiAttemptCount)
      : 0,
    multiAttemptPercent: sessions.length > 0
      ? round4(multiAttemptCount / sessions.length)
      : 0,
    categoryFixOrder,
    scoreJumps,
    weakTerms: trimmedWeakTerms,
    finalAttemptCount,
  };
}

// ============================================================================
// SELECTION DIFFING
// ============================================================================

/** Result of diffing two consecutive attempts' selections */
interface SelectionDiff {
  /** Categories that had any change (add, remove, or swap) */
  changedCategories: string[];
  /** Terms present in current but absent in next (same category) */
  removedTerms: Array<{ term: string; category: string }>;
  /** Terms present in next but absent in current (same category) */
  addedTerms: Array<{ term: string; category: string }>;
  /** Terms present in both current and next (same category) */
  retainedTerms: Array<{ term: string; category: string }>;
}

/**
 * Compute the diff between two consecutive attempts' selections.
 *
 * Compares per-category: for each category, finds which terms were
 * added, removed, or retained between the two attempts.
 */
function diffSelections(
  current: Record<string, string[]>,
  next: Record<string, string[]>,
): SelectionDiff {
  const changedCategories: string[] = [];
  const removedTerms: Array<{ term: string; category: string }> = [];
  const addedTerms: Array<{ term: string; category: string }> = [];
  const retainedTerms: Array<{ term: string; category: string }> = [];

  // All categories across both attempts
  const allCategories = new Set([
    ...Object.keys(current),
    ...Object.keys(next),
  ]);

  for (const category of allCategories) {
    const currentTerms = new Set(current[category] ?? []);
    const nextTerms = new Set(next[category] ?? []);

    let changed = false;

    // Removed: in current but not in next
    for (const term of currentTerms) {
      if (!nextTerms.has(term)) {
        removedTerms.push({ term, category });
        changed = true;
      } else {
        retainedTerms.push({ term, category });
      }
    }

    // Added: in next but not in current
    for (const term of nextTerms) {
      if (!currentTerms.has(term)) {
        addedTerms.push({ term, category });
        changed = true;
      }
    }

    if (changed) {
      changedCategories.push(category);
    }
  }

  return { changedCategories, removedTerms, addedTerms, retainedTerms };
}

// ============================================================================
// SESSION GAP SPLITTING
// ============================================================================

/**
 * Split a sequence of events into contiguous runs based on time gaps.
 *
 * If two consecutive attempts are more than SESSION_GAP_MINUTES apart,
 * they're treated as separate sessions (user came back hours/days later,
 * sessionStorage may have persisted the same session_id).
 *
 * @param events — Events from a single session_id, sorted by attempt_number
 * @returns Array of contiguous runs
 */
function splitByTimeGap(events: PromptEventRow[]): PromptEventRow[][] {
  if (events.length <= 1) return [events];

  const gapMs = LEARNING_CONSTANTS.ITERATION_SESSION_GAP_MINUTES * 60 * 1000;
  const runs: PromptEventRow[][] = [];
  let currentRun: PromptEventRow[] = [events[0]!];

  for (let i = 1; i < events.length; i++) {
    const prev = events[i - 1]!;
    const curr = events[i]!;

    const prevTime = toTimestamp(prev.created_at);
    const currTime = toTimestamp(curr.created_at);

    if (prevTime > 0 && currTime > 0 && currTime - prevTime > gapMs) {
      // Gap too large — start a new run
      runs.push(currentRun);
      currentRun = [curr];
    } else {
      currentRun.push(curr);
    }
  }

  runs.push(currentRun);
  return runs;
}

// ============================================================================
// FINAL-ATTEMPT IDENTIFICATION (exported for cron pre-processing)
// ============================================================================

/**
 * Identify final-attempt event IDs across all sessions.
 *
 * A "final attempt" is the highest attempt_number event in a session
 * with 2+ events. Single-attempt sessions are excluded (not multi-attempt).
 *
 * Used by the cron to enrich events with isFinalAttempt flag before
 * passing to anti-pattern/collision/iteration engines.
 *
 * @param events — ALL prompt events
 * @returns Set of event IDs that are final attempts
 */
export function identifyFinalAttempts(events: PromptEventRow[]): Set<string> {
  const result = new Set<string>();
  if (!events || events.length === 0) return result;

  // Group by session_id, find the max attempt event per session
  const sessionMap = new Map<string, PromptEventRow[]>();
  for (const evt of events) {
    const list = sessionMap.get(evt.session_id);
    if (list) {
      list.push(evt);
    } else {
      sessionMap.set(evt.session_id, [evt]);
    }
  }

  for (const sessionEvents of sessionMap.values()) {
    if (sessionEvents.length < 2) continue; // Skip single-attempt sessions

    // Apply time gap splitting
    const runs = splitByTimeGap(
      sessionEvents.sort((a, b) => a.attempt_number - b.attempt_number),
    );

    for (const run of runs) {
      if (run.length < 2) continue;
      // Last event in this contiguous run is the final attempt
      const lastEvent = run[run.length - 1]!;
      result.add(lastEvent.id);
    }
  }

  return result;
}

/**
 * Identify session_ids that have 2+ events (multi-attempt sessions).
 *
 * Used by the cron to set isMultiAttemptSession flag on events.
 *
 * @param events — ALL prompt events
 * @returns Set of session_ids that are multi-attempt
 */
export function identifyMultiAttemptSessions(events: PromptEventRow[]): Set<string> {
  const result = new Set<string>();
  if (!events || events.length === 0) return result;

  const sessionCounts = new Map<string, number>();
  for (const evt of events) {
    sessionCounts.set(evt.session_id, (sessionCounts.get(evt.session_id) ?? 0) + 1);
  }

  for (const [sessionId, count] of sessionCounts) {
    if (count >= 2) {
      result.add(sessionId);
    }
  }

  return result;
}

// ============================================================================
// UTILITIES
// ============================================================================

/** Convert Date or ISO string to epoch ms. Returns 0 for invalid input. */
function toTimestamp(dateOrString: Date | string): number {
  if (dateOrString instanceof Date) return dateOrString.getTime();
  if (typeof dateOrString === 'string') {
    const ms = Date.parse(dateOrString);
    return isNaN(ms) ? 0 : ms;
  }
  return 0;
}

/** Round to 4 decimal places. */
function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
