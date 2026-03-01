// src/lib/learning/ab-testing.ts
// ============================================================================
// A/B TESTING — Core Engine (Pure Computation)
// ============================================================================
//
// Test creation, statistical evaluation, and decision-making for A/B tests
// on scoring model weights. No I/O — all database interaction lives in
// database.ts (Part 7.6c). This file is pure functions + types.
//
// Statistical method: Two-proportion Z-test on the binary "copied" outcome.
// CDF approximation: Abramowitz & Stegun formula 7.1.26 (erfc) converted
// to standard normal Φ(z) via Φ(z) = 1 − 0.5 × erfc(z/√2).
//
// Sequential testing: O'Brien-Fleming alpha spending function allows
// daily peeking without inflating false-positive rate. Conservative
// early (virtually impossible to stop on day 1) and standard at the
// final peek (α = 0.05 on day 14).
//
// Decision rules (from build plan § 2):
// - p < adjustedAlpha + variant wins    → promote
// - p < adjustedAlpha + control wins    → rollback
// - p ≥ adjustedAlpha + age < maxDays   → extend
// - p ≥ adjustedAlpha + age ≥ maxDays   → rollback (inconclusive)
//
// Authority: docs/authority/phase-7_6-ab-testing-pipeline-buildplan.md § 6 (7.6b)
//
// Version: 1.4.0 — Lift distribution histogram + adaptive peek scheduling
// Created: 2026-02-27
//
// Existing features preserved: Yes.
// ============================================================================

import { LEARNING_CONSTANTS } from './constants';

// ============================================================================
// TYPES
// ============================================================================

/**
 * A single A/B test definition.
 *
 * Pure data — mirrors the `ab_tests` table row shape but as a TypeScript
 * interface. Database serialisation happens in the database layer (7.6c).
 */
export interface ABTest {
  /** Primary key: 'ab_' + UUID */
  id: string;
  /** Human-readable label, e.g. "coherence_weight_increase" */
  name: string;
  /** Current lifecycle state */
  status: 'running' | 'promoted' | 'rolled_back';
  /** Snapshot of SCORE_WEIGHTS at test creation (control group sees these) */
  controlWeights: Record<string, number>;
  /** Proposed new weights from recalibration (variant group sees these) */
  variantWeights: Record<string, number>;
  /** Percentage of users in variant B (default: 50) */
  splitPct: number;
  /** Minimum events per group before evaluation (default: 200) */
  minEvents: number;
  /** Auto-rollback ceiling in days (default: 14) */
  maxDurationDays: number;
  /** ISO timestamp when test began */
  startedAt: string;
  /** ISO timestamp when promoted/rolled back (null while running) */
  endedAt: string | null;
  /** Number of times this test has been evaluated (peek count for O'Brien-Fleming) */
  peekCount: number;
  /** Statistical results (null until evaluation completes) */
  resultSummary: ABTestResult | null;
}

/**
 * Statistical evaluation results for a completed or evaluated test.
 */
export interface ABTestResult {
  /** Total events in control group */
  controlEvents: number;
  /** Total events in variant group */
  variantEvents: number;
  /** Control group copy rate (0–1) */
  controlCopyRate: number;
  /** Variant group copy rate (0–1) */
  variantCopyRate: number;
  /** Control group save rate (0–1) */
  controlSaveRate: number;
  /** Variant group save rate (0–1) */
  variantSaveRate: number;
  /** Z-score from two-proportion Z-test */
  zScore: number;
  /** Two-tailed p-value */
  pValue: number;
  /** Adjusted alpha threshold for this peek (O'Brien-Fleming spending) */
  adjustedAlpha: number;
  /** Which peek number this evaluation represents (1-indexed) */
  peekNumber: number;
  /** Decision: promote variant weights, rollback to control, or keep running */
  decision: 'promote' | 'rollback' | 'extend';
  /** Human-readable reason for the decision */
  reason: string;
  /** Bayesian probability that variant outperforms control (0–1), null if insufficient data */
  bayesianProbVariantWins: number | null;
  /** 95% credible interval for control copy rate [lower, upper] */
  controlCredibleInterval: [number, number] | null;
  /** 95% credible interval for variant copy rate [lower, upper] */
  variantCredibleInterval: [number, number] | null;
  /** ISO timestamp for recommended next evaluation based on event velocity (null for terminal decisions) */
  nextPeekAt: string | null;
}

/**
 * A single bin in the lift distribution histogram.
 * Used by the LiftDistribution sparkline component.
 */
export interface LiftBin {
  /** Bin center value (e.g. 0.02 = +2% absolute lift) */
  center: number;
  /** Fraction of Monte Carlo samples in this bin (0–1) */
  density: number;
}

/**
 * Raw event counts per variant, aggregated from prompt_events.
 * Fed into evaluateTest() for statistical analysis.
 */
