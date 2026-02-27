// src/lib/learning/__tests__/iteration-integration.test.ts
// ============================================================================
// ITERATION TRACKING — Integration Tests
// ============================================================================
//
// Phase 7.2, Part 7.2e — End-to-end tests for the iteration tracking pipeline.
//
// Tests the complete flow: events → iteration insights → weak term lookup →
// suggestion engine penalty. Also tests final-attempt identification helpers
// and backward compatibility when Phase 7.2 data doesn't exist.
//
// Authority: docs/authority/phase-7.2-iteration-tracking-buildplan.md § 5
//
// Version: 1.0.0
// Created: 26 February 2026
// ============================================================================

import type { PromptEventRow } from '../database';
import {
  computeIterationInsights,
  identifyFinalAttempts,
  identifyMultiAttemptSessions,
} from '../iteration-tracking';
import {
  buildWeakTermLookup,
  lookupWeakTermScore,
  lookupWeakTermInfo,
} from '../weak-term-lookup';
import {
  computeConfidenceMultiplier,
  CONFIDENCE_MULTIPLIERS,
} from '../outcome-score';

// ============================================================================
// HELPERS
// ============================================================================

const C = CONFIDENCE_MULTIPLIERS;

let eventCounter = 0;

function makeEvent(opts: {
  sessionId?: string;
  attemptNumber?: number;
  tier?: number;
  selections?: Record<string, string[]>;
  score?: number;
  createdAt?: string;
}): PromptEventRow {
  eventCounter++;
  const selections = opts.selections ?? { style: ['cinematic'], lighting: ['golden hour'] };
  const categoryCount = Object.keys(selections).filter(
    (k) => selections[k] && selections[k]!.length > 0,
  ).length;

  return {
    id: `evt_${eventCounter}_${Math.random().toString(36).slice(2, 8)}`,
    session_id: opts.sessionId ?? 'sess_default',
    attempt_number: opts.attemptNumber ?? 1,
    selections,
    category_count: categoryCount,
    char_length: 100,
    score: opts.score ?? 50,
    score_factors: {},
    platform: 'midjourney',
    tier: opts.tier ?? 2,
    scene_used: null,
    outcome: { copied: true, saved: false, returnedWithin60s: false, reusedFromLibrary: false },
    user_tier: null,
    account_age_days: null,
    created_at: opts.createdAt ?? new Date().toISOString(),
  };
}

function makeSession(
  sessionId: string,
  attempts: Array<{ selections: Record<string, string[]>; score: number }>,
  tier = 2,
  baseTime = '2026-02-26T12:00:00Z',
): PromptEventRow[] {
  const baseMs = Date.parse(baseTime);
  return attempts.map((attempt, index) =>
    makeEvent({
      sessionId,
      attemptNumber: index + 1,
      tier,
      selections: attempt.selections,
      score: attempt.score,
      createdAt: new Date(baseMs + index * 60_000).toISOString(),
    }),
  );
}

// ============================================================================
// Weak Term Lookup — build + query
// ============================================================================

