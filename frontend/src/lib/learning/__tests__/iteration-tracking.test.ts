// src/lib/learning/__tests__/iteration-tracking.test.ts
// ============================================================================
// ITERATION TRACKING — Unit Tests
// ============================================================================
//
// Phase 7.2, Part 7.2b — Tests for the iteration analysis engine.
//
// Verifies session grouping, selection diffing, fix order detection,
// score jump computation, weak term identification, final-attempt marking,
// time gap splitting, and edge cases.
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

// ============================================================================
// HELPERS
// ============================================================================

let eventCounter = 0;

/**
 * Create a minimal PromptEventRow for testing iteration tracking.
 *
 * Key difference from anti-pattern tests: we need realistic session_id
 * and attempt_number sequences, and selections that change between attempts.
 */
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

/**
 * Create a session: a sequence of attempts with specified selection changes.
 *
 * @param sessionId — Session identifier
 * @param attempts — Array of { selections, score } for each attempt
 * @param tier — Platform tier (default 2)
 * @param baseTime — Base timestamp (attempts are 1 minute apart by default)
 */
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
      createdAt: new Date(baseMs + index * 60_000).toISOString(), // 1 min apart
    }),
  );
}

// ============================================================================
// computeIterationInsights — Basic behaviour
// ============================================================================