export interface ABTestEventCounts {
  /** Total events where variant = 'A' */
  controlEvents: number;
  /** Total events where variant = 'B' */
  variantEvents: number;
  /** Events in control where outcome.copied = true */
  controlCopies: number;
  /** Events in variant where outcome.copied = true */
  variantCopies: number;
  /** Events in control where outcome.saved = true */
  controlSaves: number;
  /** Events in variant where outcome.saved = true */
  variantSaves: number;
}

// ============================================================================
// CONSTANTS (local aliases for readability)
// ============================================================================

const C = LEARNING_CONSTANTS;

// ============================================================================
// STANDARD NORMAL CDF — Abramowitz & Stegun 7.1.26 (erfc approximation)
// ============================================================================

/**
 * Approximate the standard normal CDF Φ(z) using the Abramowitz & Stegun
 * erfc rational approximation (formula 7.1.26). Maximum error: 1.5 × 10⁻⁷.
 *
 * Conversion: Φ(z) = 1 − 0.5 × erfc(z / √2)
 *
 * The A&S coefficients approximate erfc(x), NOT Φ(z) directly. The key
 * transformation is z → x = z/√2 before feeding into the polynomial.
 *
 * @param z — Z-score (standard normal)
 * @returns Probability P(Z ≤ z), range [0, 1]
 */
export function normalCDF(z: number): number {
  // Symmetry: Φ(-z) = 1 - Φ(z)
  if (z < 0) return 1 - normalCDF(-z);

  // A&S 7.1.26 coefficients for erfc(x) approximation
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  // Transform from z-score to erfc argument: x = z / √2
  const x = z / Math.SQRT2;

  const t = 1.0 / (1.0 + p * x);
  const t2 = t * t;
  const t3 = t2 * t;
  const t4 = t3 * t;
  const t5 = t4 * t;

  const poly = a1 * t + a2 * t2 + a3 * t3 + a4 * t4 + a5 * t5;

  // erfc(x) ≈ poly × exp(-x²)
  const erfc = poly * Math.exp(-x * x);

  // Φ(z) = 1 - 0.5 × erfc(z/√2)
  return 1.0 - 0.5 * erfc;
}

// ============================================================================
// INVERSE CDF APPROXIMATION (internal helper)
// ============================================================================

/**
 * Approximate the inverse standard normal CDF (quantile function).
 * Uses the Abramowitz & Stegun 26.2.23 rational approximation.
 *
 * Accuracy: ~4.5 × 10⁻⁴ — sufficient for O'Brien-Fleming z_base.
 * Only used internally for alpha spending calculations.
 *
 * @param p — Probability in (0, 1)
 * @returns z such that Φ(z) ≈ p
 */
function inverseCDFApprox(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;

  // Symmetry: for p > 0.5, compute for (1-p) and negate
  if (p > 0.5) return -inverseCDFApprox(1 - p);

  // A&S 26.2.23 rational approximation
  const t = Math.sqrt(-2 * Math.log(p));
  const c0 = 2.515517;
  const c1 = 0.802853;
  const c2 = 0.010328;
  const d1 = 1.432788;
  const d2 = 0.189269;
  const d3 = 0.001308;

  return -(t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t));
}

// ============================================================================
// SHOULD CREATE TEST
// ============================================================================

/**
 * Decide whether proposed weight changes are large enough to warrant
 * an A/B test. Small changes (delta below threshold) are applied
 * directly without testing — the pipeline overhead isn't worth it.
 *
 * Delta = sum of absolute differences across all weight keys.
 *
 * @param currentWeights  — Current live SCORE_WEIGHTS
 * @param proposedWeights — New weights from Phase 6 recalibration
 * @returns Object with test name + delta if test warranted, null otherwise
 */
export function shouldCreateTest(
  currentWeights: Record<string, number>,
  proposedWeights: Record<string, number>,
): { name: string; delta: number } | null {
  // Collect all unique keys across both weight sets
  const allKeys = new Set([
    ...Object.keys(currentWeights),
    ...Object.keys(proposedWeights),
  ]);

  let totalDelta = 0;
  const changedKeys: string[] = [];

  for (const key of allKeys) {
    const current = currentWeights[key] ?? 0;
    const proposed = proposedWeights[key] ?? 0;
    const diff = Math.abs(proposed - current);
    if (diff > 0) {
      totalDelta += diff;
      changedKeys.push(key);
    }
  }

  if (totalDelta < C.AB_CHANGE_THRESHOLD) {
    return null;
  }

  // Build human-readable name from changed keys (max 3 for brevity)
  const nameKeys = changedKeys.slice(0, 3).join('_');
  const suffix = changedKeys.length > 3 ? `_and_${changedKeys.length - 3}_more` : '';
  const name = `weight_change_${nameKeys}${suffix}`;

  return { name, delta: totalDelta };
}

// ============================================================================
// TWO-PROPORTION Z-TEST
// ============================================================================