describe('Weak term lookup integration', () => {
  beforeEach(() => {
    eventCounter = 0;
  });

  it('builds lookup from iteration insights and returns correct score', () => {
    // Create enough sessions to produce a weak term
    const events: PromptEventRow[] = [];
    for (let i = 0; i < 6; i++) {
      events.push(
        ...makeSession(`s${i}`, [
          { selections: { lighting: ['studio lighting'], style: ['cinematic'] }, score: 55 },
          { selections: { lighting: ['golden hour'], style: ['cinematic'] }, score: 78 },
        ]),
      );
    }

    const insights = computeIterationInsights(events)!;
    expect(insights).not.toBeNull();

    const lookup = buildWeakTermLookup(insights);
    expect(lookup).not.toBeNull();

    // "studio lighting" should be weak (replaced 6/6 = 100%)
    const score = lookupWeakTermScore('studio lighting', 2, lookup);
    expect(score).toBeGreaterThan(0);

    // "cinematic" should NOT be weak (retained all sessions)
    const cinematicScore = lookupWeakTermScore('cinematic', 2, lookup);
    expect(cinematicScore).toBe(0);
  });

  it('returns 0 for unknown term', () => {
    const events: PromptEventRow[] = [];
    for (let i = 0; i < 6; i++) {
      events.push(
        ...makeSession(`s${i}`, [
          { selections: { lighting: ['studio lighting'] }, score: 55 },
          { selections: { lighting: ['golden hour'] }, score: 78 },
        ]),
      );
    }

    const insights = computeIterationInsights(events)!;
    const lookup = buildWeakTermLookup(insights);

    expect(lookupWeakTermScore('nonexistent term', 2, lookup)).toBe(0);
  });

  it('returns 0 when lookup is null (no data)', () => {
    expect(lookupWeakTermScore('anything', 2, null)).toBe(0);
  });

  it('buildWeakTermLookup returns null for null input', () => {
    expect(buildWeakTermLookup(null)).toBeNull();
    expect(buildWeakTermLookup(undefined)).toBeNull();
  });

  it('lookupWeakTermInfo returns replacement suggestion', () => {
    const events: PromptEventRow[] = [];
    for (let i = 0; i < 6; i++) {
      events.push(
        ...makeSession(`s${i}`, [
          { selections: { lighting: ['studio lighting'] }, score: 55 },
          { selections: { lighting: ['golden hour'] }, score: 78 },
        ]),
      );
    }

    const insights = computeIterationInsights(events)!;
    const lookup = buildWeakTermLookup(insights);

    const info = lookupWeakTermInfo('studio lighting', 2, lookup);
    expect(info).not.toBeNull();
    expect(info!.topReplacement).toBe('golden hour');
    expect(info!.replacementRate).toBe(1.0);
  });

  it('tier-first → global fallback works', () => {
    // Create weak term in tier 1 only
    const events: PromptEventRow[] = [];
    for (let i = 0; i < 6; i++) {
      events.push(
        ...makeSession(`s${i}`, [
          { selections: { lighting: ['studio lighting'] }, score: 55 },
          { selections: { lighting: ['golden hour'] }, score: 78 },
        ], 1), // tier 1
      );
    }

    const insights = computeIterationInsights(events)!;
    const lookup = buildWeakTermLookup(insights);

    // Should find it in tier 1
    expect(lookupWeakTermScore('studio lighting', 1, lookup)).toBeGreaterThan(0);

    // Tier 3 has no data → falls back to global
    const globalScore = lookupWeakTermScore('studio lighting', 3, lookup);
    expect(globalScore).toBeGreaterThan(0);
  });
});

// ============================================================================
// Final-attempt identification
// ============================================================================

describe('Final-attempt identification', () => {
  beforeEach(() => {
    eventCounter = 0;
  });

  it('identifyFinalAttempts marks last event in 3-attempt session', () => {
    const events = makeSession('s1', [
      { selections: { style: ['a'] }, score: 40 },
      { selections: { style: ['b'] }, score: 60 },
      { selections: { style: ['c'] }, score: 80 },
    ]);

    const finalIds = identifyFinalAttempts(events);
    expect(finalIds.size).toBe(1);
    expect(finalIds.has(events[2]!.id)).toBe(true);
  });

  it('single-attempt sessions are NOT marked', () => {
    const events = [
      makeEvent({ sessionId: 'a', attemptNumber: 1 }),
    ];
    expect(identifyFinalAttempts(events).size).toBe(0);
  });

  it('empty events → empty set', () => {
    expect(identifyFinalAttempts([]).size).toBe(0);
  });

  it('identifyMultiAttemptSessions returns correct session IDs', () => {
    const events = [
      makeEvent({ sessionId: 'multi', attemptNumber: 1 }),
      makeEvent({ sessionId: 'multi', attemptNumber: 2 }),
      makeEvent({ sessionId: 'single', attemptNumber: 1 }),
    ];

    const result = identifyMultiAttemptSessions(events);
    expect(result.has('multi')).toBe(true);
    expect(result.has('single')).toBe(false);
  });
});

