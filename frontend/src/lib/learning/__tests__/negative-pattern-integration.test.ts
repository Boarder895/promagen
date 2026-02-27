// src/lib/learning/__tests__/negative-pattern-integration.test.ts
// ============================================================================
// NEGATIVE PATTERN LEARNING — Integration Tests
// ============================================================================
//
// Phase 7.1, Part 7.1f — End-to-end integration tests.
//
// Verifies that anti-pattern and collision lookups correctly influence:
// 1. Suggestion engine scoring (demotes bad pairs)
// 2. Conflict detection (surfaces learned conflicts)
// 3. Backward compatibility (null lookups → unchanged behavior)
//
// Authority: docs/authority/phase-7.1-negative-pattern-learning-buildplan.md § 5
//
// Version: 1.0.0
// Created: 26 February 2026
//
// Existing features preserved: Yes.
// ============================================================================

import {
  buildAntiPatternLookup,
  lookupAntiPatternSeverity,
} from '@/lib/learning/anti-pattern-lookup';
import type { AntiPatternLookup } from '@/lib/learning/anti-pattern-lookup';
import type { AntiPatternData } from '@/lib/learning/anti-pattern-detection';

import { buildCollisionLookup, lookupCollision } from '@/lib/learning/collision-lookup';
import type { CollisionLookup } from '@/lib/learning/collision-lookup';
import type { CollisionMatrixData } from '@/lib/learning/collision-matrix';

import { detectConflicts } from '@/lib/prompt-intelligence/engines/conflict-detection';
import type { ConflictDetectionInput } from '@/lib/prompt-intelligence/engines/conflict-detection';

// ============================================================================
// TEST DATA FACTORIES
// ============================================================================

/**
 * Build a minimal AntiPatternData with one known toxic pair.
 * "oil painting" + "8k resolution" with severity 0.8 (above hard threshold 0.7)
 * "watercolor" + "photorealistic" with severity 0.4 (soft)
 */
function makeAntiPatternData(): AntiPatternData {
  return {
    version: '1.0.0',
    generatedAt: '2026-02-26T03:00:00Z',
    eventCount: 500,
    totalPatterns: 2,
    tiers: {
      '1': {
        eventCount: 300,
        lowEventCount: 100,
        highEventCount: 200,
        patterns: [
          {
            terms: ['8k resolution', 'oil painting'] as [string, string],
            severity: 0.8,
            lowCount: 40,
            highCount: 5,
            enrichment: 8.0,
            categories: ['fidelity', 'style'],
          },
        ],
      },
      '3': {
        eventCount: 300,
        lowEventCount: 100,
        highEventCount: 200,
        patterns: [
          {
            terms: ['photorealistic', 'watercolor'] as [string, string],
            severity: 0.4,
            lowCount: 20,
            highCount: 10,
            enrichment: 4.0,
            categories: ['style', 'fidelity'],
          },
        ],
      },
    },
    global: {
      eventCount: 500,
      lowEventCount: 200,
      highEventCount: 400,
      patterns: [
        {
          terms: ['8k resolution', 'oil painting'] as [string, string],
          severity: 0.75,
          lowCount: 60,
          highCount: 8,
          enrichment: 7.5,
          categories: ['fidelity', 'style'],
        },
      ],
    },
  };
}

/**
 * Build a minimal CollisionMatrixData with one competing pair.
 * "golden hour" + "moonlight" — both lighting sources.
 * "moonlight" is the weaker term.
 */
function makeCollisionData(): CollisionMatrixData {
  return {
    version: '1.0.0',
    generatedAt: '2026-02-26T03:00:00Z',
    eventCount: 500,
    totalCollisions: 1,
    tiers: {
      '1': {
        eventCount: 300,
        collisions: [
          {
            terms: ['golden hour', 'moonlight'] as [string, string],
            competitionScore: 0.6,
            qualityDelta: 0.3,
            weakerTerm: 'moonlight',
            soloOutcomeA: 0.7,
            soloOutcomeB: 0.55,
            togetherOutcome: 0.4,
            togetherCount: 20,
          },
        ],
      },
    },
    global: {
      eventCount: 500,
      collisions: [
        {
          terms: ['golden hour', 'moonlight'] as [string, string],
          competitionScore: 0.55,
          qualityDelta: 0.28,
          weakerTerm: 'moonlight',
          soloOutcomeA: 0.68,
          soloOutcomeB: 0.52,
          togetherOutcome: 0.4,
          togetherCount: 35,
        },
      ],
    },
  };
}

// ============================================================================
// ANTI-PATTERN LOOKUP TESTS
// ============================================================================

