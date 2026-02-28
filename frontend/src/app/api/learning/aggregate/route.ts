/**
 * Learning Aggregation Cron Job
 *
 * Nightly computation for the Collective Intelligence Engine (Phase 5),
 * the Self-Improving Scorer (Phase 6), Negative Pattern Learning (Phase 7.1),
 * Iteration Tracking (Phase 7.2), Semantic Redundancy Detection (Phase 7.3),
 * Higher-Order Combinations / Magic Combos (Phase 7.4),
 * and Per-Platform Learning (Phase 7.5).
 *
 * Schedule: 03:00 UTC daily (configured in Vercel dashboard)
 *
 * SECURITY:
 * - Cron secret validation (PROMAGEN_CRON_SECRET)
 * - Advisory lock to prevent concurrent runs
 * - Returns 404 for invalid auth (hides endpoint existence)
 *
 * LAYERS:
 * - Layer 1: Co-occurrence matrix       (Phase 5 — 5.3b)
 * - Layer 2: Sequence patterns           (Phase 5 — 5.3c)
 * - Layer 3: Scene candidates            (Phase 5 — 5.3d)
 * - Layer 4: Weight Recalibration        (Phase 6 — scoring-weights)
 * - Layer 5: Category Value Discovery    (Phase 6 — category-values)
 * - Layer 6: Term Quality Scores         (Phase 6 — term-quality-scores)
 * - Layer 7: Threshold Discovery         (Phase 6 — threshold-discovery)
 * - Layer 8: Scorer Health Report        (Phase 6 — scorer-health-report)
 * - Layer 9: Anti-pattern Detection      (Phase 7.1 — anti-patterns)
 * - Layer 10: Collision Matrix           (Phase 7.1 — collision-matrix)
 * - Layer 11: Iteration Tracking         (Phase 7.2 — iteration-insights)
 * - Layer 12: Redundancy Detection       (Phase 7.3 — redundancy-groups)
 * - Layer 13: Magic Combos               (Phase 7.4 — magic-combos)
 * - Layer 14a: Platform Term Quality     (Phase 7.5 — platform-term-quality)
 * - Layer 14b: Platform Co-occurrence    (Phase 7.5 — platform-co-occurrence)
 * - Layer 15:  A/B Test Management       (Phase 7.6 — ab-testing-pipeline)
 *
 * Execution order:
 *   Layers 4, 5, 6 run in parallel (no inter-dependencies).
 *   Layer 7 depends on Layer 4 output (previous threshold for smoothing).
 *   Layer 8 depends on Layer 4 output (current weights for drift calc).
 *   Layers 9, 10 run in parallel (no inter-dependencies).
 *   Layers 9, 10 use a SEPARATE event set (all events, not just qualifying).
 *   Layer 11 runs after Layers 9, 10 (reuses same event set).
 *   Layer 12 runs after Layer 11 (reuses same event set).
 *   Layer 13 runs after Layer 12 (reuses same event set).
 *   Layers 14a, 14b run after Layer 13 (reuses same event set).
 *
 * Phase 6 is gated by PHASE_6_SCORING_ENABLED env var (default: false).
 * Phase 7.1 is gated by PHASE_7_LEARNING_ENABLED env var (default: false).
 * Phase 7.2 is gated by the SAME PHASE_7_LEARNING_ENABLED env var.
 * Phase 7.3 is gated by the SAME PHASE_7_LEARNING_ENABLED env var.
 * Phase 7.4 is gated by the SAME PHASE_7_LEARNING_ENABLED env var.
 * Phase 7.5 is gated by the SAME PHASE_7_LEARNING_ENABLED env var.
 * Phase 7.6 is gated by PHASE_7_AB_TESTING_ENABLED env var (default: false).
 * Phase 6 failures are non-fatal — Phase 5 results persist regardless.
 * Phase 7 failures are non-fatal — Phase 5 + 6 results persist regardless.
 *
 * @see docs/authority/prompt-builder-evolution-plan-v2.md § 9, § 10, § 11
 * @see docs/authority/phase-6-self-improving-scorer-buildplan.md § 4.8
 * @see docs/authority/phase-7.1-negative-pattern-learning-buildplan.md § 5
 * @see docs/authority/phase-7.2-iteration-tracking-buildplan.md § 5
 * @see docs/authority/phase-7.3-semantic-redundancy-detection-buildplan.md § 5
 * @see docs/authority/phase-7.4-magic-combos-buildplan.md § 5
 * @see docs/authority/phase-7.5-per-platform-learning-buildplan.md § 5
 *
 * Version: 8.0.0 — Layer 15 A/B test management (Phase 7.6d)
 * Existing features preserved: Yes.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  ensureAllTables,
  acquireAggregationLock,
  releaseAggregationLock,
  countQualifyingEvents,
  fetchQualifyingEvents,
  fetchAllEventsForAntiPatterns,
  upsertLearnedWeights,
  getLearnedWeights,
  logCronRun,
} from '@/lib/learning/database';

import { LEARNING_CONSTANTS } from '@/lib/learning/constants';

// ── Phase 5 imports ──────────────────────────────────────────────────────────
import { computeCoOccurrenceMatrix } from '@/lib/learning/co-occurrence';
import type { CoOccurrenceMatrix } from '@/lib/learning/co-occurrence';
import { computeSequencePatterns } from '@/lib/learning/sequence-patterns';
import type { SequencePatterns } from '@/lib/learning/sequence-patterns';
import { computeSceneCandidates } from '@/lib/learning/scene-candidates';
import type { SceneCandidates, ExistingScenePrefills } from '@/lib/learning/scene-candidates';

// ── Phase 6 imports ──────────────────────────────────────────────────────────
import { computeScoringWeights } from '@/lib/learning/weight-recalibration';
import type { ScoringWeights } from '@/lib/learning/weight-recalibration';
import { computeCategoryValues } from '@/lib/learning/category-value-discovery';
import { computeTermQualityScores } from '@/lib/learning/term-quality-scoring';
import type { TermQualityScores } from '@/lib/learning/term-quality-scoring';
import { discoverThresholds } from '@/lib/learning/threshold-discovery';
import type { ThresholdDiscoveryResult } from '@/lib/learning/threshold-discovery';
import { generateHealthReport } from '@/lib/learning/scorer-health';
import type { ScorerHealthReport } from '@/lib/learning/scorer-health';

// ── Phase 7.1 imports ────────────────────────────────────────────────────────
import { computeAntiPatterns } from '@/lib/learning/anti-pattern-detection';
import type { AntiPatternData } from '@/lib/learning/anti-pattern-detection';
import { computeCollisionMatrix } from '@/lib/learning/collision-matrix';
import type { CollisionMatrixData } from '@/lib/learning/collision-matrix';

// ── Phase 7.2 imports ────────────────────────────────────────────────────────
import { computeIterationInsights } from '@/lib/learning/iteration-tracking';
import type { IterationInsightsData } from '@/lib/learning/iteration-tracking';

// ── Phase 7.3 imports ────────────────────────────────────────────────────────
import { computeRedundancyGroups } from '@/lib/learning/redundancy-detection';
import type { RedundancyGroupsData } from '@/lib/learning/redundancy-detection';

// ── Phase 7.4 imports ────────────────────────────────────────────────────────
import { computeMagicCombos } from '@/lib/learning/magic-combo-mining';
import type { MagicCombosData } from '@/lib/learning/magic-combo-mining';

// ── Phase 7.5 imports ────────────────────────────────────────────────────────
import { computePlatformTermQuality } from '@/lib/learning/platform-term-quality';
import type { PlatformTermQualityData } from '@/lib/learning/platform-term-quality';
import { computePlatformCoOccurrence } from '@/lib/learning/platform-co-occurrence';
import type { PlatformCoOccurrenceData } from '@/lib/learning/platform-co-occurrence';

// ── Phase 7.6 imports ────────────────────────────────────────────────────────
import { shouldCreateTest, evaluateTest, createABTest } from '@/lib/learning/ab-testing';
import type { ABTest, ABTestResult } from '@/lib/learning/ab-testing';
import {
  getRunningABTest,
  insertABTest,
  updateABTestResult,
  incrementPeekCount,
  countABTestEvents,
} from '@/lib/learning/database';

import sceneStartersData from '@/data/scenes/scene-starters.json';
import type { SceneStartersFile } from '@/types/scene-starters';

// =============================================================================
// CONFIGURATION
// =============================================================================

// CRON_SECRET read at request time inside validateCronAuth() — not module level

/** Feature flag for Phase 6 scoring layers (default: false).
 *  Read at request time so env var changes take effect without redeployment. */