// ============================================================================
// Confidence multiplier with final-attempt factor
// ============================================================================

describe('Confidence multiplier with iteration data', () => {
  it('final attempt in multi-session → 1.30× boost', () => {
    const result = computeConfidenceMultiplier({
      userTier: 'free',
      accountAgeDays: 15,
      categoryCount: 4,
      isFinalAttempt: true,
      isMultiAttemptSession: true,
    });
    expect(result).toBe(1.3);
  });

  it('mid-session attempt → 0.85× discount', () => {
    const result = computeConfidenceMultiplier({
      userTier: 'free',
      accountAgeDays: 15,
      categoryCount: 4,
      isFinalAttempt: false,
      isMultiAttemptSession: true,
    });
    expect(result).toBe(0.85);
  });

  it('no iteration data (backward compat) → neutral 1.0', () => {
    const result = computeConfidenceMultiplier({
      userTier: 'free',
      accountAgeDays: 15,
      categoryCount: 4,
    });
    expect(result).toBe(1.0);
  });

  it('paid veteran final attempt → clamped to CONFIDENCE_MAX', () => {
    const result = computeConfidenceMultiplier({
      userTier: 'paid',
      accountAgeDays: 180,
      categoryCount: 8,
      isFinalAttempt: true,
      isMultiAttemptSession: true,
    });
    expect(result).toBe(C.CONFIDENCE_MAX);
  });
});

// ============================================================================
// Full round-trip: events → analysis → lookup → score
// ============================================================================

describe('Full round-trip', () => {
  beforeEach(() => {
    eventCounter = 0;
  });

  it('events → insights → lookup → non-zero weakness score', () => {
    const events: PromptEventRow[] = [];
    for (let i = 0; i < 8; i++) {
      events.push(
        ...makeSession(`s${i}`, [
          { selections: { lighting: ['fluorescent'], style: ['cinematic'] }, score: 40 },
          { selections: { lighting: ['golden hour'], style: ['cinematic'] }, score: 75 },
        ]),
      );
    }

    // Step 1: Compute iteration insights
    const insights = computeIterationInsights(events)!;
    expect(insights).not.toBeNull();
    expect(insights.global.weakTerms.length).toBeGreaterThan(0);

    // Step 2: Build lookup
    const lookup = buildWeakTermLookup(insights)!;
    expect(lookup).not.toBeNull();

    // Step 3: Query weakness score
    const score = lookupWeakTermScore('fluorescent', 2, lookup);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1.0);

    // Step 4: Non-weak term is 0
    expect(lookupWeakTermScore('cinematic', 2, lookup)).toBe(0);
  });

  it('category fix order sorted by fixValue descending', () => {
    // Create sessions where lighting is always fixed first
    const events: PromptEventRow[] = [];
    for (let i = 0; i < 5; i++) {
      events.push(
        ...makeSession(`s${i}`, [
          { selections: { style: ['cyberpunk'] }, score: 45 },
          { selections: { style: ['cyberpunk'], lighting: ['neon'] }, score: 72 },
          { selections: { style: ['cyberpunk'], lighting: ['neon'], atmosphere: ['foggy'] }, score: 81 },
        ]),
      );
    }

    const insights = computeIterationInsights(events)!;
    const fixOrder = insights.global.categoryFixOrder;

    // lighting should have highest fixValue (it's always fixed first)
    expect(fixOrder.length).toBeGreaterThan(0);
    // Verify descending sort
    for (let i = 1; i < fixOrder.length; i++) {
      expect(fixOrder[i - 1]!.fixValue).toBeGreaterThanOrEqual(fixOrder[i]!.fixValue);
    }
  });
});