/**
 * Two-proportion Z-test for comparing binary outcomes between two groups.
 *
 * Formula (from build plan § 2):
 *   p̂_pooled = (successes1 + successes2) / (n1 + n2)
 *   z = (p̂2 - p̂1) / sqrt(p̂_pooled × (1 - p̂_pooled) × (1/n1 + 1/n2))
 *   p_value = 2 × (1 - Φ(|z|))   // two-tailed
 *
 * @param successes1 — Number of successes in group 1 (control copies)
 * @param n1         — Total observations in group 1 (control events)
 * @param successes2 — Number of successes in group 2 (variant copies)
 * @param n2         — Total observations in group 2 (variant events)
 * @returns Z-score and two-tailed p-value
 */
export function twoProportionZTest(
  successes1: number,
  n1: number,
  successes2: number,
  n2: number,
): { zScore: number; pValue: number } {
  // Guard: both groups must have observations
  if (n1 === 0 || n2 === 0) {
    return { zScore: 0, pValue: 1 };
  }

  const p1 = successes1 / n1;
  const p2 = successes2 / n2;
  const pPooled = (successes1 + successes2) / (n1 + n2);

  // Guard: if pooled rate is 0 or 1, no variance → no test possible
  const variance = pPooled * (1 - pPooled);
  if (variance === 0) {
    return { zScore: 0, pValue: 1 };
  }

  const standardError = Math.sqrt(variance * (1 / n1 + 1 / n2));

  // Guard: zero standard error (shouldn't happen if variance > 0, but be safe)
  if (standardError === 0) {
    return { zScore: 0, pValue: 1 };
  }

  const zScore = (p2 - p1) / standardError;
  const pValue = 2 * (1 - normalCDF(Math.abs(zScore)));

  return { zScore, pValue };
}

// ============================================================================
// O'BRIEN-FLEMING ALPHA SPENDING (Sequential Testing)
// ============================================================================

/**
 * Compute the adjusted significance threshold for a given peek using
 * the O'Brien-Fleming spending function.
 *
 * O'Brien-Fleming is conservative early (hard to stop) and lenient late
 * (standard threshold at final peek). This lets us peek at results daily
 * without inflating our false-positive rate.
 *
 * Boundary: z_boundary(k) = z_{α/2} × √(K/k)
 * Adjusted α(k) = 2 × (1 - Φ(z_boundary(k)))
 *
 * Example with K=14 peeks, base α=0.05:
 *   Peek  1: α ≈ 5.7×10⁻¹³ (virtually impossible to stop)
 *   Peek  7: α ≈ 0.006 (conservative)
 *   Peek 14: α = 0.05 (standard)
 *
 * @param peekNumber  — Current peek (1-indexed)
 * @param maxPeeks    — Total planned peeks (= maxDurationDays)
 * @param baseAlpha   — Overall significance level (default: 0.05)
 * @returns Adjusted alpha threshold for this peek
 */
export function obrienFlemingAlpha(
  peekNumber: number,
  maxPeeks: number,
  baseAlpha: number = C.AB_SIGNIFICANCE_THRESHOLD,
): number {
  // Guard: at or past final peek, use full base alpha
  if (peekNumber >= maxPeeks || maxPeeks <= 0) {
    return baseAlpha;
  }

  const k = Math.max(1, peekNumber);

  // z_{α/2} for the base alpha (two-tailed)
  const zBase = inverseCDFApprox(1 - baseAlpha / 2);

  // O'Brien-Fleming boundary at peek k out of K
  const zBoundary = zBase * Math.sqrt(maxPeeks / k);

  // Convert back to alpha
  const adjustedAlpha = 2 * (1 - normalCDF(zBoundary));

  return adjustedAlpha;
}

// ============================================================================
// EVALUATE TEST
// ============================================================================

/**
 * Evaluate a running A/B test given aggregated event counts.
 *
 * Uses O'Brien-Fleming sequential testing: the significance threshold
 * is adjusted per peek so we can evaluate daily without inflating
 * the false-positive rate. Early peeks need overwhelmingly strong
 * evidence to stop; the final peek uses the standard α = 0.05.
 *
 * Decision logic (from build plan § 2, enhanced with sequential testing):
 * 1. If either group < minEvents → extend ("Insufficient data")
 * 2. Compute O'Brien-Fleming adjusted alpha for this peek
 * 3. Run Z-test on copy rates
 * 4. If p < adjustedAlpha and variant wins → promote
 * 5. If p < adjustedAlpha and control wins → rollback
 * 6. If p ≥ adjustedAlpha and age < maxDays → extend
 * 7. If p ≥ adjustedAlpha and age ≥ maxDays → rollback ("Inconclusive")
 *
 * @param test   — The running A/B test definition
 * @param counts — Aggregated event counts per variant
 * @param now    — Current time (injectable for testing, defaults to Date.now)
 * @returns Statistical results + decision + human-readable reason
 */