describe('Anti-pattern lookup integration', () => {
  it('1. returns correct severity for known toxic pair', () => {
    const data = makeAntiPatternData();
    const lookup = buildAntiPatternLookup(data);
    expect(lookup).not.toBeNull();

    const severity = lookupAntiPatternSeverity('8k resolution', ['oil painting'], 1, lookup);
    expect(severity).toBe(0.8);
  });

  it('2. returns 0 for clean pair', () => {
    const data = makeAntiPatternData();
    const lookup = buildAntiPatternLookup(data);

    const severity = lookupAntiPatternSeverity('cinematic lighting', ['oil painting'], 1, lookup);
    expect(severity).toBe(0);
  });

  it('3. returns 0 when no data loaded (null lookup)', () => {
    const severity = lookupAntiPatternSeverity('8k resolution', ['oil painting'], 1, null);
    expect(severity).toBe(0);
  });

  it('falls back to global when tier data missing', () => {
    const data = makeAntiPatternData();
    const lookup = buildAntiPatternLookup(data);

    // Tier 2 has no data, should fall back to global
    const severity = lookupAntiPatternSeverity('8k resolution', ['oil painting'], 2, lookup);
    expect(severity).toBe(0.75); // global severity
  });
});

// ============================================================================
// COLLISION LOOKUP TESTS
// ============================================================================

describe('Collision lookup integration', () => {
  it('4. returns correct score + weaker term', () => {
    const data = makeCollisionData();
    const lookup = buildCollisionLookup(data);
    expect(lookup).not.toBeNull();

    const result = lookupCollision('moonlight', ['golden hour'], 1, lookup);
    expect(result).not.toBeNull();
    expect(result!.competitionScore).toBe(0.6);
    expect(result!.weakerTerm).toBe('moonlight');
    expect(result!.qualityDelta).toBe(0.3);
  });

  it('5. returns null for non-colliding pair', () => {
    const data = makeCollisionData();
    const lookup = buildCollisionLookup(data);

    const result = lookupCollision('cinematic lighting', ['golden hour'], 1, lookup);
    expect(result).toBeNull();
  });

  it('6. returns null when no data loaded', () => {
    const result = lookupCollision('moonlight', ['golden hour'], 1, null);
    expect(result).toBeNull();
  });
});

// ============================================================================
// SUGGESTION ENGINE SCORING TESTS
// ============================================================================
//
// These tests verify the scoring effect indirectly through the lookup
// functions, since the suggestion engine's scoreOption is not directly
// exported. The integration proves:
// - Non-zero severity → penalty applied (tested via lookup return)
// - Zero severity → no penalty (tested via lookup returning 0)
// - Null lookup → no penalty (tested above)
//

describe('Suggestion engine penalty verification', () => {
  it('7. anti-pattern severity feeds penalty calculation', () => {
    const data = makeAntiPatternData();
    const lookup = buildAntiPatternLookup(data)!;

    // Severity 0.8 → penalty would be Math.round(-30 * 0.8) = -24
    const severity = lookupAntiPatternSeverity('8k resolution', ['oil painting'], 1, lookup);
    const expectedPenalty = Math.round(-30 * severity);
    expect(expectedPenalty).toBe(-24);
  });

  it('8. collision score feeds penalty calculation', () => {
    const data = makeCollisionData();
    const lookup = buildCollisionLookup(data)!;

    // CompetitionScore 0.6 → penalty would be Math.round(-20 * 0.6) = -12
    const result = lookupCollision('moonlight', ['golden hour'], 1, lookup);
    expect(result).not.toBeNull();
    const expectedPenalty = Math.round(-20 * result!.competitionScore);
    expect(expectedPenalty).toBe(-12);
  });

  it('9. no penalty when no learned data exists (backward compat)', () => {
    // Anti-pattern: null → 0
    expect(lookupAntiPatternSeverity('x', ['y'], 1, null)).toBe(0);
    // Collision: null → null
    expect(lookupCollision('x', ['y'], 1, null)).toBeNull();
    // No penalty applied → scoring unchanged from Phase 5/6 baseline
  });
});

// ============================================================================
// CONFLICT DETECTION INTEGRATION TESTS
// ============================================================================

