// src/lib/__tests__/call-3-harness-triage.test.ts
// ============================================================================
// PHASE 6 — Triage computation tests
// ============================================================================
// Architecture: call-3-quality-architecture-v0.2.0.md §9.2
// Build plan:   call-3-quality-build-plan-v1.md §10
// ============================================================================

import {
  assignBucket,
  computeHeadroomFraction,
  computeTriage,
  generateTriageMarkdown,
  estimateCeiling,
} from '@/lib/call-3-harness/triage';
import type { PlatformBatchScore } from '@/lib/call-3-harness/triage';
import type { PlatformDNA } from '@/data/platform-dna/types';
import { getDNA, getAllDNA } from '@/data/platform-dna';

// ============================================================================
// BUCKET ASSIGNMENT
// ============================================================================

describe('assignBucket', () => {
  it('assigns green for ≥50% headroom fraction', () => {
    expect(assignBucket(0.50)).toBe('green');
    expect(assignBucket(0.75)).toBe('green');
    expect(assignBucket(1.0)).toBe('green');
  });

  it('assigns amber for 20–49% headroom fraction', () => {
    expect(assignBucket(0.20)).toBe('amber');
    expect(assignBucket(0.35)).toBe('amber');
    expect(assignBucket(0.49)).toBe('amber');
  });

  it('assigns red for <20% headroom fraction', () => {
    expect(assignBucket(0.19)).toBe('red');
    expect(assignBucket(0.0)).toBe('red');
    expect(assignBucket(-0.1)).toBe('red');
  });

  it('assigns red for negative headroom fraction (Call 3 degraded output)', () => {
    expect(assignBucket(-0.5)).toBe('red');
    expect(assignBucket(-1.0)).toBe('red');
  });
});

// ============================================================================
// HEADROOM FRACTION COMPUTATION
// ============================================================================

describe('computeHeadroomFraction', () => {
  it('computes correct fraction for normal case', () => {
    // Baseline 80, optimised 90, ceiling 100 → gain 10, headroom 20, fraction 0.5
    const result = computeHeadroomFraction(80, 90, 100);

    expect(result.absoluteGain).toBe(10);
    expect(result.availableHeadroom).toBe(20);
    expect(result.headroomFraction).toBe(0.5);
  });

  it('returns 0 fraction when baseline equals ceiling', () => {
    const result = computeHeadroomFraction(100, 100, 100);

    expect(result.availableHeadroom).toBe(0);
    expect(result.headroomFraction).toBe(0);
  });

  it('returns 0 fraction when baseline exceeds ceiling', () => {
    const result = computeHeadroomFraction(105, 105, 100);

    expect(result.availableHeadroom).toBe(0);
    expect(result.headroomFraction).toBe(0);
  });

  it('returns negative fraction when Call 3 degrades output', () => {
    // Baseline 80, optimised 75, ceiling 100 → gain -5, headroom 20, fraction -0.25
    const result = computeHeadroomFraction(80, 75, 100);

    expect(result.absoluteGain).toBe(-5);
    expect(result.headroomFraction).toBe(-0.25);
  });

  it('returns fraction > 1 when gain exceeds available headroom', () => {
    // Possible if scoring model is generous or ceiling is conservative
    const result = computeHeadroomFraction(80, 105, 100);

    expect(result.absoluteGain).toBe(25);
    expect(result.headroomFraction).toBe(1.25);
  });
});

// ============================================================================
// FULL TRIAGE COMPUTATION
// ============================================================================