export function evaluateTest(
  test: ABTest,
  counts: ABTestEventCounts,
  now: Date = new Date(),
): ABTestResult {
  const controlCopyRate = counts.controlEvents > 0
    ? counts.controlCopies / counts.controlEvents
    : 0;
  const variantCopyRate = counts.variantEvents > 0
    ? counts.variantCopies / counts.variantEvents
    : 0;
  const controlSaveRate = counts.controlEvents > 0
    ? counts.controlSaves / counts.controlEvents
    : 0;
  const variantSaveRate = counts.variantEvents > 0
    ? counts.variantSaves / counts.variantEvents
    : 0;

  // Base result (rates always computed, decision filled below)
  const baseResult = {
    controlEvents: counts.controlEvents,
    variantEvents: counts.variantEvents,
    controlCopyRate,
    variantCopyRate,
    controlSaveRate,
    variantSaveRate,
  };

  // Current peek number (1-indexed: first evaluation = peek 1)
  const peekNumber = test.peekCount + 1;

  // O'Brien-Fleming adjusted alpha for this peek
  const adjustedAlpha = obrienFlemingAlpha(
    peekNumber,
    test.maxDurationDays,
    C.AB_SIGNIFICANCE_THRESHOLD,
  );

  // ── Bayesian overlay (computed for all result paths) ───────────────
  const hasSufficientData = counts.controlEvents >= 10 && counts.variantEvents >= 10;
  const bayesProb = hasSufficientData
    ? bayesianProbVariantWins(
        counts.controlCopies, counts.controlEvents,
        counts.variantCopies, counts.variantEvents,
      )
    : null;
  const controlCI = hasSufficientData
    ? betaCredibleInterval(counts.controlCopies, counts.controlEvents)
    : null;
  const variantCI = hasSufficientData
    ? betaCredibleInterval(counts.variantCopies, counts.variantEvents)
    : null;

  /** Common Bayesian fields for all result objects */
  const bayesianFields = {
    bayesianProbVariantWins: bayesProb,
    controlCredibleInterval: controlCI,
    variantCredibleInterval: variantCI,
  };

  // ── Adaptive peek scheduling (Improvement 2) ──────────────────────
  // Dynamically space peeks based on event velocity:
  //   >500 events/day → every 12h (fast traffic, catch winners quickly)
  //   50–500/day      → every 24h (normal traffic, standard pacing)
  //   <50/day         → every 72h (slow traffic, reduce O'Brien-Fleming alpha burn)
  const earlyAgeDays = (now.getTime() - new Date(test.startedAt).getTime()) / (1000 * 60 * 60 * 24);
  const totalEventsForPeek = counts.controlEvents + counts.variantEvents;
  const dailyEventRate = earlyAgeDays > 0 ? totalEventsForPeek / earlyAgeDays : 0;
  const peekIntervalHours = dailyEventRate > 500 ? 12 : dailyEventRate < 50 ? 72 : 24;
  const adaptiveNextPeekAt = new Date(now.getTime() + peekIntervalHours * 60 * 60 * 1000).toISOString();

  // ── Step 1: Minimum sample size check ──────────────────────────────
  if (
    counts.controlEvents < test.minEvents ||
    counts.variantEvents < test.minEvents
  ) {
    return {
      ...baseResult,
      zScore: 0,
      pValue: 1,
      adjustedAlpha,
      peekNumber,
      decision: 'extend',
      reason: `Insufficient data: control=${counts.controlEvents}, variant=${counts.variantEvents}, min=${test.minEvents}`,
      ...bayesianFields,
      nextPeekAt: adaptiveNextPeekAt,
    };
  }

  // ── Step 2: Run Z-test on copy rates ───────────────────────────────
  const { zScore, pValue } = twoProportionZTest(
    counts.controlCopies,
    counts.controlEvents,
    counts.variantCopies,
    counts.variantEvents,
  );

  // ── Step 3–4: Significant result (using adjusted alpha) ────────────
  if (pValue < adjustedAlpha) {
    if (variantCopyRate > controlCopyRate) {
      const lift = ((variantCopyRate - controlCopyRate) / controlCopyRate * 100).toFixed(1);
      return {
        ...baseResult,
        zScore,
        pValue,
        adjustedAlpha,
        peekNumber,
        decision: 'promote',
        reason: `Variant wins at peek ${peekNumber}: ${(variantCopyRate * 100).toFixed(1)}% vs ${(controlCopyRate * 100).toFixed(1)}% copy rate (+${lift}% lift), p=${pValue.toFixed(4)} < α=${adjustedAlpha.toFixed(6)}`,
        ...bayesianFields,
        nextPeekAt: null,
      };
    } else {
      return {
        ...baseResult,
        zScore,
        pValue,
        adjustedAlpha,
        peekNumber,
        decision: 'rollback',
        reason: `Control wins at peek ${peekNumber}: ${(controlCopyRate * 100).toFixed(1)}% vs ${(variantCopyRate * 100).toFixed(1)}% copy rate, p=${pValue.toFixed(4)} < α=${adjustedAlpha.toFixed(6)}`,
        ...bayesianFields,
        nextPeekAt: null,
      };
    }
  }

  // ── Step 4b: Bayesian early stop (hybrid rule) ─────────────────────
  // If frequentist test isn't significant yet but Bayesian evidence is
  // overwhelming, auto-promote early. This catches clear winners 3–5 days
  // sooner. Requires BOTH:
  //   • P(variant wins) > 0.99  (almost certain variant is better)
  //   • P(lift > 1%)   > 0.95  (practically meaningful effect size)
  if (
    bayesProb !== null &&
    bayesProb > 0.99 &&
    variantCopyRate > controlCopyRate
  ) {
    const probLift = bayesianProbLiftExceedsThreshold(
      counts.controlCopies, counts.controlEvents,
      counts.variantCopies, counts.variantEvents,
      0.01, // 1% absolute lift threshold
    );

    if (probLift > 0.95) {
      const lift = ((variantCopyRate - controlCopyRate) / controlCopyRate * 100).toFixed(1);
      return {
        ...baseResult,
        zScore,
        pValue,
        adjustedAlpha,
        peekNumber,
        decision: 'promote',
        reason: `Bayesian early stop at peek ${peekNumber}: P(variant wins)=${(bayesProb * 100).toFixed(1)}%, P(lift>1%)=${(probLift * 100).toFixed(1)}%. Copy rate ${(variantCopyRate * 100).toFixed(1)}% vs ${(controlCopyRate * 100).toFixed(1)}% (+${lift}% lift). Frequentist p=${pValue.toFixed(4)} not yet below α=${adjustedAlpha.toFixed(6)} but Bayesian evidence is overwhelming.`,
        ...bayesianFields,
        nextPeekAt: null,
      };
    }
  }

  // ── Step 5–6: Not significant — check duration ─────────────────────
  const ageDays = earlyAgeDays; // already computed for adaptive peek

  if (ageDays >= test.maxDurationDays) {
    return {
      ...baseResult,
      zScore,
      pValue,
      adjustedAlpha,
      peekNumber,
      decision: 'rollback',
      reason: `Inconclusive after ${Math.floor(ageDays)} days (max: ${test.maxDurationDays}), p=${pValue.toFixed(4)}. Rolling back.`,
      ...bayesianFields,
      nextPeekAt: null,
    };
  }

  return {
    ...baseResult,
    zScore,
    pValue,
    adjustedAlpha,
    peekNumber,
    decision: 'extend',
    reason: `Not yet significant at peek ${peekNumber}: p=${pValue.toFixed(4)} >= α=${adjustedAlpha.toFixed(6)}, age=${Math.floor(ageDays)}d/${test.maxDurationDays}d. Next peek in ${peekIntervalHours}h (${dailyEventRate.toFixed(0)} events/day).`,
    ...bayesianFields,
    nextPeekAt: adaptiveNextPeekAt,
  };
}