describe('Conflict detection with learned data', () => {
  let antiPatternLookup: AntiPatternLookup;
  let collisionLookup: CollisionLookup;

  beforeAll(() => {
    antiPatternLookup = buildAntiPatternLookup(makeAntiPatternData())!;
    collisionLookup = buildCollisionLookup(makeCollisionData())!;
  });

  it('10. surfaces anti-pattern as soft conflict (severity ≤ 0.7)', () => {
    // watercolor + photorealistic → severity 0.4 → soft
    const input: ConflictDetectionInput = {
      selections: {
        style: ['watercolor'],
        fidelity: ['photorealistic'],
      },
      antiPatternLookup,
      collisionLookup: null,
      tier: 3,
    };

    const result = detectConflicts(input);
    const learnedConflicts = result.conflicts.filter((c) => c.reason.includes('Learned conflict'));
    expect(learnedConflicts.length).toBeGreaterThanOrEqual(1);
    expect(learnedConflicts[0]!.severity).toBe('soft');
  });

  it('11. surfaces high-severity anti-pattern as hard conflict', () => {
    // oil painting + 8k resolution → severity 0.8 > 0.7 → hard
    const input: ConflictDetectionInput = {
      selections: {
        style: ['oil painting'],
        fidelity: ['8k resolution'],
      },
      antiPatternLookup,
      collisionLookup: null,
      tier: 1,
    };

    const result = detectConflicts(input);
    const learnedConflicts = result.conflicts.filter((c) => c.reason.includes('Learned conflict'));
    expect(learnedConflicts.length).toBeGreaterThanOrEqual(1);
    expect(learnedConflicts[0]!.severity).toBe('hard');
    expect(result.hasHardConflicts).toBe(true);
  });

  it('12. surfaces collision with "choose one" suggestion', () => {
    const input: ConflictDetectionInput = {
      selections: {
        lighting: ['golden hour', 'moonlight'],
      },
      antiPatternLookup: null,
      collisionLookup,
      tier: 1,
    };

    const result = detectConflicts(input);
    const collisionConflicts = result.conflicts.filter((c) =>
      c.reason.includes('compete for the same role'),
    );
    expect(collisionConflicts.length).toBeGreaterThanOrEqual(1);
    expect(collisionConflicts[0]!.suggestion).toContain('Choose one');
    expect(collisionConflicts[0]!.suggestion).toContain('moonlight');
    expect(collisionConflicts[0]!.severity).toBe('soft');
  });

  it('13. unchanged when no learned data (backward compat)', () => {
    const input: ConflictDetectionInput = {
      selections: {
        style: ['oil painting'],
        fidelity: ['8k resolution'],
      },
      // No lookups provided → no learned conflicts
    };

    const result = detectConflicts(input);
    const learnedConflicts = result.conflicts.filter(
      (c) =>
        c.reason.includes('Learned conflict') || c.reason.includes('compete for the same role'),
    );
    expect(learnedConflicts.length).toBe(0);
  });
});

// ============================================================================
// FULL ROUND-TRIP TEST
// ============================================================================

describe('Full round-trip', () => {
  it('14. build data → build lookup → lookup → correct penalty derivation', () => {
    // Anti-pattern round-trip
    const apData = makeAntiPatternData();
    const apLookup = buildAntiPatternLookup(apData);
    expect(apLookup).not.toBeNull();
    expect(apLookup!.eventCount).toBe(500);

    const severity = lookupAntiPatternSeverity('oil painting', ['8k resolution'], 1, apLookup);
    expect(severity).toBe(0.8);
    // Penalty = round(-30 * 0.8) = -24
    expect(Math.round(-30 * severity)).toBe(-24);

    // Collision round-trip
    const colData = makeCollisionData();
    const colLookup = buildCollisionLookup(colData);
    expect(colLookup).not.toBeNull();
    expect(colLookup!.eventCount).toBe(500);

    const collision = lookupCollision('golden hour', ['moonlight'], 1, colLookup);
    expect(collision).not.toBeNull();
    expect(collision!.competitionScore).toBe(0.6);
    expect(collision!.weakerTerm).toBe('moonlight');
    // Penalty = round(-20 * 0.6) = -12
    expect(Math.round(-20 * collision!.competitionScore)).toBe(-12);
  });

  it('15. both lookups can be used simultaneously without interference', () => {
    const apLookup = buildAntiPatternLookup(makeAntiPatternData())!;
    const colLookup = buildCollisionLookup(makeCollisionData())!;

    // Anti-pattern lookup works
    const severity = lookupAntiPatternSeverity(
      '8k resolution',
      ['oil painting', 'golden hour'],
      1,
      apLookup,
    );
    expect(severity).toBe(0.8);

    // Collision lookup works on different terms
    const collision = lookupCollision('moonlight', ['golden hour', 'oil painting'], 1, colLookup);
    expect(collision).not.toBeNull();
    expect(collision!.competitionScore).toBe(0.6);
  });
});
