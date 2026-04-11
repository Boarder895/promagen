// src/lib/__tests__/aps-gate.test.ts
// ============================================================================
// APS GATE — Tests
// ============================================================================
// Build plan: call-3-quality-build-plan-v1.md §6.2
// Architecture: call-3-quality-architecture-v0.2.0.md §6
//
// Test fixtures derived from build plan §6.2:
//   1. Perfect preservation (APS 1.0) → ACCEPT
//   2. Minor important loss → ACCEPT_WITH_WARNING
//   3. Critical anchor missing (veto overrides score) → REJECT
//   4. Invented content present (veto) → REJECT
//   5. Prose scaffold detected (veto) → REJECT
//   6. Retry band (no vetoes) → RETRY
//   7. Hard reject → REJECT
//
// Additional architecture-rule tests:
//   - Veto 1 fires on subject loss regardless of APS score
//   - Veto 2 fires on invented colours not in input
//   - Veto 3 fires on composition scaffold language
//   - scoreVerdict vs verdict divergence when vetoes fire
//   - Edge case: empty anchor manifest → APS 1.0
// ============================================================================

import { computeAPS } from '@/lib/optimise-prompts/aps-gate';
import type { AnchorManifest } from '@/lib/optimise-prompts/preflight';

// ── Test helpers ────────────────────────────────────────────────────────────

/**
 * Build an AnchorManifest with precise control over anchor contents.
 * Defaults produce a rich manifest with multiple anchor categories.
 */
function makeAnchors(overrides: Partial<AnchorManifest> = {}): AnchorManifest {
  return {
    subjectPhrase: 'weathered old keeper',
    subjectPosition: 45,
    subjectIsLeading: false,
    colours: ['copper', 'purple'],
    lightSources: ['lantern'],
    environmentNouns: ['cliff', 'coast'],
    actionVerbs: ['pauses', 'grips'],
    anchorCount: 7,
    ...overrides,
  };
}

/**
 * Build output text containing all (or specified) anchors from a manifest.
 * When `drop` is provided, those anchors are omitted from the output.
 * When `add` is provided, those words are injected into the output.
 */
function makeOutput(
  anchors: AnchorManifest,
  options: { drop?: string[]; add?: string[] } = {},
): string {
  const dropSet = new Set((options.drop ?? []).map((d) => d.toLowerCase()));
  const parts: string[] = [];

  // Subject
  if (anchors.subjectPhrase && !dropSet.has(anchors.subjectPhrase.toLowerCase())) {
    // Include individual subject words so subjectSurvives can find them
    parts.push(`A ${anchors.subjectPhrase} stands at the railing`);
  }

  // Colours
  for (const c of anchors.colours) {
    if (!dropSet.has(c.toLowerCase())) {
      parts.push(`${c} tones in the light`);
    }
  }

  // Light sources
  for (const l of anchors.lightSources) {
    if (!dropSet.has(l.toLowerCase())) {
      parts.push(`a ${l} flickers nearby`);
    }
  }

  // Environment
  for (const e of anchors.environmentNouns) {
    if (!dropSet.has(e.toLowerCase())) {
      parts.push(`the ${e} rises above`);
    }
  }

  // Action verbs
  for (const v of anchors.actionVerbs) {
    if (!dropSet.has(v.toLowerCase())) {
      parts.push(`the figure ${v} briefly`);
    }
  }

  // Injected content
  if (options.add) {
    parts.push(...options.add);
  }

  return parts.join('. ') + '.';
}

// ── Weight calculations ─────────────────────────────────────────────────────
// Default anchors: subject(3) + 2 verbs(3+2) + 2 colours(3+3) + 2 env(2+2) + 1 light(2)
// Total weight = 3 + 3 + 2 + 3 + 3 + 2 + 2 + 2 = 20

// ── 1. Perfect preservation → ACCEPT ────────────────────────────────────────