function isPhase6Enabled(): boolean {
  return (process.env.PHASE_6_SCORING_ENABLED ?? '').trim().toLowerCase() === 'true';
}

/** Feature flag for Phase 7.1 negative pattern learning layers (default: false).
 *  Read at request time so env var changes take effect without redeployment. */
function isPhase7Enabled(): boolean {
  return (process.env.PHASE_7_LEARNING_ENABLED ?? '').trim().toLowerCase() === 'true';
}

/** Feature flag for Phase 7.6 A/B testing pipeline (default: false).
 *  When disabled, Layer 4 weights are applied directly (pre-7.6 behaviour). */
function isPhase76Enabled(): boolean {
  return (process.env.PHASE_7_AB_TESTING_ENABLED ?? '').trim().toLowerCase() === 'true';
}

/** Phase 5 learned weights storage keys */
const WEIGHTS_KEY_CO_OCCURRENCE = 'co-occurrence';
const WEIGHTS_KEY_SEQUENCES = 'sequences';
const WEIGHTS_KEY_SCENE_CANDIDATES = 'scene-candidates';

// =============================================================================
// RESPONSE TYPE
// =============================================================================

interface AggregationCronResponse {
  ok: boolean;
  message: string;
  eventsProcessed: number;
  pairsGenerated: number;
  candidatesFound: number;
  durationMs: number;
  requestId: string;
  ranAt: string;
  dryRun: boolean;

  // Phase 6 additions
  phase6Enabled: boolean;
  scoringWeightsGenerated: boolean;
  termQualityGenerated: boolean;
  scorerHealthCorrelation: number | null;
  phase6DurationMs: number;

  // Phase 7.1 additions
  phase7Enabled: boolean;
  antiPatternsGenerated: boolean;
  antiPatternCount: number;
  collisionMatrixGenerated: boolean;
  collisionCount: number;
  phase7DurationMs: number;

  // Phase 7.2 additions
  iterationInsightsGenerated: boolean;
  weakTermCount: number;
  multiAttemptSessions: number;

  // Phase 7.3 additions
  redundancyGroupsGenerated: boolean;
  redundancyGroupCount: number;

  // Phase 7.4 additions
  magicCombosGenerated: boolean;
  magicComboCount: number;

  // Phase 7.5 additions (flat — backward compat)
  platformTermQualityGenerated: boolean;
  platformTermCount: number;
  platformCoOccurrenceGenerated: boolean;
  platformPairCount: number;

  // Phase 7.5 grouped summary (easier for Admin Command Centre dashboard)
  phase75: Phase75Summary;

  // Phase 7.6 additions
  phase76Enabled: boolean;
  phase76: Phase76Summary;
}

/** Grouped Phase 7.5 metrics — nested for cleaner dashboard consumption */
interface Phase75Summary {
  termQualityGenerated: boolean;
  termCount: number;
  coOccurrenceGenerated: boolean;
  pairCount: number;
}

/** Phase 7.6 A/B testing summary */
interface Phase76Summary {
  /** Was a test evaluated this run? */
  testEvaluated: boolean;
  /** Was a new test created this run? */
  testCreated: boolean;
  /** Decision from evaluation (null if no test evaluated) */
  decision: 'promote' | 'rollback' | 'extend' | null;
  /** Active test ID (running or just concluded) */
  testId: string | null;
  /** Test name */
  testName: string | null;
  /** Error message if Layer 15 failed */
  error: string | null;
}

// =============================================================================
// HELPERS
// =============================================================================

const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function generateRequestId(): string {
  const length = 12;
  let result = '';

  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
      const byte = array[i]!;
      result += ID_CHARS.charAt(byte % ID_CHARS.length);
    }
  } else {
    for (let i = 0; i < length; i++) {
      result += ID_CHARS.charAt(Math.floor(Math.random() * ID_CHARS.length));
    }
  }
  return `agg_${result}`;
}

// =============================================================================
// SECURITY: AUTH VALIDATION
// =============================================================================

/**
 * Validate cron request authentication.
 * Accepts auth via header or query param.
 * Returns 404 (not 401/403) to hide endpoint existence.
 */
