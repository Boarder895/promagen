// src/lib/analytics/prompt-quality-correlation.ts
// ============================================================================
// PROMPT QUALITY VS CONVERSION CORRELATION (v1.1.0)
// ============================================================================
// v1.1.0: Added input validation (score clamped 0–100, tier clamped 1–4).
//         Docs tightened to match actual behaviour.
//
// Two-API design:
// - recordPromptQuality() — WRITE: called by scoring pipeline when a prompt
//   is scored. Only updates fields that are explicitly passed.
// - getPromptQualitySnapshot() — READ: called by trackProviderOutbound at
//   conversion time. Returns null if no quality data was recorded.
//
// Authority: analytics-build-plan-v1.3-FINAL.md §9 Extra 4
// Existing features preserved: Yes
// ============================================================================

const QUALITY_KEY = 'promagen:prompt-quality-state';

// ============================================================================
// TYPES
// ============================================================================

export interface PromptQualitySnapshot {
  prompt_quality_score: number | null;
  prompt_length_at_copy: number | null;
  platform_tier_at_copy: number | null;
  was_optimised: boolean;
  prompts_scored_in_session: number;
  best_score_in_session: number | null;
}

interface QualityState {
  lastScore: number | null;
  lastLength: number | null;
  lastTier: number | null;
  wasOptimised: boolean;
  scoredCount: number;
  bestScore: number | null;
}

// ============================================================================
// VALIDATION
// ============================================================================

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function clampTier(tier: number): number {
  return Math.max(1, Math.min(4, Math.round(tier)));
}

// ============================================================================
// WRITE API — called by scoring pipeline
// ============================================================================

/**
 * recordPromptQuality
 *
 * Called when a prompt is scored by the BQI pipeline. Only updates fields
 * that are explicitly passed — partial updates are safe.
 *
 * - score: clamped to 0–100 (integer)
 * - tier: clamped to 1–4 (integer)
 * - length: prompt character count at time of scoring/copy
 * - optimised: whether Call 3 was applied
 *
 * Note: scoredCount only increments when score is provided, because that
 * is the only signal that the scoring pipeline actually ran.
 */
export function recordPromptQuality(params: {
  score?: number;
  length?: number;
  tier?: number;
  optimised?: boolean;
}): void {
  if (typeof window === 'undefined') return;

  const state = readState();

  if (params.score !== undefined) {
    const clamped = clampScore(params.score);
    state.lastScore = clamped;
    state.scoredCount++;
    if (state.bestScore === null || clamped > state.bestScore) {
      state.bestScore = clamped;
    }
  }

  if (params.length !== undefined) state.lastLength = Math.max(0, Math.round(params.length));
  if (params.tier !== undefined) state.lastTier = clampTier(params.tier);
  if (params.optimised !== undefined) state.wasOptimised = params.optimised;

  writeState(state);
}

// ============================================================================
// READ API — called by trackProviderOutbound at conversion time
// ============================================================================

/**
 * getPromptQualitySnapshot
 *
 * Returns the current prompt quality state for attachment to the
 * conversion event. Returns null if no quality data was recorded.
 */
export function getPromptQualitySnapshot(): PromptQualitySnapshot | null {
  const state = readState();
  if (state.lastScore === null && state.lastLength === null) return null;

  return {
    prompt_quality_score: state.lastScore,
    prompt_length_at_copy: state.lastLength,
    platform_tier_at_copy: state.lastTier,
    was_optimised: state.wasOptimised,
    prompts_scored_in_session: state.scoredCount,
    best_score_in_session: state.bestScore,
  };
}

// ============================================================================
// INTERNALS
// ============================================================================

function readState(): QualityState {
  if (typeof window === 'undefined') return freshState();
  try {
    const raw = sessionStorage.getItem(QUALITY_KEY);
    if (!raw) return freshState();
    return JSON.parse(raw) as QualityState;
  } catch {
    return freshState();
  }
}

function writeState(state: QualityState): void {
  if (typeof window === 'undefined') return;
  try { sessionStorage.setItem(QUALITY_KEY, JSON.stringify(state)); }
  catch { /* silent */ }
}

function freshState(): QualityState {
  return {
    lastScore: null,
    lastLength: null,
    lastTier: null,
    wasOptimised: false,
    scoredCount: 0,
    bestScore: null,
  };
}