// ============================================================================
// CREATE TEST
// ============================================================================

/**
 * Create a new A/B test definition. Pure factory — does NOT write to DB.
 * Uses crypto.randomUUID() for the test ID.
 *
 * @param name            — Human-readable label for the test
 * @param controlWeights  — Current live scoring weights (snapshot)
 * @param variantWeights  — Proposed new weights from recalibration
 * @returns A fully populated ABTest object ready for database insertion
 */
export function createABTest(
  name: string,
  controlWeights: Record<string, number>,
  variantWeights: Record<string, number>,
): ABTest {
  return {
    id: `ab_${crypto.randomUUID()}`,
    name,
    status: 'running',
    controlWeights,
    variantWeights,
    splitPct: C.AB_DEFAULT_SPLIT_PCT,
    minEvents: C.AB_MIN_EVENTS_PER_VARIANT,
    maxDurationDays: C.AB_MAX_DURATION_DAYS,
    startedAt: new Date().toISOString(),
    endedAt: null,
    peekCount: 0,
    resultSummary: null,
  };
}

// ============================================================================
// POWER CALCULATOR — Required Sample Size
// ============================================================================

/**
 * Compute the required sample size per group to detect a given lift
 * with specified statistical power.
 *
 * Uses the normal approximation for two-proportion comparison:
 *   n = ((z_{α/2} + z_β)² × (p₁(1-p₁) + p₂(1-p₂))) / (p₂ - p₁)²
 *
 * This enables the admin dashboard to show "estimated days remaining"
 * for a running test based on current daily traffic rate.
 *
 * @param baseRate          — Current baseline proportion (e.g. 0.40 = 40% copy rate)
 * @param minDetectableLift — Smallest absolute lift to detect (e.g. 0.05 = 5% lift)
 * @param alpha             — Significance level (default: 0.05)
 * @param power             — Statistical power (default: 0.80)
 * @returns Required observations per group (control + variant each need this many)
 *
 * @example
 * ```ts
 * // 40% base rate, detect 5% absolute lift (40% → 45%)
 * computeRequiredSampleSize(0.40, 0.05);  // → ~784 per group
 *
 * // With daily traffic of 200 events, at 50/50 split:
 * const perGroup = computeRequiredSampleSize(0.40, 0.05);
 * const daysNeeded = Math.ceil(perGroup / (200 / 2));  // → ~8 days
 * ```
 */