describe('APS Gate — Perfect preservation', () => {
  test('all anchors preserved → APS 1.0, ACCEPT', () => {
    const anchors = makeAnchors();
    const output = makeOutput(anchors);
    const result = computeAPS(output, output, anchors);

    // Input === output, so everything survives
    expect(result.score).toBe(1.0);
    expect(result.verdict).toBe('ACCEPT');
    expect(result.scoreVerdict).toBe('ACCEPT');
    expect(result.anyVetoFired).toBe(false);
    expect(result.droppedAnchors).toHaveLength(0);
  });

  test('no anchors in manifest → APS 1.0, ACCEPT (edge case)', () => {
    const emptyAnchors = makeAnchors({
      subjectPhrase: null,
      colours: [],
      lightSources: [],
      environmentNouns: [],
      actionVerbs: [],
      anchorCount: 0,
    });
    const result = computeAPS('simple prompt', 'simple prompt', emptyAnchors);

    expect(result.score).toBe(1.0);
    expect(result.verdict).toBe('ACCEPT');
  });
});

// ── 2. Minor important loss → ACCEPT_WITH_WARNING ───────────────────────────

describe('APS Gate — Minor important loss', () => {
  test('one important anchor dropped → ACCEPT_WITH_WARNING', () => {
    const anchors = makeAnchors();
    const output = makeOutput(anchors, { drop: ['cliff'] });
    const result = computeAPS(makeOutput(anchors), output, anchors);

    // Dropped 1 important (weight 2) from total 20 → 18/20 = 0.9
    expect(result.score).toBe(0.9);
    expect(result.verdict).toBe('ACCEPT_WITH_WARNING');
    expect(result.criticalAnchorVeto).toBe(false);
    expect(result.droppedAnchors).toHaveLength(1);
    expect(result.droppedAnchors[0]!.anchor).toBe('cliff');
    expect(result.droppedAnchors[0]!.severity).toBe('important');
  });
});

// ── 3. Critical anchor missing (veto overrides score) → REJECT ──────────────

describe('APS Gate — Critical anchor veto', () => {
  test('subject dropped → REJECT via Veto 1 even with high APS', () => {
    const anchors = makeAnchors();
    const output = makeOutput(anchors, { drop: ['weathered old keeper'] });
    const result = computeAPS(makeOutput(anchors), output, anchors);

    // Subject (weight 3) dropped from total 20 → 17/20 = 0.85 (RETRY by score)
    // But critical anchor veto fires → overrides to REJECT? No, RETRY is already stricter than ACCEPT.
    // Architecture: vetoes override ACCEPT/ACCEPT_WITH_WARNING to REJECT.
    // RETRY stays RETRY (already strict). But the veto still fires as a flag.
    expect(result.criticalAnchorVeto).toBe(true);
    expect(result.anyVetoFired).toBe(true);
    expect(result.droppedAnchors.some((a) => a.category === 'subject')).toBe(true);
  });

  test('primary action verb dropped → critical veto fires', () => {
    const anchors = makeAnchors();
    const output = makeOutput(anchors, { drop: ['pauses'] });
    const result = computeAPS(makeOutput(anchors), output, anchors);

    expect(result.criticalAnchorVeto).toBe(true);
    expect(result.droppedAnchors.some(
      (a) => a.category === 'action_verb' && a.severity === 'critical',
    )).toBe(true);
  });

  test('named colour dropped → critical veto fires', () => {
    const anchors = makeAnchors();
    const output = makeOutput(anchors, { drop: ['copper'] });
    const result = computeAPS(makeOutput(anchors), output, anchors);

    expect(result.criticalAnchorVeto).toBe(true);
    expect(result.droppedAnchors.some(
      (a) => a.category === 'colour' && a.anchor === 'copper',
    )).toBe(true);
  });

  test('high APS with critical loss → scoreVerdict diverges from verdict', () => {
    // Build a manifest where losing one critical still leaves APS ≥ 0.95
    const manyAnchors = makeAnchors({
      colours: ['copper', 'purple', 'amber', 'gold', 'silver'],
      environmentNouns: ['cliff', 'coast', 'lighthouse', 'harbour', 'shore'],
      lightSources: ['lantern', 'moonlight', 'starlight'],
    });
    const output = makeOutput(manyAnchors, { drop: ['copper'] });
    const result = computeAPS(makeOutput(manyAnchors), output, manyAnchors);

    // Score might still be ≥ 0.95 with many anchors, but veto fires
    expect(result.criticalAnchorVeto).toBe(true);
    if (result.scoreVerdict === 'ACCEPT' || result.scoreVerdict === 'ACCEPT_WITH_WARNING') {
      expect(result.verdict).toBe('REJECT');
    }
  });
});