describe('computeIterationInsights', () => {
  beforeEach(() => {
    eventCounter = 0;
  });

  // ── Empty / edge cases ─────────────────────────────────────────────

  it('returns null for empty events', () => {
    expect(computeIterationInsights([])).toBeNull();
  });

  it('returns null for null-ish input', () => {
    expect(computeIterationInsights(null as unknown as PromptEventRow[])).toBeNull();
  });

  it('returns data with 0 weak terms for all single-attempt sessions', () => {
    const events = [
      makeEvent({ sessionId: 'a', attemptNumber: 1 }),
      makeEvent({ sessionId: 'b', attemptNumber: 1 }),
      makeEvent({ sessionId: 'c', attemptNumber: 1 }),
    ];

    const result = computeIterationInsights(events);
    expect(result).not.toBeNull();
    expect(result!.global.multiAttemptCount).toBe(0);
    expect(result!.global.weakTerms).toHaveLength(0);
    expect(result!.global.avgIterations).toBe(0);
  });

  // ── 2-attempt session: basic fix detection ─────────────────────────

  it('detects category addition as first fix in 2-attempt session', () => {
    const events = makeSession('s1', [
      { selections: { style: ['cyberpunk'] }, score: 45 },
      { selections: { style: ['cyberpunk'], lighting: ['neon'] }, score: 72 },
    ]);

    const result = computeIterationInsights(events)!;
    expect(result.global.multiAttemptCount).toBe(1);
    expect(result.global.avgIterations).toBe(2);

    // lighting was the first (and only) category changed
    const lightingFix = result.global.categoryFixOrder.find(c => c.category === 'lighting');
    expect(lightingFix).toBeDefined();
    expect(lightingFix!.firstFixRate).toBe(1.0); // 1 session, lighting was first fix
  });

  // ── 3-attempt session: correct fix order tracking ──────────────────

  it('tracks fix order across 3 attempts', () => {
    const events = makeSession('s1', [
      { selections: { style: ['cyberpunk'] }, score: 45 },
      { selections: { style: ['cyberpunk'], lighting: ['neon'] }, score: 72 },
      { selections: { style: ['cyberpunk'], lighting: ['neon'], atmosphere: ['foggy'] }, score: 81 },
    ]);

    const result = computeIterationInsights(events)!;

    // lighting was first fix, atmosphere was second
    const lightingFix = result.global.categoryFixOrder.find(c => c.category === 'lighting');
    const atmosphereFix = result.global.categoryFixOrder.find(c => c.category === 'atmosphere');

    expect(lightingFix).toBeDefined();
    expect(lightingFix!.firstFixRate).toBe(1.0); // lighting was first in the only session

    // atmosphere was NOT the first fix, so firstFixRate = 0
    expect(atmosphereFix).toBeDefined();
    expect(atmosphereFix!.firstFixRate).toBe(0);
  });

  // ── Term replacement detection ─────────────────────────────────────

  it('detects term replacement (swap within same category)', () => {
    // Create enough sessions to meet MIN_REPLACED_COUNT (5)
    const events: PromptEventRow[] = [];
    for (let i = 0; i < 6; i++) {
      events.push(
        ...makeSession(`s${i}`, [
          { selections: { lighting: ['studio lighting'], style: ['cinematic'] }, score: 55 },
          { selections: { lighting: ['golden hour'], style: ['cinematic'] }, score: 78 },
        ]),
      );
    }

    const result = computeIterationInsights(events)!;

    // "studio lighting" should be flagged as weak (replaced 6 times, retained 0 times)
    const weakTerm = result.global.weakTerms.find(w => w.term === 'studio lighting');
    expect(weakTerm).toBeDefined();
    expect(weakTerm!.replacedCount).toBe(6);
    expect(weakTerm!.retainedCount).toBe(0);
    expect(weakTerm!.replacementRate).toBe(1.0);
    expect(weakTerm!.topReplacement).toBe('golden hour');
  });

  it('does NOT flag retained terms as weak', () => {
    // "cinematic" is retained across all sessions
    const events: PromptEventRow[] = [];
    for (let i = 0; i < 6; i++) {
      events.push(
        ...makeSession(`s${i}`, [
          { selections: { lighting: ['studio lighting'], style: ['cinematic'] }, score: 55 },
          { selections: { lighting: ['golden hour'], style: ['cinematic'] }, score: 78 },
        ]),
      );
    }

    const result = computeIterationInsights(events)!;

    // "cinematic" retained 6 times, replaced 0 times → NOT weak
    const cinematicWeak = result.global.weakTerms.find(w => w.term === 'cinematic');
    expect(cinematicWeak).toBeUndefined();
  });

  // ── Score jumps ────────────────────────────────────────────────────

  it('computes correct score jump for category addition', () => {
    const events = makeSession('s1', [
      { selections: { style: ['cyberpunk'] }, score: 45 },
      { selections: { style: ['cyberpunk'], lighting: ['neon'] }, score: 72 },
    ]);

    const result = computeIterationInsights(events)!;
    const lightingJump = result.global.scoreJumps.find(j => j.category === 'lighting');
    expect(lightingJump).toBeDefined();
    expect(lightingJump!.avgDelta).toBe(27); // 72 - 45
    expect(lightingJump!.count).toBe(1);
  });

  it('tracks negative score jumps (user made it worse)', () => {
    const events = makeSession('s1', [
      { selections: { style: ['cyberpunk'], lighting: ['neon'] }, score: 72 },
      { selections: { style: ['cyberpunk'], lighting: ['neon'], atmosphere: ['cluttered'] }, score: 55 },
    ]);

    const result = computeIterationInsights(events)!;
    const atmosphereJump = result.global.scoreJumps.find(j => j.category === 'atmosphere');
    expect(atmosphereJump).toBeDefined();
    expect(atmosphereJump!.avgDelta).toBe(-17); // 55 - 72
  });

  // ── Weak term thresholds ──────────────────────────────────────────

  it('does NOT flag term with replacement rate below threshold (0.30)', () => {
    // Term replaced 2 times, retained 8 times → rate 0.20 < 0.30
    const events: PromptEventRow[] = [];
    for (let i = 0; i < 2; i++) {
      events.push(
        ...makeSession(`s_replace_${i}`, [
          { selections: { lighting: ['ambient'] }, score: 50 },
          { selections: { lighting: ['golden hour'] }, score: 70 },
        ]),
      );
    }
    for (let i = 0; i < 8; i++) {
      events.push(
        ...makeSession(`s_retain_${i}`, [
          { selections: { lighting: ['ambient'], style: ['cinematic'] }, score: 50 },
          { selections: { lighting: ['ambient'], style: ['cinematic'], atmosphere: ['foggy'] }, score: 70 },
        ]),
      );
    }

    const result = computeIterationInsights(events)!;
    const ambient = result.global.weakTerms.find(w => w.term === 'ambient');
    // replacedCount = 2 (below MIN_REPLACED_COUNT of 5), so not flagged regardless
    expect(ambient).toBeUndefined();
  });

  it('flags term above threshold with enough evidence', () => {
    // Term replaced 6 times, retained 6 times → rate 0.50 > 0.30
    const events: PromptEventRow[] = [];
    for (let i = 0; i < 6; i++) {
      events.push(
        ...makeSession(`s_replace_${i}`, [
          { selections: { lighting: ['ambient'] }, score: 50 },
          { selections: { lighting: ['golden hour'] }, score: 70 },
        ]),
      );
    }
    for (let i = 0; i < 6; i++) {
      events.push(
        ...makeSession(`s_retain_${i}`, [
          { selections: { lighting: ['ambient'], style: ['cinematic'] }, score: 50 },
          { selections: { lighting: ['ambient'], style: ['cinematic'], atmosphere: ['foggy'] }, score: 70 },
        ]),
      );
    }

    const result = computeIterationInsights(events)!;
    const ambient = result.global.weakTerms.find(w => w.term === 'ambient');
    expect(ambient).toBeDefined();
    expect(ambient!.replacedCount).toBe(6);
    expect(ambient!.retainedCount).toBe(6);
    expect(ambient!.replacementRate).toBe(0.5);
    // weaknessScore = 0.50 / 0.60 = 0.8333
    expect(ambient!.weaknessScore).toBeCloseTo(0.8333, 3);
  });

  // ── Final-attempt identification ───────────────────────────────────

  it('identifies last event in multi-attempt session as final attempt', () => {
    const events = makeSession('s1', [
      { selections: { style: ['a'] }, score: 40 },
      { selections: { style: ['b'] }, score: 60 },
      { selections: { style: ['c'] }, score: 80 },
    ]);

    const result = computeIterationInsights(events)!;
    expect(result.global.finalAttemptCount).toBe(1);
  });

  // ── Per-tier independence ──────────────────────────────────────────

  it('tracks tiers independently', () => {
    const tier1Events = makeSession('s_t1', [
      { selections: { style: ['cyberpunk'] }, score: 45 },
      { selections: { style: ['cyberpunk'], lighting: ['neon'] }, score: 72 },
    ], 1);

    const tier2Events = makeSession('s_t2', [
      { selections: { style: ['oil painting'] }, score: 50 },
      { selections: { style: ['oil painting'], atmosphere: ['misty'] }, score: 65 },
    ], 2);

    const result = computeIterationInsights([...tier1Events, ...tier2Events])!;

    expect(result.tiers['tier_1']).toBeDefined();
    expect(result.tiers['tier_2']).toBeDefined();
    expect(result.tiers['tier_1']!.multiAttemptCount).toBe(1);
    expect(result.tiers['tier_2']!.multiAttemptCount).toBe(1);

    // tier_1 first fix was lighting, tier_2 first fix was atmosphere
    const t1Fix = result.tiers['tier_1']!.categoryFixOrder[0];
    const t2Fix = result.tiers['tier_2']!.categoryFixOrder[0];
    expect(t1Fix?.category).toBe('lighting');
    expect(t2Fix?.category).toBe('atmosphere');
  });

  // ── Global aggregation ─────────────────────────────────────────────

  it('global aggregates across all tiers', () => {
    const tier1Events = makeSession('s_t1', [
      { selections: { style: ['a'] }, score: 40 },
      { selections: { style: ['a'], lighting: ['b'] }, score: 60 },
    ], 1);

    const tier2Events = makeSession('s_t2', [
      { selections: { style: ['c'] }, score: 50 },
      { selections: { style: ['c'], lighting: ['d'] }, score: 70 },
    ], 2);

    const result = computeIterationInsights([...tier1Events, ...tier2Events])!;

    // Global should see 2 multi-attempt sessions
    expect(result.global.multiAttemptCount).toBe(2);
    expect(result.global.sessionCount).toBe(2);
  });

  // ── Session gap splitting ──────────────────────────────────────────

  it('splits session when gap exceeds SESSION_GAP_MINUTES', () => {
    const baseTime = '2026-02-26T12:00:00Z';
    const baseMs = Date.parse(baseTime);

    // Attempt 1 at 12:00, attempt 2 at 12:01, attempt 3 at 14:00 (2 hours later)
    const events = [
      makeEvent({
        sessionId: 's1',
        attemptNumber: 1,
        selections: { style: ['a'] },
        score: 40,
        createdAt: new Date(baseMs).toISOString(),
      }),
      makeEvent({
        sessionId: 's1',
        attemptNumber: 2,
        selections: { style: ['b'] },
        score: 60,
        createdAt: new Date(baseMs + 60_000).toISOString(),
      }),
      makeEvent({
        sessionId: 's1',
        attemptNumber: 3,
        selections: { style: ['c'] },
        score: 80,
        createdAt: new Date(baseMs + 2 * 60 * 60_000).toISOString(), // 2 hours
      }),
    ];

    const result = computeIterationInsights(events)!;

    // Should be split into 2 sessions: [attempt 1,2] and [attempt 3]
    // Only the first run (2 events) is multi-attempt
    expect(result.global.multiAttemptCount).toBe(1);
    expect(result.global.sessionCount).toBe(2);
  });

  // ── Multiple terms replaced in same category ──────────────────────

  it('tracks each replaced term separately in same category', () => {
    const events: PromptEventRow[] = [];

    // Session where both terms in a category are swapped
    for (let i = 0; i < 6; i++) {
      events.push(
        ...makeSession(`s${i}`, [
          { selections: { lighting: ['studio lighting', 'overhead'], style: ['cinematic'] }, score: 50 },
          { selections: { lighting: ['golden hour', 'backlit'], style: ['cinematic'] }, score: 80 },
        ]),
      );
    }

    const result = computeIterationInsights(events)!;

    const studioWeak = result.global.weakTerms.find(w => w.term === 'studio lighting');
    const overheadWeak = result.global.weakTerms.find(w => w.term === 'overhead');

    expect(studioWeak).toBeDefined();
    expect(overheadWeak).toBeDefined();
    expect(studioWeak!.replacedCount).toBe(6);
    expect(overheadWeak!.replacedCount).toBe(6);
  });

  // ── Output metadata shape ──────────────────────────────────────────

  it('produces correct top-level metadata', () => {
    const events = makeSession('s1', [
      { selections: { style: ['a'] }, score: 40 },
      { selections: { style: ['b'] }, score: 60 },
    ]);

    const result = computeIterationInsights(events)!;

    expect(result.version).toBe('1.0.0');
    expect(result.generatedAt).toBeDefined();
    expect(result.eventCount).toBe(2);
    expect(result.sessionCount).toBe(1);
    expect(typeof result.totalWeakTerms).toBe('number');
    expect(result.tiers).toBeDefined();
    expect(result.global).toBeDefined();
  });

  // ── multiAttemptPercent ────────────────────────────────────────────

  it('computes correct multiAttemptPercent', () => {
    const multiEvents = makeSession('multi', [
      { selections: { style: ['a'] }, score: 40 },
      { selections: { style: ['b'] }, score: 60 },
    ]);
    const singleEvents = [
      makeEvent({ sessionId: 'single1', attemptNumber: 1 }),
      makeEvent({ sessionId: 'single2', attemptNumber: 1 }),
      makeEvent({ sessionId: 'single3', attemptNumber: 1 }),
    ];

    const result = computeIterationInsights([...multiEvents, ...singleEvents])!;

    // 4 sessions total (1 multi + 3 single), 1 multi-attempt
    expect(result.global.sessionCount).toBe(4);
    expect(result.global.multiAttemptCount).toBe(1);
    expect(result.global.multiAttemptPercent).toBe(0.25);
  });
});