export function computeRequiredSampleSize(
  baseRate: number,
  minDetectableLift: number,
  alpha: number = C.AB_SIGNIFICANCE_THRESHOLD,
  power: number = 0.80,
): number {
  // Guard: rates must be valid proportions
  if (baseRate <= 0 || baseRate >= 1) return Infinity;
  if (minDetectableLift <= 0) return Infinity;

  const p1 = baseRate;
  const p2 = baseRate + minDetectableLift;

  // Guard: target rate must be a valid proportion
  if (p2 >= 1) return Infinity;

  // z-scores for the given alpha and power
  const zAlpha = inverseCDFApprox(1 - alpha / 2); // z_{α/2}
  const zBeta = inverseCDFApprox(power);            // z_β

  // Normal approximation formula
  const numerator = (zAlpha + zBeta) ** 2 * (p1 * (1 - p1) + p2 * (1 - p2));
  const denominator = (p2 - p1) ** 2;

  return Math.ceil(numerator / denominator);
}

/**
 * Estimate days remaining for a running A/B test based on current
 * traffic rate and required sample size.
 *
 * @param test              — The running A/B test
 * @param currentDailyRate  — Average events per day (both groups combined)
 * @param currentBaseRate   — Current control copy rate (from existing data)
 * @param targetLift        — Minimum detectable absolute lift (default: 0.03)
 * @returns Estimated days remaining, or null if insufficient info
 */
export function estimateDaysRemaining(
  test: ABTest,
  currentDailyRate: number,
  currentBaseRate: number,
  targetLift: number = 0.03,
): number | null {
  if (currentDailyRate <= 0 || currentBaseRate <= 0 || currentBaseRate >= 1) {
    return null;
  }

  const requiredPerGroup = computeRequiredSampleSize(currentBaseRate, targetLift);
  if (!isFinite(requiredPerGroup)) return null;

  // Split traffic between control and variant based on splitPct
  const splitFraction = test.splitPct / 100;
  const variantDailyRate = currentDailyRate * splitFraction;
  const controlDailyRate = currentDailyRate * (1 - splitFraction);
  const bottleneckRate = Math.min(variantDailyRate, controlDailyRate);

  if (bottleneckRate <= 0) return null;

  return Math.ceil(requiredPerGroup / bottleneckRate);
}

// ============================================================================
// BAYESIAN CREDIBLE INTERVAL — Beta-Binomial Posterior
// ============================================================================

/**
 * Approximate the inverse of the regularised incomplete Beta function
 * for a Beta(α, β) distribution using the normal approximation.
 *
 * For α, β > ~5, Beta(α, β) ≈ Normal(μ, σ²) where:
 *   μ = α / (α + β)
 *   σ² = αβ / ((α+β)²(α+β+1))
 *
 * @param alpha — Beta shape parameter (successes + prior)
 * @param beta  — Beta shape parameter (failures + prior)
 * @param p     — Quantile probability (e.g. 0.025 for lower 95% CI bound)
 * @returns Approximate quantile value
 */
function betaQuantileApprox(alpha: number, beta: number, p: number): number {
  const mu = alpha / (alpha + beta);
  const sigma = Math.sqrt((alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1)));

  // Use our inverse CDF approximation to convert p → z-score
  const z = inverseCDFApprox(p);

  // Clamp to [0, 1] since it's a rate
  return Math.max(0, Math.min(1, mu + z * sigma));
}

/**
 * Compute the 95% credible interval for a binary proportion using
 * a Beta-Binomial posterior with a weakly informative Jeffreys prior.
 *
 * Prior: Beta(0.5, 0.5) — Jeffreys prior, the standard uninformative
 * prior for Bernoulli data. Equivalent to "half a success and half a
 * failure" of prior evidence.
 *
 * Posterior: Beta(successes + 0.5, failures + 0.5)
 *
 * @param successes — Number of observed successes (e.g. copies)
 * @param total     — Total observations (e.g. events)
 * @returns [lower, upper] bounds of the 95% credible interval
 */
export function betaCredibleInterval(
  successes: number,
  total: number,
): [number, number] {
  if (total === 0) return [0, 1];

  // Jeffreys prior: Beta(0.5, 0.5)
  const alpha = successes + 0.5;
  const beta = (total - successes) + 0.5;

  const lower = betaQuantileApprox(alpha, beta, 0.025);
  const upper = betaQuantileApprox(alpha, beta, 0.975);

  return [lower, upper];
}