describe('computeTriage', () => {
  const mockScores: PlatformBatchScore[] = [
    // Platform A: strong improvement (green)
    { platformId: 'platform-a', sceneId: 'scene-01', assembledScore: 80, optimisedScore: 92 },
    { platformId: 'platform-a', sceneId: 'scene-02', assembledScore: 78, optimisedScore: 90 },
    // Platform B: marginal improvement (amber)
    { platformId: 'platform-b', sceneId: 'scene-01', assembledScore: 85, optimisedScore: 89 },
    { platformId: 'platform-b', sceneId: 'scene-02', assembledScore: 83, optimisedScore: 87 },
    // Platform C: degradation (red)
    { platformId: 'platform-c', sceneId: 'scene-01', assembledScore: 88, optimisedScore: 85 },
    { platformId: 'platform-c', sceneId: 'scene-02', assembledScore: 90, optimisedScore: 86 },
  ];

  const mockDnaMap = new Map<string, PlatformDNA>();

  it('triages into correct buckets', () => {
    const report = computeTriage(mockScores, mockDnaMap);

    expect(report.platformCount).toBe(3);

    // Platform A: baseline ~79, optimised ~91, gain ~12, headroom ~21, fraction ~0.57 → green
    const a = report.platforms.find((p) => p.platformId === 'platform-a');
    expect(a?.bucket).toBe('green');

    // Platform B: baseline ~84, optimised ~88, gain ~4, headroom ~16, fraction ~0.25 → amber
    const b = report.platforms.find((p) => p.platformId === 'platform-b');
    expect(b?.bucket).toBe('amber');

    // Platform C: baseline ~89, optimised ~85.5, gain ~-3.5, fraction negative → red
    const c = report.platforms.find((p) => p.platformId === 'platform-c');
    expect(c?.bucket).toBe('red');
  });

  it('counts buckets correctly', () => {
    const report = computeTriage(mockScores, mockDnaMap);

    expect(report.greenCount).toBe(1);
    expect(report.amberCount).toBe(1);
    expect(report.redCount).toBe(1);
  });

  it('sorts platforms by headroom fraction descending', () => {
    const report = computeTriage(mockScores, mockDnaMap);

    for (let i = 1; i < report.platforms.length; i++) {
      expect(report.platforms[i]!.headroomFraction)
        .toBeLessThanOrEqual(report.platforms[i - 1]!.headroomFraction);
    }
  });

  it('computes global means', () => {
    const report = computeTriage(mockScores, mockDnaMap);

    expect(report.globalMeanBaseline).toBeGreaterThan(0);
    expect(report.globalMeanOptimised).toBeGreaterThan(0);
  });

  it('includes per-scene breakdown', () => {
    const report = computeTriage(mockScores, mockDnaMap);

    const a = report.platforms.find((p) => p.platformId === 'platform-a');
    expect(a?.scenes.length).toBe(2);
    expect(a?.scenes[0]?.gain).toBe(12); // 92 - 80
  });

  it('handles empty input gracefully', () => {
    const report = computeTriage([], mockDnaMap);

    expect(report.platformCount).toBe(0);
    expect(report.greenCount).toBe(0);
    expect(report.globalMeanBaseline).toBe(0);
  });
});

// ============================================================================
// MARKDOWN REPORT
// ============================================================================

describe('generateTriageMarkdown', () => {
  it('produces valid markdown with headers and table', () => {
    const mockScores: PlatformBatchScore[] = [
      { platformId: 'stability', sceneId: 'scene-01', assembledScore: 80, optimisedScore: 90 },
    ];
    const dnaMap = new Map<string, PlatformDNA>();
    const dna = getDNA('stability');
    if (dna) dnaMap.set('stability', dna);

    const report = computeTriage(mockScores, dnaMap);
    const md = generateTriageMarkdown(report);

    expect(md).toContain('# Harmony Pass 2.0');
    expect(md).toContain('| Platform |');
    expect(md).toContain('stability');
    expect(md).toContain('Det'); // stability is deterministic
  });
});

// ============================================================================
// TEST SCENE INTEGRITY — Phase 6 prerequisites
// ============================================================================

describe('Test scene diversity (Phase 6 prerequisite)', () => {
   
  const scenes = require('@/data/scoring/test-scenes.json') as Array<{
    id: string;
    sceneCategory?: string;
  }>;

  it('has at least 10 test scenes', () => {
    expect(scenes.length).toBeGreaterThanOrEqual(10);
  });

  it('includes an indoor_character scene', () => {
    const indoor = scenes.filter((s) => s.sceneCategory === 'indoor_character');
    expect(indoor.length).toBeGreaterThanOrEqual(1);
  });

  it('includes an abstract_stylised scene', () => {
    const abstract = scenes.filter((s) => s.sceneCategory === 'abstract_stylised');
    expect(abstract.length).toBeGreaterThanOrEqual(1);
  });

  it('includes an outdoor_dramatic scene', () => {
    const outdoor = scenes.filter((s) => s.sceneCategory === 'outdoor_dramatic');
    expect(outdoor.length).toBeGreaterThanOrEqual(1);
  });

  it('covers all 3 mandatory scene categories (architecture §9.3)', () => {
    const categories = new Set(scenes.map((s) => s.sceneCategory).filter(Boolean));
    expect(categories.has('outdoor_dramatic')).toBe(true);
    expect(categories.has('indoor_character')).toBe(true);
    expect(categories.has('abstract_stylised')).toBe(true);
  });
});

