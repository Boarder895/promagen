// src/lib/__tests__/retry-protocol.test.ts
// ============================================================================
// PHASE 8 — Iterative retry protocol tests
// ============================================================================
// Architecture: call-3-quality-architecture-v0.2.0.md §8
// Build plan:   call-3-quality-build-plan-v1.md §12
// ============================================================================

import {
  shouldRetry,
  buildRetryConfig,
  evaluateRetry,
  RETRY_NOT_ATTEMPTED,
} from '@/lib/optimise-prompts/retry-protocol';
import type { APSResult, AnchorSurvival } from '@/lib/optimise-prompts/aps-gate';
import { getDNA } from '@/data/platform-dna';
import type { PlatformDNA } from '@/data/platform-dna/types';

// ============================================================================
// TEST HELPERS
// ============================================================================

function dnaFor(id: string): PlatformDNA {
  const dna = getDNA(id);
  if (!dna) throw new Error(`No DNA for ${id}`);
  return dna;
}

/** Build a mock APS result. */
function mockAPS(overrides: Partial<APSResult>): APSResult {
  return {
    score: 0.80,
    verdict: 'RETRY',
    scoreVerdict: 'RETRY',
    criticalAnchorVeto: false,
    inventedContentVeto: false,
    proseQualityVeto: false,
    anyVetoFired: false,
    survivingAnchors: [],
    droppedAnchors: [
      { anchor: 'copper sky', category: 'colour', severity: 'important', weight: 2, survived: false },
    ],
    inventedContent: [],
    proseIssues: [],
    ...overrides,
  };
}

// ============================================================================
// shouldRetry
// ============================================================================

describe('shouldRetry', () => {
  it('returns true for RETRY verdict on retry-enabled platform', () => {
    const aps = mockAPS({ verdict: 'RETRY', score: 0.78 });
    const dna = dnaFor('recraft'); // retryEnabled: true

    const decision = shouldRetry(aps, dna);

    expect(decision.shouldRetry).toBe(true);
    expect(decision.reason).toContain('RETRY band');
  });

  it('returns false for REJECT verdict', () => {
    const aps = mockAPS({ verdict: 'REJECT', score: 0.50 });
    const dna = dnaFor('recraft');

    const decision = shouldRetry(aps, dna);

    expect(decision.shouldRetry).toBe(false);
    expect(decision.reason).toContain('not RETRY');
  });

  it('returns false for ACCEPT verdict', () => {
    const aps = mockAPS({ verdict: 'ACCEPT', score: 0.92 });
    const dna = dnaFor('recraft');

    const decision = shouldRetry(aps, dna);

    expect(decision.shouldRetry).toBe(false);
  });

  it('returns false when platform has retry disabled', () => {
    const aps = mockAPS({ verdict: 'RETRY', score: 0.78 });
    const dna = dnaFor('stability'); // retryEnabled: false (deterministic)

    const decision = shouldRetry(aps, dna);

    expect(decision.shouldRetry).toBe(false);
    expect(decision.reason).toContain('retry enabled');
  });

  it('returns false when no DNA provided', () => {
    const aps = mockAPS({ verdict: 'RETRY' });

    const decision = shouldRetry(aps, null);

    expect(decision.shouldRetry).toBe(false);
  });

  it('returns false when vetoes fired', () => {
    const aps = mockAPS({
      verdict: 'RETRY',
      anyVetoFired: true,
      inventedContentVeto: true,
    });
    const dna = dnaFor('recraft');

    const decision = shouldRetry(aps, dna);

    expect(decision.shouldRetry).toBe(false);
    expect(decision.reason).toContain('structural problem');
  });

  it('returns false when no dropped anchors to recover', () => {
    const aps = mockAPS({
      verdict: 'RETRY',
      droppedAnchors: [],
    });
    const dna = dnaFor('recraft');

    const decision = shouldRetry(aps, dna);

    expect(decision.shouldRetry).toBe(false);
    expect(decision.reason).toContain('No dropped anchors');
  });

  it('works for all 4 retry-enabled platforms', () => {
    const retryPlatforms = ['recraft', 'openai', 'flux', 'kling'];
    const aps = mockAPS({ verdict: 'RETRY' });

    for (const platformId of retryPlatforms) {
      const dna = dnaFor(platformId);
      const decision = shouldRetry(aps, dna);
      expect(decision.shouldRetry).toBe(true);
    }
  });
});

// ============================================================================
// buildRetryConfig
// ============================================================================

describe('buildRetryConfig', () => {
  it('builds a retry message with explicit anchor list', () => {
    const dropped: AnchorSurvival[] = [
      { anchor: 'copper sky', category: 'colour', severity: 'important', weight: 2, survived: false },
      { anchor: 'lighthouse beam', category: 'light_source', severity: 'critical', weight: 3, survived: false },
    ];

    const config = buildRetryConfig(
      'PROMPT TO OPTIMISE: test prompt',
      'first attempt output text',
      dropped,
      0.3,
      dnaFor('recraft'),
    );

    expect(config.retryUserMessage).toContain('copper sky');
    expect(config.retryUserMessage).toContain('lighthouse beam');
    expect(config.retryUserMessage).toContain('RETRY');
    expect(config.retryUserMessage).toContain('ANCHOR RECOVERY');
    expect(config.retryUserMessage).toContain('EXACT terms');
  });

  it('lowers temperature for retry', () => {
    const config = buildRetryConfig(
      'test',
      'output',
      [{ anchor: 'test', category: 'colour', severity: 'important', weight: 2, survived: false }],
      0.4,
      dnaFor('recraft'),
    );

    expect(config.retryTemperature).toBeCloseTo(0.3, 5); // 0.4 - 0.1
  });

  it('does not go below temperature floor', () => {
    const config = buildRetryConfig(
      'test',
      'output',
      [{ anchor: 'test', category: 'colour', severity: 'important', weight: 2, survived: false }],
      0.1,
      dnaFor('recraft'),
    );

    expect(config.retryTemperature).toBe(0.1); // Floor is 0.1
  });

  it('includes character ceiling from DNA', () => {
    const dna = dnaFor('recraft');
    const config = buildRetryConfig(
      'test',
      'output',
      [{ anchor: 'test', category: 'colour', severity: 'important', weight: 2, survived: false }],
      0.3,
      dna,
    );

    expect(config.retryUserMessage).toContain(String(dna.charCeiling));
  });
});