/**
 * Estimate the probability that variant B outperforms control A using
 * Monte Carlo sampling from their Beta posteriors.
 *
 * This gives the intuitive answer stakeholders want: "What's the chance
 * variant is actually better?" — e.g. "87% probability variant outperforms".
 *
 * Uses 10,000 samples for ~1% precision — takes <1ms on modern hardware.
 *
 * Prior: Jeffreys Beta(0.5, 0.5) for both groups.
 *
 * @param controlSuccesses — Control group successes (copies)
 * @param controlTotal     — Control group total events
 * @param variantSuccesses — Variant group successes (copies)
 * @param variantTotal     — Variant group total events
 * @returns Probability in [0, 1] that variant rate > control rate
 */
export function bayesianProbVariantWins(
  controlSuccesses: number,
  controlTotal: number,
  variantSuccesses: number,
  variantTotal: number,
): number {
  if (controlTotal === 0 || variantTotal === 0) return 0.5;

  // Beta posterior parameters (Jeffreys prior)
  const aA = controlSuccesses + 0.5;
  const bA = (controlTotal - controlSuccesses) + 0.5;
  const aB = variantSuccesses + 0.5;
  const bB = (variantTotal - variantSuccesses) + 0.5;

  // Monte Carlo: sample from each posterior, count how often B > A
  const N = 10_000;
  let variantWinCount = 0;

  for (let i = 0; i < N; i++) {
    const sampleA = sampleBeta(aA, bA, i * 2);
    const sampleB = sampleBeta(aB, bB, i * 2 + 1);
    if (sampleB > sampleA) variantWinCount++;
  }

  return variantWinCount / N;
}

/**
 * Sample from a Beta distribution using the Gamma ratio method:
 * Beta(a,b) = Ga/(Ga+Gb) where Ga~Gamma(a,1), Gb~Gamma(b,1)
 */
function sampleBeta(alpha: number, beta: number, seed: number): number {
  const ga = sampleGamma(alpha, seed * 1000 + 1);
  const gb = sampleGamma(beta, seed * 1000 + 2);
  return ga / (ga + gb);
}

/**
 * Sample from Gamma(alpha, 1) using Marsaglia & Tsang's method.
 *
 * For alpha >= 1: standard method.
 * For alpha < 1: Gamma(a,1) = Gamma(a+1,1) * U^(1/a).
 */
function sampleGamma(alpha: number, seed: number): number {
  if (alpha < 1) {
    const u = seededRandom(seed + 99999);
    return sampleGamma(alpha + 1, seed) * Math.pow(u, 1 / alpha);
  }

  // Marsaglia & Tsang
  const d = alpha - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  for (let attempt = 0; attempt < 100; attempt++) {
    // Generate normal sample using Box-Muller with seeded randoms
    const u1 = seededRandom(seed + attempt * 7 + 1);
    const u2 = seededRandom(seed + attempt * 7 + 2);
    const x = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-15))) * Math.cos(2 * Math.PI * u2);

    const v = (1 + c * x) ** 3;
    if (v <= 0) continue;

    const u = seededRandom(seed + attempt * 7 + 3);
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }

  // Fallback: mean of the gamma distribution
  return alpha;
}

/**
 * Seeded pseudo-random number generator (Mulberry32 LCG).
 * Returns a value in (0, 1).
 */