function validateCronAuth(request: NextRequest): boolean {
  const cronSecret = process.env.PROMAGEN_CRON_SECRET;

  if (!cronSecret || cronSecret.length < 16) {
    console.error('[Learning Cron] PROMAGEN_CRON_SECRET not configured or too short');
    return false;
  }

  const headerSecret =
    request.headers.get('x-promagen-cron') ?? request.headers.get('x-cron-secret');

  if (headerSecret === cronSecret) return true;

  const url = new URL(request.url);
  const querySecret = url.searchParams.get('secret');

  if (querySecret === cronSecret) return true;

  return false;
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const requestId = generateRequestId();
  const phase6Enabled = isPhase6Enabled();
  const phase7Enabled = isPhase7Enabled();

  console.debug('[Learning Cron] Request received', { requestId });

  // Phase 6 tracking
  let phase6DurationMs = 0;
  let scoringWeightsGenerated = false;
  let termQualityGenerated = false;
  let scorerHealthCorrelation: number | null = null;

  // Phase 7.1 tracking
  let phase7DurationMs = 0;
  let antiPatternsGenerated = false;
  let antiPatternCount = 0;
  let collisionMatrixGenerated = false;
  let collisionCount = 0;

  // Phase 7.2 tracking
  let iterationInsightsGenerated = false;
  let weakTermCount = 0;
  let multiAttemptSessions = 0;

  // Phase 7.3 tracking
  let redundancyGroupsGenerated = false;
  let redundancyGroupCount = 0;

  // Phase 7.4 tracking
  let magicCombosGenerated = false;
  let magicComboCount = 0;

  // Phase 7.5 tracking
  let platformTermQualityGenerated = false;
  let platformTermCount = 0;
  let platformCoOccurrenceGenerated = false;
  let platformPairCount = 0;

  // Phase 7.6 tracking
  const phase76Enabled = isPhase76Enabled();
  const phase76Summary: Phase76Summary = {
    testEvaluated: false,
    testCreated: false,
    decision: null,
    testId: null,
    testName: null,
    error: null,
  };
  // Hoisted so Layer 15 can access Layer 4 output
  let proposedWeightsForAB: Record<string, number> | null = null;
  let currentLiveWeightsForAB: Record<string, number> | null = null;

  // ─────────────────────────────────────────────────────────────────────────
  // SECURITY: Validate auth
  // ─────────────────────────────────────────────────────────────────────────
  if (!validateCronAuth(request)) {
    console.warn('[Learning Cron] Unauthorized request', { requestId });
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Parse query params
  // ─────────────────────────────────────────────────────────────────────────
  const url = new URL(request.url);
  const dryRun = url.searchParams.get('dryRun') === '1';

  // ─────────────────────────────────────────────────────────────────────────
  // Timeout guard — abort before Vercel kills us (55s safety margin)
  // ─────────────────────────────────────────────────────────────────────────
  const timeoutMs = LEARNING_CONSTANTS.AGGREGATION_TIMEOUT_SECONDS * 1000;
  const isTimedOut = () => Date.now() - startTime > timeoutMs;

  let lockAcquired = false;

  try {
    // ─────────────────────────────────────────────────────────────────────
    // Ensure schema + acquire lock
    // ─────────────────────────────────────────────────────────────────────
    await ensureAllTables();

    lockAcquired = await acquireAggregationLock();

    if (!lockAcquired) {
      console.warn('[Learning Cron] Could not acquire lock — another instance running', {
        requestId,
      });
      const response: AggregationCronResponse = {
        ok: false,
        message: 'Another aggregation instance is running',
        eventsProcessed: 0,
        pairsGenerated: 0,
        candidatesFound: 0,
        durationMs: Date.now() - startTime,
        requestId,
        ranAt: new Date().toISOString(),
        dryRun,
        phase6Enabled: phase6Enabled,
        scoringWeightsGenerated: false,
        termQualityGenerated: false,
        scorerHealthCorrelation: null,
        phase6DurationMs: 0,
        phase7Enabled: phase7Enabled,
        antiPatternsGenerated: false,
        antiPatternCount: 0,
        collisionMatrixGenerated: false,
        collisionCount: 0,
        phase7DurationMs: 0,
        iterationInsightsGenerated: false,
        weakTermCount: 0,
        multiAttemptSessions: 0,
        redundancyGroupsGenerated: false,
        redundancyGroupCount: 0,
        magicCombosGenerated: false,
        magicComboCount: 0,
        platformTermQualityGenerated: false,
        platformTermCount: 0,
        platformCoOccurrenceGenerated: false,
        platformPairCount: 0,
        phase75: {
          termQualityGenerated: false,
          termCount: 0,
          coOccurrenceGenerated: false,
          pairCount: 0,
        },
        phase76Enabled,
        phase76: phase76Summary,
      };
      return NextResponse.json(response, { status: 409 });
    }

    // ─────────────────────────────────────────────────────────────────────
    // Pre-flight: Check if there's anything to process
    // ─────────────────────────────────────────────────────────────────────
    const qualifyingCount = await countQualifyingEvents();

    console.debug('[Learning Cron] Qualifying events', {
      requestId,
      qualifyingCount,
    });

    if (qualifyingCount === 0) {
      const message = 'No qualifying events to process';
      console.debug('[Learning Cron]', message, { requestId });

      if (!dryRun) {
        await logCronRun(requestId, true, message, 0, 0, 0, Date.now() - startTime);
      }

      const response: AggregationCronResponse = {
        ok: true,
        message,
        eventsProcessed: 0,
        pairsGenerated: 0,
        candidatesFound: 0,
        durationMs: Date.now() - startTime,
        requestId,
        ranAt: new Date().toISOString(),
        dryRun,
        phase6Enabled: phase6Enabled,
        scoringWeightsGenerated: false,
        termQualityGenerated: false,
        scorerHealthCorrelation: null,
        phase6DurationMs: 0,
        phase7Enabled: phase7Enabled,
        antiPatternsGenerated: false,
        antiPatternCount: 0,
        collisionMatrixGenerated: false,
        collisionCount: 0,
        phase7DurationMs: 0,
        iterationInsightsGenerated: false,
        weakTermCount: 0,
        multiAttemptSessions: 0,
        redundancyGroupsGenerated: false,
        redundancyGroupCount: 0,
        magicCombosGenerated: false,
        magicComboCount: 0,
        platformTermQualityGenerated: false,
        platformTermCount: 0,
        platformCoOccurrenceGenerated: false,
        platformPairCount: 0,
        phase75: {
          termQualityGenerated: false,
          termCount: 0,
          coOccurrenceGenerated: false,
          pairCount: 0,
        },
        phase76Enabled,
        phase76: phase76Summary,
      };
      return NextResponse.json(response);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Fetch qualifying events (batched, 6-month window)
    // ─────────────────────────────────────────────────────────────────────
    const windowDays = 180;
    const batchSize = LEARNING_CONSTANTS.AGGREGATION_BATCH_SIZE;
    const allEvents = await fetchQualifyingEvents(windowDays, batchSize, 0);

    console.debug('[Learning Cron] Fetched events', {
      requestId,
      fetched: allEvents.length,
      windowDays,
    });

    if (isTimedOut()) {
      throw new Error('Timeout after fetching events');
    }

    // ═════════════════════════════════════════════════════════════════════
    // PHASE 5: Collective Intelligence Engine (Layers 1–3)
    // ═════════════════════════════════════════════════════════════════════

    // ─────────────────────────────────────────────────────────────────────
    // LAYER 1: Co-occurrence Matrix
    // ─────────────────────────────────────────────────────────────────────
    const coOccurrenceMatrix: CoOccurrenceMatrix = computeCoOccurrenceMatrix(allEvents, new Date());

    console.debug('[Learning Cron] Layer 1 — Co-occurrence computed', {
      requestId,
      eventCount: coOccurrenceMatrix.eventCount,
      totalPairs: coOccurrenceMatrix.totalPairs,
      tierCount: Object.keys(coOccurrenceMatrix.tiers).length,
    });

    if (isTimedOut()) {
      throw new Error('Timeout after co-occurrence computation');
    }

    // ─────────────────────────────────────────────────────────────────────
    // LAYER 2: Sequence Patterns
    // ─────────────────────────────────────────────────────────────────────
    const sequencePatterns: SequencePatterns = computeSequencePatterns(allEvents, new Date());

    console.debug('[Learning Cron] Layer 2 — Sequence patterns computed', {
      requestId,
      sessionCount: sequencePatterns.sessionCount,
      tierCount: Object.keys(sequencePatterns.tiers).length,
    });

    if (isTimedOut()) {
      throw new Error('Timeout after sequence pattern computation');
    }

    // ─────────────────────────────────────────────────────────────────────
    // LAYER 3: Scene Candidates
    // ─────────────────────────────────────────────────────────────────────
    const typedSceneData = sceneStartersData as unknown as SceneStartersFile;
    const existingScenes: ExistingScenePrefills[] = typedSceneData.scenes.map((s) => ({
      prefills: s.prefills as Record<string, string[]>,
    }));

    const sceneCandidates: SceneCandidates = computeSceneCandidates(
      allEvents,
      existingScenes,
      new Date(),
    );

    console.debug('[Learning Cron] Layer 3 — Scene candidates computed', {
      requestId,
      eventsConsidered: sceneCandidates.eventsConsidered,
      clustersFormed: sceneCandidates.clustersFormed,
      candidatesFound: sceneCandidates.candidates.length,
    });

    if (isTimedOut()) {
      throw new Error('Timeout after scene candidate computation');
    }

    // ─────────────────────────────────────────────────────────────────────
    // Persist Phase 5 results
    // ─────────────────────────────────────────────────────────────────────
    if (!dryRun) {
      await upsertLearnedWeights(WEIGHTS_KEY_CO_OCCURRENCE, coOccurrenceMatrix);
      await upsertLearnedWeights(WEIGHTS_KEY_SEQUENCES, sequencePatterns);
      await upsertLearnedWeights(WEIGHTS_KEY_SCENE_CANDIDATES, sceneCandidates);

      console.debug('[Learning Cron] Persisted Phase 5 learned weights', {
        requestId,
      });
    }

    // ═════════════════════════════════════════════════════════════════════
    // PHASE 6: Self-Improving Scorer (Layers 4–8)
    // Gated by PHASE_6_SCORING_ENABLED env var.
    // Non-fatal: if Phase 6 fails, Phase 5 results are already persisted.
    // ═════════════════════════════════════════════════════════════════════

    if (phase6Enabled && !isTimedOut()) {
      const phase6Start = Date.now();

      console.debug('[Learning Cron] Phase 6 starting', { requestId });

      try {
        // ── Fetch previous run data for smoothing ────────────────────────
        const [
          previousWeightsResult,
          previousTermQualityResult,
          previousThresholdResult,
          previousHealthResult,
        ] = await Promise.all([
          getLearnedWeights<ScoringWeights>(LEARNING_CONSTANTS.SCORING_WEIGHTS_KEY),
          getLearnedWeights<TermQualityScores>(LEARNING_CONSTANTS.TERM_QUALITY_KEY),
          getLearnedWeights<ThresholdDiscoveryResult>(LEARNING_CONSTANTS.THRESHOLD_DISCOVERY_KEY),
          getLearnedWeights<ScorerHealthReport>(LEARNING_CONSTANTS.SCORER_HEALTH_KEY),
        ]);

        const previousWeights = previousWeightsResult?.data ?? null;
        const previousTermQuality = previousTermQualityResult?.data ?? null;
        const previousThreshold = previousThresholdResult?.data ?? null;
        const previousHealth = previousHealthResult?.data ?? null;

        if (isTimedOut()) {
          throw new Error('Timeout after fetching previous Phase 6 data');
        }

        // ── Layers 4, 5, 6: Run in parallel ─────────────────────────────
        // All three read from allEvents and don't depend on each other.
        const [scoringWeights, categoryValues, termQualityScores] = await Promise.all([
          // Layer 4: Weight Recalibration
          Promise.resolve(computeScoringWeights(allEvents, previousWeights)),
          // Layer 5: Category Value Discovery
          Promise.resolve(computeCategoryValues(allEvents)),
          // Layer 6: Term Quality Scores
          Promise.resolve(computeTermQualityScores(allEvents, previousTermQuality)),
        ]);

        console.debug('[Learning Cron] Layers 4-6 computed', {
          requestId,
          scoringWeightsEventCount: scoringWeights.eventCount,
          categoryValueTiers: Object.keys(categoryValues.tiers).length,
          termQualityTermCount: termQualityScores.global.termCount,
        });

        // Capture for Layer 15 (A/B testing) — hoisted variable
        proposedWeightsForAB = scoringWeights.global.weights;
        currentLiveWeightsForAB = previousWeights?.global.weights ?? null;

        if (isTimedOut()) {
          throw new Error('Timeout after Phase 6 Layers 4-6');
        }

        // ── Layer 7: Threshold Discovery ─────────────────────────────────
        // Depends on previous threshold for smoothing.
        const thresholdResult: ThresholdDiscoveryResult = discoverThresholds(
          allEvents,
          previousThreshold,
        );

        console.debug('[Learning Cron] Layer 7 — Threshold discovery computed', {
          requestId,
          globalThreshold: thresholdResult.global.threshold,
        });

        if (isTimedOut()) {
          throw new Error('Timeout after Phase 6 Layer 7');
        }

        // ── Layer 8: Scorer Health Report ────────────────────────────────
        // Depends on current + previous weights for drift calculation.
        const healthReport: ScorerHealthReport = generateHealthReport(
          allEvents,
          scoringWeights,
          previousWeights,
          previousHealth,
        );

        scorerHealthCorrelation = healthReport.overallCorrelation;

        console.debug('[Learning Cron] Layer 8 — Scorer health computed', {
          requestId,
          overallCorrelation: healthReport.overallCorrelation,
          correlationTrend: healthReport.correlationTrend,
          weightDrift: healthReport.weightDrift,
          alertCount: healthReport.alerts.length,
        });

        // ── Persist Phase 6 results ──────────────────────────────────────
        if (!dryRun) {
          await Promise.all([
            upsertLearnedWeights(LEARNING_CONSTANTS.SCORING_WEIGHTS_KEY, scoringWeights),
            upsertLearnedWeights(LEARNING_CONSTANTS.CATEGORY_VALUES_KEY, categoryValues),
            upsertLearnedWeights(LEARNING_CONSTANTS.TERM_QUALITY_KEY, termQualityScores),
            upsertLearnedWeights(LEARNING_CONSTANTS.THRESHOLD_DISCOVERY_KEY, thresholdResult),
            upsertLearnedWeights(LEARNING_CONSTANTS.SCORER_HEALTH_KEY, healthReport),
          ]);

          scoringWeightsGenerated = true;
          termQualityGenerated = true;

          console.debug('[Learning Cron] Persisted Phase 6 learned weights', {
            requestId,
          });
        } else {
          // Mark as generated even in dry-run for response accuracy
          scoringWeightsGenerated = true;
          termQualityGenerated = true;
        }

        phase6DurationMs = Date.now() - phase6Start;

        console.debug('[Learning Cron] Phase 6 complete', {
          requestId,
          phase6DurationMs,
          scoringWeightsGenerated,
          termQualityGenerated,
          scorerHealthCorrelation,
        });
      } catch (phase6Error) {
        // ── Phase 6 failures are non-fatal ─────────────────────────────
        // Phase 5 results are already persisted above. Log and continue.
        phase6DurationMs = Date.now() - phase6Start;
        const errorMsg =
          phase6Error instanceof Error ? phase6Error.message : 'Unknown Phase 6 error';

        console.error('[Learning Cron] Phase 6 error (non-fatal)', {
          requestId,
          error: errorMsg,
          phase6DurationMs,
        });
      }
    } else if (!phase6Enabled) {
      console.debug('[Learning Cron] Phase 6 skipped (PHASE_6_SCORING_ENABLED != true)', {
        requestId,
      });
    }

    // ═════════════════════════════════════════════════════════════════════
    // PHASE 7: Negative Pattern Learning (Layers 9–10) + Iteration Tracking (Layer 11)
    //        + Semantic Redundancy Detection (Layer 12)
    // Gated by PHASE_7_LEARNING_ENABLED env var.
    // Non-fatal: if Phase 7 fails, Phase 5 + 6 results persist regardless.
    //
    // Uses a SEPARATE event set from fetchAllEventsForAntiPatterns()
    // because Phase 7 needs ALL events (including low-scoring ones),
    // whereas Phase 5 only processes qualifying (high-scoring) events.
    // Layers 11–12 reuse the same event set as Layers 9–10 (no extra query).
    // ═════════════════════════════════════════════════════════════════════

    if (phase7Enabled && !isTimedOut()) {
      const phase7Start = Date.now();

      console.debug('[Learning Cron] Phase 7.1 starting', { requestId });

      try {
        // ── Fetch ALL events (including low-scoring) ─────────────────────
        // Anti-patterns need events that scored poorly — the inverse of Phase 5.
        // fetchAllEventsForAntiPatterns() has NO score floor, only
        // requires ANTI_PATTERN_MIN_CATEGORIES (2) and 180-day window.
        const antiPatternEvents = await fetchAllEventsForAntiPatterns(windowDays, batchSize, 0);

        console.debug('[Learning Cron] Fetched anti-pattern events', {
          requestId,
          count: antiPatternEvents.length,
          qualifyingEvents: allEvents.length,
        });

        if (isTimedOut()) {
          throw new Error('Timeout after fetching anti-pattern events');
        }

        // ── Layers 9, 10: Run in parallel ────────────────────────────────
        // Both read from antiPatternEvents and don't depend on each other.
        const [antiPatternData, collisionData]: [AntiPatternData, CollisionMatrixData] =
          await Promise.all([
            // Layer 9: Anti-pattern Detection
            Promise.resolve(computeAntiPatterns(antiPatternEvents, new Date())),
            // Layer 10: Collision Matrix
            Promise.resolve(computeCollisionMatrix(antiPatternEvents, new Date())),
          ]);

        antiPatternCount = antiPatternData.totalPatterns;
        collisionCount = collisionData.totalCollisions;

        console.debug('[Learning Cron] Layers 9-10 computed', {
          requestId,
          antiPatternEventCount: antiPatternData.eventCount,
          antiPatternTotal: antiPatternData.totalPatterns,
          antiPatternTiers: Object.keys(antiPatternData.tiers).length,
          collisionEventCount: collisionData.eventCount,
          collisionTotal: collisionData.totalCollisions,
          collisionTiers: Object.keys(collisionData.tiers).length,
        });

        if (isTimedOut()) {
          throw new Error('Timeout after Phase 7.1 Layers 9-10');
        }

        // ── Persist Phase 7.1 results ────────────────────────────────────
        if (!dryRun) {
          await Promise.all([
            upsertLearnedWeights(LEARNING_CONSTANTS.ANTI_PATTERNS_KEY, antiPatternData),
            upsertLearnedWeights(LEARNING_CONSTANTS.COLLISION_MATRIX_KEY, collisionData),
          ]);

          antiPatternsGenerated = true;
          collisionMatrixGenerated = true;

          console.debug('[Learning Cron] Persisted Phase 7.1 learned weights', {
            requestId,
          });
        } else {
          // Mark as generated even in dry-run for response accuracy
          antiPatternsGenerated = true;
          collisionMatrixGenerated = true;
        }

        // ── Layer 11: Iteration Tracking (Phase 7.2) ──────────────────────
        // Reuses antiPatternEvents (same event set — ALL events, no score floor).
        // Runs after Layers 9–10 since it doesn't depend on their output.
        if (!isTimedOut()) {
          console.debug('[Learning Cron] Layer 11 (Iteration Tracking) starting', { requestId });

          const iterationInsights: IterationInsightsData | null =
            computeIterationInsights(antiPatternEvents);

          if (iterationInsights) {
            weakTermCount = iterationInsights.totalWeakTerms;
            multiAttemptSessions = iterationInsights.global.multiAttemptCount;

            if (!dryRun) {
              await upsertLearnedWeights(
                LEARNING_CONSTANTS.ITERATION_INSIGHTS_KEY,
                iterationInsights,
              );
            }

            iterationInsightsGenerated = true;

            console.debug('[Learning Cron] Layer 11 complete', {
              requestId,
              sessionCount: iterationInsights.sessionCount,
              multiAttemptSessions,
              weakTermCount,
              tiers: Object.keys(iterationInsights.tiers).length,
            });
          } else {
            console.debug('[Learning Cron] Layer 11 skipped — insufficient data', { requestId });
          }
        }

        // ── Layer 12: Semantic Redundancy Detection (Phase 7.3) ──────────
        // Reuses antiPatternEvents (same ALL-events set — no new DB query).
        // Detects same-category terms that are functionally interchangeable.
        if (!isTimedOut()) {
          console.debug('[Learning Cron] Layer 12 (Redundancy Detection) starting', { requestId });

          const redundancyData: RedundancyGroupsData | null =
            computeRedundancyGroups(antiPatternEvents);

          if (redundancyData) {
            redundancyGroupCount = redundancyData.totalGroups;

            if (!dryRun) {
              await upsertLearnedWeights(LEARNING_CONSTANTS.REDUNDANCY_GROUPS_KEY, redundancyData);
            }

            redundancyGroupsGenerated = true;

            console.debug('[Learning Cron] Layer 12 complete', {
              requestId,
              totalGroups: redundancyGroupCount,
              tiers: Object.keys(redundancyData.tiers).length,
            });
          } else {
            console.debug('[Learning Cron] Layer 12 skipped — insufficient data', { requestId });
          }
        }

        // ── Layer 13: Magic Combos — Higher-Order Combinations (Phase 7.4) ──
        // Reuses antiPatternEvents (same ALL-events set — no new DB query).
        // Discovers trios/quads with emergent synergy via Apriori mining.
        if (!isTimedOut()) {
          console.debug('[Learning Cron] Layer 13 (Magic Combos) starting', { requestId });

          const magicCombosData: MagicCombosData | null = computeMagicCombos(antiPatternEvents);

          if (magicCombosData) {
            magicComboCount = magicCombosData.totalCombos;

            if (!dryRun) {
              await upsertLearnedWeights(LEARNING_CONSTANTS.MAGIC_COMBOS_KEY, magicCombosData);
            }

            magicCombosGenerated = true;

            console.debug('[Learning Cron] Layer 13 complete', {
              requestId,
              totalCombos: magicComboCount,
              tiers: Object.keys(magicCombosData.tiers).length,
              globalCombos: magicCombosData.global.comboCount,
            });
          } else {
            console.debug('[Learning Cron] Layer 13 skipped — insufficient data', { requestId });
          }
        }

        // ── Layers 14a + 14b: Per-Platform Learning (Phase 7.5) ────────
        // Independent engines with separate storage keys — run in parallel.
        // Reuses antiPatternEvents (same ALL-events set — no new DB query).
        // Individual try/catch so one failure doesn't block the other.
        if (!isTimedOut()) {
          console.debug('[Learning Cron] Layers 14a+14b (Per-Platform Learning) starting in parallel', { requestId });

          const [layer14aResult, layer14bResult] = await Promise.allSettled([
            // ── Layer 14a: Platform Term Quality ──────────────────────
            (async () => {
              const previousPlatformTermQuality =
                await getLearnedWeights<PlatformTermQualityData>(
                  LEARNING_CONSTANTS.PLATFORM_TERM_QUALITY_KEY,
                );

              const data: PlatformTermQualityData | null =
                computePlatformTermQuality(
                  antiPatternEvents,
                  previousPlatformTermQuality?.data ?? null,
                );

              if (data) {
                platformTermCount = data.totalTermsScored;
                if (!dryRun) {
                  await upsertLearnedWeights(
                    LEARNING_CONSTANTS.PLATFORM_TERM_QUALITY_KEY,
                    data,
                  );
                }
                platformTermQualityGenerated = true;
                console.debug('[Learning Cron] Layer 14a complete', {
                  requestId,
                  totalTerms: platformTermCount,
                  totalPlatforms: data.totalPlatforms,
                  graduatedPlatforms: data.graduatedPlatforms,
                });
              } else {
                console.debug('[Learning Cron] Layer 14a skipped — insufficient data', { requestId });
              }
            })(),

            // ── Layer 14b: Platform Co-occurrence ─────────────────────
            (async () => {
              const data: PlatformCoOccurrenceData | null =
                computePlatformCoOccurrence(antiPatternEvents);

              if (data) {
                platformPairCount = data.totalPairs;
                if (!dryRun) {
                  await upsertLearnedWeights(
                    LEARNING_CONSTANTS.PLATFORM_CO_OCCURRENCE_KEY,
                    data,
                  );
                }
                platformCoOccurrenceGenerated = true;
                console.debug('[Learning Cron] Layer 14b complete', {
                  requestId,
                  totalPairs: platformPairCount,
                  totalPlatforms: data.totalPlatforms,
                  graduatedPlatforms: data.graduatedPlatforms,
                });
              } else {
                console.debug('[Learning Cron] Layer 14b skipped — insufficient data', { requestId });
              }
            })(),
          ]);

          // Log individual failures (non-fatal — other layer may have succeeded)
          if (layer14aResult.status === 'rejected') {
            console.error('[Learning Cron] Layer 14a failed (non-fatal)', {
              requestId,
              error: layer14aResult.reason instanceof Error
                ? layer14aResult.reason.message
                : 'Unknown error',
            });
          }
          if (layer14bResult.status === 'rejected') {
            console.error('[Learning Cron] Layer 14b failed (non-fatal)', {
              requestId,
              error: layer14bResult.reason instanceof Error
                ? layer14bResult.reason.message
                : 'Unknown error',
            });
          }
        }

        phase7DurationMs = Date.now() - phase7Start;

        console.debug('[Learning Cron] Phase 7 complete (7.1 + 7.2 + 7.3 + 7.4 + 7.5)', {
          requestId,
          phase7DurationMs,
          antiPatternsGenerated,
          antiPatternCount,
          collisionMatrixGenerated,
          collisionCount,
          iterationInsightsGenerated,
          weakTermCount,
          multiAttemptSessions,
          redundancyGroupsGenerated,
          redundancyGroupCount,
          magicCombosGenerated,
          magicComboCount,
          platformTermQualityGenerated,
          platformTermCount,
          platformCoOccurrenceGenerated,
          platformPairCount,
        });
      } catch (phase7Error) {
        // ── Phase 7 failures are non-fatal ──────────────────────────────
        // Phase 5 + 6 results are already persisted. Log and continue.
        phase7DurationMs = Date.now() - phase7Start;
        const errorMsg =
          phase7Error instanceof Error ? phase7Error.message : 'Unknown Phase 7 error';

        console.error('[Learning Cron] Phase 7 error (non-fatal)', {
          requestId,
          error: errorMsg,
          phase7DurationMs,
        });
      }
    } else if (!phase7Enabled) {
      console.debug('[Learning Cron] Phase 7 skipped (PHASE_7_LEARNING_ENABLED != true)', {
        requestId,
      });
    }

    // ═════════════════════════════════════════════════════════════════════
    // PHASE 7.6: A/B Testing Pipeline — Layer 15
    // Gated by PHASE_7_AB_TESTING_ENABLED env var.
    // Non-fatal: if Layer 15 fails, all prior results are already persisted.
    //
    // Logic:
    //   15a. Get running test (if any)
    //   15b. If running test → evaluate, decide promote/rollback/extend
    //   15c. If no running test → compare proposed vs live weights → create
    //   15d. Cache active test info for GET /api/learning/ab-assignment
    // ═════════════════════════════════════════════════════════════════════

    if (phase76Enabled && !isTimedOut() && !dryRun) {
      console.debug('[Learning Cron] Layer 15 (A/B testing) starting', { requestId });

      try {
        // 15a. Check for running test
        const runningTest = await getRunningABTest();

        if (runningTest) {
          // ── 15b. Evaluate running test ────────────────────────────────
          const counts = await countABTestEvents(runningTest.id);
          const result: ABTestResult = evaluateTest(runningTest, counts);

          // Increment peek count (for O'Brien-Fleming tracking)
          await incrementPeekCount(runningTest.id);

          phase76Summary.testEvaluated = true;
          phase76Summary.testId = runningTest.id;
          phase76Summary.testName = runningTest.name;
          phase76Summary.decision = result.decision;

          if (result.decision === 'promote') {
            // Promote: apply variant weights as the new live weights
            await updateABTestResult(runningTest.id, 'promoted', result);

            // Merge variant weights into the scoring-weights data
            const currentWeightsData = await getLearnedWeights<ScoringWeights>(
              LEARNING_CONSTANTS.SCORING_WEIGHTS_KEY,
            );
            if (currentWeightsData?.data) {
              const promoted = { ...currentWeightsData.data };
              promoted.global = {
                ...promoted.global,
                weights: { ...promoted.global.weights, ...runningTest.variantWeights },
              };
              for (const tierKey of Object.keys(promoted.tiers)) {
                promoted.tiers[tierKey] = {
                  ...promoted.tiers[tierKey]!,
                  weights: { ...promoted.tiers[tierKey]!.weights, ...runningTest.variantWeights },
                };
              }
              await upsertLearnedWeights(LEARNING_CONSTANTS.SCORING_WEIGHTS_KEY, promoted);
            }

            // Clear the cached active test
            await upsertLearnedWeights(LEARNING_CONSTANTS.AB_ACTIVE_TEST_KEY, null);

            console.debug('[Learning Cron] Layer 15 — Test PROMOTED', {
              requestId,
              testId: runningTest.id,
              testName: runningTest.name,
              pValue: result.pValue,
              bayesProb: result.bayesianProbVariantWins,
              controlRate: result.controlCopyRate,
              variantRate: result.variantCopyRate,
            });
          } else if (result.decision === 'rollback') {
            // Rollback: discard variant weights (live weights unchanged)
            await updateABTestResult(runningTest.id, 'rolled_back', result);

            // Clear the cached active test
            await upsertLearnedWeights(LEARNING_CONSTANTS.AB_ACTIVE_TEST_KEY, null);

            console.debug('[Learning Cron] Layer 15 — Test ROLLED BACK', {
              requestId,
              testId: runningTest.id,
              testName: runningTest.name,
              reason: result.reason,
            });
          } else {
            // Extend: no-op, test continues — update cache with latest eval
            await upsertLearnedWeights(LEARNING_CONSTANTS.AB_ACTIVE_TEST_KEY, {
              ...runningTest,
              peekCount: runningTest.peekCount + 1,
              resultSummary: result,
            });

            console.debug('[Learning Cron] Layer 15 — Test EXTENDED', {
              requestId,
              testId: runningTest.id,
              peekNumber: result.peekNumber,
              pValue: result.pValue,
              adjustedAlpha: result.adjustedAlpha,
            });
          }
        } else {
          // ── 15c. No running test — consider creating one ──────────────
          if (proposedWeightsForAB && currentLiveWeightsForAB) {
            const testCandidate = shouldCreateTest(currentLiveWeightsForAB, proposedWeightsForAB);

            if (testCandidate) {
              const newTest: ABTest = createABTest(
                testCandidate.name,
                currentLiveWeightsForAB,
                proposedWeightsForAB,
              );

              await insertABTest(newTest);

              // Cache for fast GET reads
              await upsertLearnedWeights(LEARNING_CONSTANTS.AB_ACTIVE_TEST_KEY, newTest);

              phase76Summary.testCreated = true;
              phase76Summary.testId = newTest.id;
              phase76Summary.testName = newTest.name;

              console.debug('[Learning Cron] Layer 15 — New A/B test CREATED', {
                requestId,
                testId: newTest.id,
                testName: newTest.name,
                weightDelta: testCandidate.delta,
              });
            } else {
              console.debug('[Learning Cron] Layer 15 — Weight delta below threshold, no test created', {
                requestId,
              });
            }
          } else {
            console.debug('[Learning Cron] Layer 15 — No proposed weights (Phase 6 may be disabled)', {
              requestId,
            });
          }
        }
      } catch (layer15Error) {
        // Layer 15 is non-fatal
        const errorMsg = layer15Error instanceof Error ? layer15Error.message : 'Unknown Layer 15 error';
        phase76Summary.error = errorMsg;

        console.error('[Learning Cron] Layer 15 error (non-fatal)', {
          requestId,
          error: errorMsg,
        });
      }
    } else if (!phase76Enabled) {
      console.debug('[Learning Cron] Phase 7.6 skipped (PHASE_7_AB_TESTING_ENABLED != true)', {
        requestId,
      });
    }

    // ─────────────────────────────────────────────────────────────────────
    // Log completion
    // ─────────────────────────────────────────────────────────────────────
    const durationMs = Date.now() - startTime;
    const pairsGenerated = coOccurrenceMatrix.totalPairs;
    const candidatesFound = sceneCandidates.candidates.length;

    const phase6Suffix = phase6Enabled
      ? `, Phase 6: ${phase6DurationMs}ms (weights=${scoringWeightsGenerated}, quality=${termQualityGenerated}, r=${scorerHealthCorrelation?.toFixed(3) ?? 'n/a'})`
      : '';

    const phase7Suffix = phase7Enabled
      ? `, Phase 7: ${phase7DurationMs}ms (anti=${antiPatternCount}, collisions=${collisionCount}, weakTerms=${weakTermCount}, multiSessions=${multiAttemptSessions}, redundancyGroups=${redundancyGroupCount}, magicCombos=${magicComboCount}, platformTerms=${platformTermCount}, platformPairs=${platformPairCount})`
      : '';

    const phase76Suffix = phase76Enabled
      ? `, Phase 7.6: AB(eval=${phase76Summary.testEvaluated}, created=${phase76Summary.testCreated}, decision=${phase76Summary.decision ?? 'n/a'})`
      : '';

    const message = dryRun
      ? `Dry run: ${allEvents.length} events → ${pairsGenerated} pairs, ${sequencePatterns.sessionCount} sessions, ${candidatesFound} candidates${phase6Suffix}${phase7Suffix}${phase76Suffix}`
      : `Aggregated ${allEvents.length} events → ${pairsGenerated} pairs, ${sequencePatterns.sessionCount} sessions, ${candidatesFound} candidates${phase6Suffix}${phase7Suffix}${phase76Suffix}`;

    if (!dryRun) {
      await logCronRun(
        requestId,
        true,
        message,
        allEvents.length,
        pairsGenerated,
        candidatesFound,
        durationMs,
      );
    }

    console.debug('[Learning Cron] Complete', {
      requestId,
      eventsProcessed: allEvents.length,
      pairsGenerated,
      durationMs,
      phase6DurationMs,
      phase7DurationMs,
      dryRun,
    });

    const response: AggregationCronResponse = {
      ok: true,
      message,
      eventsProcessed: allEvents.length,
      pairsGenerated,
      candidatesFound,
      durationMs,
      requestId,
      ranAt: new Date().toISOString(),
      dryRun,
      phase6Enabled: phase6Enabled,
      scoringWeightsGenerated,
      termQualityGenerated,
      scorerHealthCorrelation,
      phase6DurationMs,
      phase7Enabled: phase7Enabled,
      antiPatternsGenerated,
      antiPatternCount,
      collisionMatrixGenerated,
      collisionCount,
      phase7DurationMs,
      iterationInsightsGenerated,
      weakTermCount,
      multiAttemptSessions,
      redundancyGroupsGenerated,
      redundancyGroupCount,
      magicCombosGenerated,
      magicComboCount,
      platformTermQualityGenerated,
      platformTermCount,
      platformCoOccurrenceGenerated,
      platformPairCount,
      phase75: {
        termQualityGenerated: platformTermQualityGenerated,
        termCount: platformTermCount,
        coOccurrenceGenerated: platformCoOccurrenceGenerated,
        pairCount: platformPairCount,
      },
      phase76Enabled,
      phase76: phase76Summary,
    };

    return NextResponse.json(response);
  } catch (error) {
    // ─────────────────────────────────────────────────────────────────────
    // Error handling
    // ─────────────────────────────────────────────────────────────────────
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error('[Learning Cron] Error', {
      requestId,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Log failed run (best effort)
    try {
      await logCronRun(requestId, false, errorMessage, 0, 0, 0, durationMs);
    } catch {
      // Ignore logging errors
    }

    const response: AggregationCronResponse = {
      ok: false,
      message: `Aggregation failed: ${errorMessage}`,
      eventsProcessed: 0,
      pairsGenerated: 0,
      candidatesFound: 0,
      durationMs,
      requestId,
      ranAt: new Date().toISOString(),
      dryRun: false,
      phase6Enabled: phase6Enabled,
      scoringWeightsGenerated: false,
      termQualityGenerated: false,
      scorerHealthCorrelation: null,
      phase6DurationMs,
      phase7Enabled: phase7Enabled,
      antiPatternsGenerated: false,
      antiPatternCount: 0,
      collisionMatrixGenerated: false,
      collisionCount: 0,
      phase7DurationMs,
      iterationInsightsGenerated: false,
      weakTermCount: 0,
      multiAttemptSessions: 0,
      redundancyGroupsGenerated: false,
      redundancyGroupCount: 0,
      magicCombosGenerated: false,
      magicComboCount: 0,
      platformTermQualityGenerated: false,
      platformTermCount: 0,
      platformCoOccurrenceGenerated: false,
      platformPairCount: 0,
      phase75: {
        termQualityGenerated: false,
        termCount: 0,
        coOccurrenceGenerated: false,
        pairCount: 0,
      },
      phase76Enabled,
      phase76: phase76Summary,
    };

    return NextResponse.json(response, { status: 500 });
  } finally {
    // ─────────────────────────────────────────────────────────────────────
    // Always release lock
    // ─────────────────────────────────────────────────────────────────────
    if (lockAcquired) {
      await releaseAggregationLock();
      console.debug('[Learning Cron] Released advisory lock', { requestId });
    }
  }
}

// =============================================================================
// RUNTIME CONFIG
// =============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel Pro: 60s max