// ============================================================================
// CEILING ESTIMATION — ChatGPT 93/100 fix
// ============================================================================

describe('estimateCeiling (DNA-derived ceilings)', () => {
  it('returns fallback 100 when no DNA provided', () => {
    const result = estimateCeiling(null);

    expect(result.ceiling).toBe(100);
    expect(result.source).toBe('fallback');
  });

  it('uses encoder-family estimate for CLIP platforms', () => {
    const dna = getDNA('stability');
    const result = estimateCeiling(dna);

    expect(result.ceiling).toBe(95); // CLIP estimate
    expect(result.source).toBe('estimated');
  });

  it('uses encoder-family estimate for T5 platforms', () => {
    const dna = getDNA('flux');
    const result = estimateCeiling(dna);

    // flux is T5 → 97
    expect(result.ceiling).toBe(97);
    expect(result.source).toBe('estimated');
  });

  it('uses measured ceiling when DNA has optimisedScore', () => {
    // Create a mock DNA with measured optimisedScore
    const mockDna = {
      ...getDNA('stability')!,
      optimisedScore: 92,
    } as PlatformDNA;

    const result = estimateCeiling(mockDna);

    // measured = max(92 + 3, 95) = 95, capped at 100
    expect(result.ceiling).toBe(95);
    expect(result.source).toBe('measured');
  });

  it('never exceeds 100', () => {
    const mockDna = {
      ...getDNA('stability')!,
      optimisedScore: 99,
    } as PlatformDNA;

    const result = estimateCeiling(mockDna);

    // max(99 + 3, 95) = 102, capped at 100
    expect(result.ceiling).toBeLessThanOrEqual(100);
  });

  it('triage report includes ceilingSource', () => {
    const scores: PlatformBatchScore[] = [
      { platformId: 'stability', sceneId: 'scene-01', assembledScore: 80, optimisedScore: 90 },
    ];
    const dnaMap = new Map<string, PlatformDNA>();
    const dna = getDNA('stability');
    if (dna) dnaMap.set('stability', dna);

    const report = computeTriage(scores, dnaMap);

    expect(report.platforms[0]?.ceilingSource).toBe('estimated');
    expect(report.platforms[0]?.ceiling).toBe(95);
  });

  it('uses different ceilings for different encoder families', () => {
    const scores: PlatformBatchScore[] = [
      { platformId: 'stability', sceneId: 'scene-01', assembledScore: 80, optimisedScore: 88 },
      { platformId: 'flux', sceneId: 'scene-01', assembledScore: 80, optimisedScore: 88 },
    ];
    const dnaMap = new Map<string, PlatformDNA>();
    const stabDna = getDNA('stability');
    const fluxDna = getDNA('flux');
    if (stabDna) dnaMap.set('stability', stabDna);
    if (fluxDna) dnaMap.set('flux', fluxDna);

    const report = computeTriage(scores, dnaMap);

    const stab = report.platforms.find((p) => p.platformId === 'stability');
    const flux = report.platforms.find((p) => p.platformId === 'flux');

    // CLIP ceiling 95 vs T5 ceiling 97 → different headroom
    expect(stab?.ceiling).toBe(95);
    expect(flux?.ceiling).toBe(97);
    expect(stab?.availableHeadroom).not.toBe(flux?.availableHeadroom);
  });

  it('markdown shows ceiling source', () => {
    const scores: PlatformBatchScore[] = [
      { platformId: 'stability', sceneId: 'scene-01', assembledScore: 80, optimisedScore: 88 },
    ];
    const dnaMap = new Map<string, PlatformDNA>();
    const dna = getDNA('stability');
    if (dna) dnaMap.set('stability', dna);

    const report = computeTriage(scores, dnaMap);
    const md = generateTriageMarkdown(report);

    // Should show ceiling with source indicator
    expect(md).toContain('95 (E)'); // E = estimated
    expect(md).toContain('Ceiling (src)');
  });
});