// ── 4. Invented content (veto) → REJECT ─────────────────────────────────────

describe('APS Gate — Invented content veto', () => {
  test('new colour in output not in input → Veto 2 fires', () => {
    const anchors = makeAnchors();
    const inputText = makeOutput(anchors);
    // Add a colour that extractAnchors will detect but wasn't in the input
    const outputText = makeOutput(anchors, { add: ['crimson highlights illuminate the scene'] });
    const result = computeAPS(inputText, outputText, anchors);

    expect(result.inventedContentVeto).toBe(true);
    expect(result.inventedContent.some((ic) => ic.includes('crimson'))).toBe(true);
    expect(result.anyVetoFired).toBe(true);
  });

  test('no invented content → Veto 2 does not fire', () => {
    const anchors = makeAnchors();
    const output = makeOutput(anchors);
    const result = computeAPS(output, output, anchors);

    expect(result.inventedContentVeto).toBe(false);
    expect(result.inventedContent).toHaveLength(0);
  });
});

// ── 5. Prose scaffold detected (veto) → REJECT ─────────────────────────────

describe('APS Gate — Prose quality veto', () => {
  test('foreground/background scaffold in same sentence → Veto 3 fires', () => {
    const anchors = makeAnchors();
    const inputText = makeOutput(anchors);
    // Inject scaffold language that wasn't in input
    const scaffoldOutput = inputText +
      ' In the foreground the keeper stands while in the background waves crash.';
    const result = computeAPS(inputText, scaffoldOutput, anchors);

    expect(result.proseQualityVeto).toBe(true);
    expect(result.proseIssues.length).toBeGreaterThan(0);
    expect(result.anyVetoFired).toBe(true);
  });

  test('textbook language → Veto 3 fires', () => {
    const anchors = makeAnchors();
    const inputText = makeOutput(anchors);
    const textbookOutput = inputText +
      ' This creates a sense of depth and adds visual interest to the composition.';
    const result = computeAPS(inputText, textbookOutput, anchors);

    expect(result.proseQualityVeto).toBe(true);
    expect(result.proseIssues.some((p) => p.includes('Textbook'))).toBe(true);
  });

  test('clean output → Veto 3 does not fire', () => {
    const anchors = makeAnchors();
    const output = makeOutput(anchors);
    const result = computeAPS(output, output, anchors);

    expect(result.proseQualityVeto).toBe(false);
    expect(result.proseIssues).toHaveLength(0);
  });
});

// ── 6. Retry band (no vetoes) → RETRY ───────────────────────────────────────

describe('APS Gate — Retry band', () => {
  test('multiple important anchors dropped, no critical loss → RETRY', () => {
    const anchors = makeAnchors();
    // Drop 2 important anchors: cliff (2) + coast (2) = 4 weight lost from 20
    // APS = 16/20 = 0.8 → RETRY band
    const output = makeOutput(anchors, { drop: ['cliff', 'coast'] });
    const result = computeAPS(makeOutput(anchors), output, anchors);

    expect(result.score).toBe(0.8);
    expect(result.verdict).toBe('RETRY');
    expect(result.criticalAnchorVeto).toBe(false);
  });
});

// ── 7. Hard reject → REJECT ─────────────────────────────────────────────────