// ============================================================================
// evaluateRetry
// ============================================================================

describe('evaluateRetry', () => {
  it('accepts retry when APS ≥ 0.88, no vetoes, and anchors recovered', () => {
    const retryAps = mockAPS({ score: 0.92, verdict: 'ACCEPT', droppedAnchors: [] });
    const originalDropped: AnchorSurvival[] = [
      { anchor: 'copper sky', category: 'colour', severity: 'important', weight: 2, survived: false },
    ];

    const result = evaluateRetry(retryAps, originalDropped);

    expect(result.accepted).toBe(true);
    expect(result.summary).toContain('accepted');
    expect(result.summary).toContain('recovered 1/1');
  });

  it('rejects retry when APS below 0.88', () => {
    const retryAps = mockAPS({ score: 0.82, verdict: 'RETRY' });
    const originalDropped: AnchorSurvival[] = [
      { anchor: 'copper sky', category: 'colour', severity: 'important', weight: 2, survived: false },
    ];

    const result = evaluateRetry(retryAps, originalDropped);

    expect(result.accepted).toBe(false);
    expect(result.summary).toContain('below');
  });

  it('rejects retry when vetoes fire', () => {
    const retryAps = mockAPS({
      score: 0.90,
      verdict: 'ACCEPT',
      anyVetoFired: true,
      inventedContentVeto: true,
    });

    const result = evaluateRetry(retryAps, []);

    expect(result.accepted).toBe(false);
    expect(result.summary).toContain('veto');
  });

  it('reports recovered anchor count', () => {
    const retryAps = mockAPS({
      score: 0.95,
      verdict: 'ACCEPT',
      droppedAnchors: [], // All recovered
    });
    const originalDropped: AnchorSurvival[] = [
      { anchor: 'copper sky', category: 'colour', severity: 'important', weight: 2, survived: false },
      { anchor: 'storm clouds', category: 'environment', severity: 'important', weight: 2, survived: false },
    ];

    const result = evaluateRetry(retryAps, originalDropped);

    expect(result.accepted).toBe(true);
    expect(result.summary).toContain('recovered 2/2');
  });

  it('rejects retry when important anchor still missing (ChatGPT 95/100 fix)', () => {
    const retryAps = mockAPS({
      score: 0.90,
      verdict: 'ACCEPT',
      droppedAnchors: [
        { anchor: 'copper sky', category: 'colour', severity: 'important', weight: 2, survived: false },
      ],
    });
    const originalDropped: AnchorSurvival[] = [
      { anchor: 'copper sky', category: 'colour', severity: 'important', weight: 2, survived: false },
      { anchor: 'storm clouds', category: 'environment', severity: 'important', weight: 2, survived: false },
    ];

    const result = evaluateRetry(retryAps, originalDropped);

    // Stricter policy: important anchor still missing = reject
    expect(result.accepted).toBe(false);
    expect(result.summary).toContain('critical/important');
    expect(result.summary).toContain('copper sky');
  });

  it('accepts retry when only optional anchors still missing', () => {
    const retryAps = mockAPS({
      score: 0.90,
      verdict: 'ACCEPT',
      droppedAnchors: [
        { anchor: 'bokeh', category: 'environment', severity: 'optional', weight: 1, survived: false },
      ],
    });
    const originalDropped: AnchorSurvival[] = [
      { anchor: 'copper sky', category: 'colour', severity: 'important', weight: 2, survived: false },
      { anchor: 'bokeh', category: 'environment', severity: 'optional', weight: 1, survived: false },
    ];

    const result = evaluateRetry(retryAps, originalDropped);

    // Optional anchors missing is OK — only critical/important must recover
    expect(result.accepted).toBe(true);
    expect(result.summary).toContain('optional still missing');
  });
});

// ============================================================================
// RETRY_NOT_ATTEMPTED
// ============================================================================

describe('RETRY_NOT_ATTEMPTED', () => {
  it('has correct shape', () => {
    expect(RETRY_NOT_ATTEMPTED.attempted).toBe(false);
    expect(RETRY_NOT_ATTEMPTED.accepted).toBe(false);
    expect(RETRY_NOT_ATTEMPTED.retryApsScore).toBeNull();
  });
});

// ============================================================================
// PLATFORM GATING — Architecture §8.3
// ============================================================================

describe('Platform retry gating (architecture §8.3)', () => {
  it('retry is enabled on recraft, openai, flux, kling', () => {
    const enabled = ['recraft', 'openai', 'flux', 'kling'];
    for (const id of enabled) {
      const dna = dnaFor(id);
      expect(dna.retryEnabled).toBe(true);
    }
  });

  it('retry is disabled on ideogram, runway, stability', () => {
    const disabled = ['ideogram', 'runway', 'stability'];
    for (const id of disabled) {
      const dna = getDNA(id);
      if (dna) {
        expect(dna.retryEnabled).toBe(false);
      }
    }
  });
});