function seededRandom(seed: number): number {
  let t = (seed + 0x6D2B79F5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ============================================================================
// BAYESIAN LIFT PROBABILITY — P(variant − control > threshold)
// ============================================================================

/**
 * Estimate the probability that the variant's absolute lift over control
 * exceeds a given threshold using Monte Carlo sampling.
 *
 * This answers: "What's the probability the variant is better by at least
 * X percentage points?" — a stricter condition than bayesianProbVariantWins
 * which only checks P(variant > control) without a minimum effect size.
 *
 * Used by the Bayesian early stopping rule: if P(lift > 1%) > 0.95 AND
 * P(variant wins) > 0.99, the test can auto-promote before the frequentist
 * O'Brien-Fleming threshold is reached.
 *
 * @param controlSuccesses — Control group successes (copies)
 * @param controlTotal     — Control group total events
 * @param variantSuccesses — Variant group successes (copies)
 * @param variantTotal     — Variant group total events
 * @param liftThreshold    — Minimum absolute lift to exceed (default 0.01 = 1%)
 * @returns Probability in [0, 1] that (variant rate − control rate) > liftThreshold
 */
export function bayesianProbLiftExceedsThreshold(
  controlSuccesses: number,
  controlTotal: number,
  variantSuccesses: number,
  variantTotal: number,
  liftThreshold: number = 0.01,
): number {
  if (controlTotal === 0 || variantTotal === 0) return 0;

  // Beta posterior parameters (Jeffreys prior)
  const aA = controlSuccesses + 0.5;
  const bA = (controlTotal - controlSuccesses) + 0.5;
  const aB = variantSuccesses + 0.5;
  const bB = (variantTotal - variantSuccesses) + 0.5;

  // Monte Carlo: sample from each posterior, count how often B − A > threshold
  const N = 10_000;
  let liftExceedsCount = 0;

  for (let i = 0; i < N; i++) {
    const sA = sampleBeta(aA, bA, i * 2 + 50_000);
    const sB = sampleBeta(aB, bB, i * 2 + 50_001);
    if (sB - sA > liftThreshold) liftExceedsCount++;
  }

  return liftExceedsCount / N;
}

// ============================================================================
// LIFT DISTRIBUTION HISTOGRAM — for dashboard sparkline (Improvement 1)
// ============================================================================

/**
 * Compute a binned histogram of the posterior distribution of
 * (variant_rate − control_rate) via Monte Carlo sampling from
 * Beta-Binomial posteriors (Jeffreys prior).
 *
 * Returns an array of bins suitable for rendering as an SVG sparkline.
 * The 1% lift threshold can be overlaid as a vertical red marker.
 *
 * @param controlSuccesses — Control group successes (copies)
 * @param controlTotal     — Control group total events
 * @param variantSuccesses — Variant group successes (copies)
 * @param variantTotal     — Variant group total events
 * @param numBins          — Number of histogram bins (default 40)
 * @returns Array of LiftBin objects sorted by center value
 */
export function computeLiftDistribution(
  controlSuccesses: number,
  controlTotal: number,
  variantSuccesses: number,
  variantTotal: number,
  numBins: number = 40,
): LiftBin[] {
  if (controlTotal === 0 || variantTotal === 0) return [];

  // Beta posterior parameters (Jeffreys prior: α₀ = β₀ = 0.5)
  const aA = controlSuccesses + 0.5;
  const bA = (controlTotal - controlSuccesses) + 0.5;
  const aB = variantSuccesses + 0.5;
  const bB = (variantTotal - variantSuccesses) + 0.5;

  // Monte Carlo: sample lift = (variant rate − control rate)
  const N = 5_000;
  const lifts: number[] = [];
  for (let i = 0; i < N; i++) {
    const sA = sampleBeta(aA, bA, i * 2 + 70_000);
    const sB = sampleBeta(aB, bB, i * 2 + 70_001);
    lifts.push(sB - sA);
  }

  // Trim 0.5% tails to find stable bin range
  const sorted = lifts.slice().sort((a, b) => a - b);
  const lo = sorted[Math.floor(N * 0.005)] ?? 0;
  const hi = sorted[Math.floor(N * 0.995)] ?? 0;
  const binWidth = (hi - lo) / numBins;
  if (binWidth <= 0) return [];

  // Bin the samples
  const bins = new Array<number>(numBins).fill(0);
  for (const lift of lifts) {
    const idx = Math.floor((lift - lo) / binWidth);
    const clamped = Math.max(0, Math.min(numBins - 1, idx));
    bins[clamped] = (bins[clamped] ?? 0) + 1;
  }

  // Normalise to density (fraction of total samples per bin)
  return bins.map((count, i) => ({
    center: lo + (i + 0.5) * binWidth,
    density: count / N,
  }));
}

// ============================================================================
// PREDEFINED TEST SEEDS (Phase 7.8e, Improvement 4)
// ============================================================================

/**
 * Predefined A/B test configurations for common experiments.
 *
 * Usage (admin dashboard or script):
 * ```ts
 * const test = createABTest(
 *   AB_TEST_SEEDS.TEMPORAL_KILL_SWITCH.name,
 *   currentSCORE_WEIGHTS,
 *   { ...currentSCORE_WEIGHTS, ...AB_TEST_SEEDS.TEMPORAL_KILL_SWITCH.variantOverrides },
 * );
 * ```
 */
export const AB_TEST_SEEDS = {
  /**
   * Temporal Intelligence Kill Switch
   *
   * Measures whether Phase 7.8 temporal signals (seasonal, weekly, trending)
   * improve prompt quality. Control group gets default weights (temporal ON).
   * Variant group gets all three temporal weights zeroed (temporal OFF).
   *
   * Expected outcome: If temporal intelligence works, the control group (ON)
   * should have higher copy rates and quality scores than the variant (OFF).
   * If no significant difference after 2 weeks of traffic, temporal signals
   * may be adding complexity without value.
   */
  TEMPORAL_KILL_SWITCH: {
    name: 'temporal-intelligence-v1',
    description: 'Measure lift from Phase 7.8 temporal signals (seasonal + weekly + trending)',
    variantOverrides: {
      temporalSeasonalMax: 0,
      temporalWeeklyMax: 0,
      temporalTrendingMax: 0,
    } as Record<string, number>,
  },
} as const;