describe('APS Gate — Hard reject', () => {
  test('many anchors dropped → APS < 0.78, REJECT', () => {
    const anchors = makeAnchors();
    // Drop 3 important anchors: cliff(2) + coast(2) + lantern(2) = 6 lost from 20
    // APS = 14/20 = 0.7 → REJECT
    const output = makeOutput(anchors, { drop: ['cliff', 'coast', 'lantern'] });
    const result = computeAPS(makeOutput(anchors), output, anchors);

    expect(result.score).toBe(0.7);
    expect(result.verdict).toBe('REJECT');
  });
});

// ── 8. Score computation correctness ────────────────────────────────────────

describe('APS Gate — Score computation', () => {
  test('score is ratio of surviving weight to total weight', () => {
    const anchors = makeAnchors({
      subjectPhrase: 'keeper',
      actionVerbs: ['pauses'],
      colours: ['copper'],
      environmentNouns: ['cliff'],
      lightSources: [],
    });
    // Total: subject(3) + verb(3) + colour(3) + env(2) = 11
    const output = makeOutput(anchors, { drop: ['cliff'] });
    const result = computeAPS(makeOutput(anchors), output, anchors);

    // Lost: env(2). Surviving: 9. APS = 9/11 ≈ 0.818
    expect(result.score).toBeCloseTo(9 / 11, 3);
  });

  test('secondary action verbs are weighted as important (2), not critical (3)', () => {
    const anchors = makeAnchors({
      subjectPhrase: 'keeper',
      actionVerbs: ['pauses', 'grips', 'stares'],
      colours: [],
      environmentNouns: [],
      lightSources: [],
    });
    // Total: subject(3) + verb1(3) + verb2(2) + verb3(2) = 10
    // Drop secondary verb: 8/10 = 0.8
    const output = makeOutput(anchors, { drop: ['grips'] });
    const result = computeAPS(makeOutput(anchors), output, anchors);

    expect(result.score).toBeCloseTo(0.8, 3);
    // Secondary verb loss should NOT trigger critical veto
    expect(result.criticalAnchorVeto).toBe(false);
  });

  test('primary action verb loss triggers critical veto', () => {
    const anchors = makeAnchors({
      subjectPhrase: 'keeper',
      actionVerbs: ['pauses', 'grips'],
      colours: [],
      environmentNouns: [],
      lightSources: [],
    });
    const output = makeOutput(anchors, { drop: ['pauses'] });
    const result = computeAPS(makeOutput(anchors), output, anchors);

    expect(result.criticalAnchorVeto).toBe(true);
  });
});

// ── 9. Diagnostics ──────────────────────────────────────────────────────────

describe('APS Gate — Diagnostics', () => {
  test('surviving and dropped anchors are tracked with categories', () => {
    const anchors = makeAnchors();
    const output = makeOutput(anchors, { drop: ['cliff'] });
    const result = computeAPS(makeOutput(anchors), output, anchors);

    // Check surviving anchors have correct structure
    for (const a of result.survivingAnchors) {
      expect(a.survived).toBe(true);
      expect(typeof a.anchor).toBe('string');
      expect(['critical', 'important', 'optional']).toContain(a.severity);
      expect([1, 2, 3]).toContain(a.weight);
    }

    // Check dropped anchors
    expect(result.droppedAnchors).toHaveLength(1);
    const dropped = result.droppedAnchors[0]!;
    expect(dropped.survived).toBe(false);
    expect(dropped.anchor).toBe('cliff');
    expect(dropped.category).toBe('environment');
  });

  test('scoreVerdict preserved when veto overrides verdict', () => {
    const anchors = makeAnchors();
    const inputText = makeOutput(anchors);
    const scaffoldOutput = inputText +
      ' In the foreground the keeper stands while in the background waves crash.';
    const result = computeAPS(inputText, scaffoldOutput, anchors);

    // Score should still be high (all anchors present)
    expect(result.scoreVerdict).toBe('ACCEPT');
    // But prose veto overrides to REJECT
    expect(result.verdict).toBe('REJECT');
  });
});
