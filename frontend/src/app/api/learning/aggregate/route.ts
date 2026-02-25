/**
 * Learning Aggregation Cron Job
 *
 * Nightly computation for the Collective Intelligence Engine.
 * Reads qualifying prompt_events, computes co-occurrence matrices,
 * and stores results in the learned_weights table.
 *
 * Schedule: 03:00 UTC daily (configured in Vercel dashboard)
 *
 * SECURITY:
 * - Cron secret validation (PROMAGEN_CRON_SECRET)
 * - Advisory lock to prevent concurrent runs
 * - Returns 404 for invalid auth (hides endpoint existence)
 *
 * LAYERS:
 * - Layer 1: Co-occurrence matrix       (5.3b ✓)
 * - Layer 2: Sequence patterns           (5.3c ✓)
 * - Layer 3: Scene candidates            (5.3d ✓)
 *
 * @see docs/authority/prompt-builder-evolution-plan-v2.md § 9
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  ensureAllTables,
  acquireAggregationLock,
  releaseAggregationLock,
  countQualifyingEvents,
  fetchQualifyingEvents,
  upsertLearnedWeights,
  logCronRun,
} from '@/lib/learning/database';

import { LEARNING_CONSTANTS } from '@/lib/learning/constants';
import { computeCoOccurrenceMatrix } from '@/lib/learning/co-occurrence';
import type { CoOccurrenceMatrix } from '@/lib/learning/co-occurrence';
import { computeSequencePatterns } from '@/lib/learning/sequence-patterns';
import type { SequencePatterns } from '@/lib/learning/sequence-patterns';
import { computeSceneCandidates } from '@/lib/learning/scene-candidates';
import type { SceneCandidates, ExistingScenePrefills } from '@/lib/learning/scene-candidates';

import sceneStartersData from '@/data/scenes/scene-starters.json';
import type { SceneStartersFile } from '@/types/scene-starters';

// =============================================================================
// CONFIGURATION
// =============================================================================

const CRON_SECRET = process.env.PROMAGEN_CRON_SECRET;

/** Learned weights storage keys */
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
  if (!CRON_SECRET || CRON_SECRET.length < 16) {
    console.error('[Learning Cron] PROMAGEN_CRON_SECRET not configured or too short');
    return false;
  }

  const headerSecret =
    request.headers.get('x-promagen-cron') ??
    request.headers.get('x-cron-secret');

  if (headerSecret === CRON_SECRET) return true;

  const url = new URL(request.url);
  const querySecret = url.searchParams.get('secret');

  if (querySecret === CRON_SECRET) return true;

  return false;
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const requestId = generateRequestId();

  console.debug('[Learning Cron] Request received', { requestId });

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

    // ─────────────────────────────────────────────────────────────────────
    // LAYER 1: Co-occurrence Matrix
    // ─────────────────────────────────────────────────────────────────────
    const coOccurrenceMatrix: CoOccurrenceMatrix = computeCoOccurrenceMatrix(
      allEvents,
      new Date(),
    );

    console.debug('[Learning Cron] Co-occurrence computed', {
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
    const sequencePatterns: SequencePatterns = computeSequencePatterns(
      allEvents,
      new Date(),
    );

    console.debug('[Learning Cron] Sequence patterns computed', {
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
    // Load existing scenes for overlap checking
    const typedSceneData = sceneStartersData as unknown as SceneStartersFile;
    const existingScenes: ExistingScenePrefills[] = typedSceneData.scenes.map(
      (s) => ({ prefills: s.prefills as Record<string, string[]> }),
    );

    const sceneCandidates: SceneCandidates = computeSceneCandidates(
      allEvents,
      existingScenes,
      new Date(),
    );

    console.debug('[Learning Cron] Scene candidates computed', {
      requestId,
      eventsConsidered: sceneCandidates.eventsConsidered,
      clustersFormed: sceneCandidates.clustersFormed,
      candidatesFound: sceneCandidates.candidates.length,
    });

    if (isTimedOut()) {
      throw new Error('Timeout after scene candidate computation');
    }

    // ─────────────────────────────────────────────────────────────────────
    // Persist results
    // ─────────────────────────────────────────────────────────────────────
    if (!dryRun) {
      await upsertLearnedWeights(WEIGHTS_KEY_CO_OCCURRENCE, coOccurrenceMatrix);
      await upsertLearnedWeights(WEIGHTS_KEY_SEQUENCES, sequencePatterns);
      await upsertLearnedWeights(WEIGHTS_KEY_SCENE_CANDIDATES, sceneCandidates);

      console.debug('[Learning Cron] Persisted all learned weights', {
        requestId,
      });
    }

    // ─────────────────────────────────────────────────────────────────────
    // Log completion
    // ─────────────────────────────────────────────────────────────────────
    const durationMs = Date.now() - startTime;
    const pairsGenerated = coOccurrenceMatrix.totalPairs;
    const candidatesFound = sceneCandidates.candidates.length;
    const message = dryRun
      ? `Dry run: ${allEvents.length} events → ${pairsGenerated} pairs, ${sequencePatterns.sessionCount} sessions, ${candidatesFound} candidates`
      : `Aggregated ${allEvents.length} events → ${pairsGenerated} pairs, ${sequencePatterns.sessionCount} sessions, ${candidatesFound} candidates`;

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