// ============================================================================
// identifyFinalAttempts
// ============================================================================

describe('identifyFinalAttempts', () => {
  beforeEach(() => {
    eventCounter = 0;
  });

  it('returns empty set for empty events', () => {
    expect(identifyFinalAttempts([])).toEqual(new Set());
  });

  it('returns empty set for all single-attempt sessions', () => {
    const events = [
      makeEvent({ sessionId: 'a', attemptNumber: 1 }),
      makeEvent({ sessionId: 'b', attemptNumber: 1 }),
    ];
    expect(identifyFinalAttempts(events).size).toBe(0);
  });

  it('marks last event in multi-attempt session', () => {
    const events = makeSession('s1', [
      { selections: { style: ['a'] }, score: 40 },
      { selections: { style: ['b'] }, score: 60 },
      { selections: { style: ['c'] }, score: 80 },
    ]);

    const finalIds = identifyFinalAttempts(events);
    expect(finalIds.size).toBe(1);
    expect(finalIds.has(events[2]!.id)).toBe(true);
    expect(finalIds.has(events[0]!.id)).toBe(false);
    expect(finalIds.has(events[1]!.id)).toBe(false);
  });

  it('handles multiple multi-attempt sessions', () => {
    const s1 = makeSession('s1', [
      { selections: { style: ['a'] }, score: 40 },
      { selections: { style: ['b'] }, score: 60 },
    ]);
    const s2 = makeSession('s2', [
      { selections: { style: ['c'] }, score: 50 },
      { selections: { style: ['d'] }, score: 70 },
      { selections: { style: ['e'] }, score: 90 },
    ]);

    const finalIds = identifyFinalAttempts([...s1, ...s2]);
    expect(finalIds.size).toBe(2);
    expect(finalIds.has(s1[1]!.id)).toBe(true); // last of s1
    expect(finalIds.has(s2[2]!.id)).toBe(true); // last of s2
  });
});

// ============================================================================
// identifyMultiAttemptSessions
// ============================================================================

describe('identifyMultiAttemptSessions', () => {
  beforeEach(() => {
    eventCounter = 0;
  });

  it('returns empty set for empty events', () => {
    expect(identifyMultiAttemptSessions([])).toEqual(new Set());
  });

  it('returns empty set for all single-attempt sessions', () => {
    const events = [
      makeEvent({ sessionId: 'a', attemptNumber: 1 }),
      makeEvent({ sessionId: 'b', attemptNumber: 1 }),
    ];
    expect(identifyMultiAttemptSessions(events).size).toBe(0);
  });

  it('identifies sessions with 2+ events', () => {
    const events = [
      makeEvent({ sessionId: 'multi', attemptNumber: 1 }),
      makeEvent({ sessionId: 'multi', attemptNumber: 2 }),
      makeEvent({ sessionId: 'single', attemptNumber: 1 }),
    ];

    const result = identifyMultiAttemptSessions(events);
    expect(result.size).toBe(1);
    expect(result.has('multi')).toBe(true);
    expect(result.has('single')).toBe(false);
  });
});
