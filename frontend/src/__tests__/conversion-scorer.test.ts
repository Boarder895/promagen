// src/__tests__/conversion-scorer.test.ts
import {
  scoreConversions,
  buildTaggedSelections,
  flattenSelections,
  WEIGHT_COHERENCE,
  WEIGHT_COST_EFFICIENCY,
  WEIGHT_IMPACT,
  STATIC_IMPACT,
  _deduplicateCandidates,
} from '@/lib/prompt-builder/conversion-scorer';
import type { ScoringContext } from '@/lib/prompt-builder/conversion-scorer';
import type { ConversionEntry } from '@/lib/prompt-builder/conversion-costs';
import type { ConversionBudget } from '@/lib/prompt-builder/conversion-budget';

function makeBudget(o: Partial<ConversionBudget> = {}): ConversionBudget {
  return { ceiling: 80, consumed: 30, remaining: 50, unit: 'words', source: 'static', diminishingReturnsAt: null, clipTokenBudget: null, ...o };
}
function makeCtx(o: Partial<ScoringContext> = {}): ScoringContext {
  return { platformId: 'flux', tier: 3, taggedSelections: [], allSelectionTerms: [], budget: makeBudget(), platformTermQualityLookup: null, platformCoOccurrenceLookup: null, ...o };
}
function makeEntry(o: Partial<ConversionEntry> = {}): ConversionEntry {
  return { from: '8k', output: 'captured with extraordinary clarity', cost: 4, isParametric: false, category: 'fidelity', costConfidence: 'exact', ...o };
}

describe('Conversion Scorer', () => {
  it('should sort by score descending', () => {
    const scored = scoreConversions([makeEntry({ cost: 4 }), makeEntry({ from: 'blurry', output: 'sharp focus', cost: 2, category: 'negative' })], makeCtx());
    expect(scored.length).toBe(2);
    expect(scored[0]!.score).toBeGreaterThanOrEqual(scored[1]!.score);
  });

  it('should give parametric costEfficiency = 1.0', () => {
    const scored = scoreConversions([makeEntry({ output: '--quality 2', cost: 0, isParametric: true })], makeCtx({ platformId: 'midjourney', tier: 2 }));
    expect(scored[0]!.costEfficiency).toBe(1.0);
  });

  it('should give parametric coherence = 0.8', () => {
    const scored = scoreConversions([makeEntry({ output: '--quality 2', cost: 0, isParametric: true })], makeCtx({ platformId: 'midjourney', tier: 2 }));
    expect(scored[0]!.coherence).toBe(0.8);
  });

  it('should keep all dimensions 0–1', () => {
    const s = scoreConversions([makeEntry()], makeCtx())[0]!;
    for (const d of [s.coherence, s.costEfficiency, s.impact, s.score]) {
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(1);
    }
  });

  it('should compute score as weighted sum', () => {
    const s = scoreConversions([makeEntry()], makeCtx())[0]!;
    const expected = s.coherence * WEIGHT_COHERENCE + s.costEfficiency * WEIGHT_COST_EFFICIENCY + s.impact * WEIGHT_IMPACT;
    expect(s.score).toBeCloseTo(expected, 4);
  });

  it('should give 0 costEfficiency at zero budget', () => {
    const s = scoreConversions([makeEntry({ cost: 5 })], makeCtx({ budget: makeBudget({ remaining: 0 }) }))[0]!;
    expect(s.costEfficiency).toBe(0.0);
  });

  it('should prefer cheaper conversions', () => {
    const scored = scoreConversions([
      makeEntry({ from: 'a', output: 'cheap', cost: 2 }),
      makeEntry({ from: 'b', output: 'expensive long phrase', cost: 9 }),
    ], makeCtx({ budget: makeBudget({ remaining: 20 }) }));
    const cheap = scored.find(s => s.from === 'a')!;
    const expensive = scored.find(s => s.from === 'b')!;
    expect(cheap.costEfficiency).toBeGreaterThan(expensive.costEfficiency);
  });

  it('should use static impact for known outputs', () => {
    const s = scoreConversions([makeEntry({ output: 'sharp focus' })], makeCtx())[0]!;
    expect(s.impact).toBe(STATIC_IMPACT['sharp focus']);
  });

  it('should use 0.5 impact for unknown outputs', () => {
    const s = scoreConversions([makeEntry({ output: 'completely unknown xyz' })], makeCtx())[0]!;
    expect(s.impact).toBe(0.5);
  });

  it('should deduplicate same output', () => {
    const scored = scoreConversions([
      makeEntry({ from: '8k', output: '--quality 2', isParametric: true, cost: 0 }),
      makeEntry({ from: '4k', output: '--quality 2', isParametric: true, cost: 0 }),
    ], makeCtx({ platformId: 'midjourney', tier: 2 }));
    expect(scored).toHaveLength(1);
    expect(scored[0]!.from).toBe('8k');
  });

  it('should include scoreExplanation', () => {
    const s = scoreConversions([makeEntry()], makeCtx())[0]!;
    expect(s.scoreExplanation).toBeDefined();
    expect(s.scoreExplanation.length).toBeGreaterThan(0);
  });

  it('should label parametric in explanation', () => {
    const s = scoreConversions([makeEntry({ output: '--quality 2', isParametric: true, cost: 0 })], makeCtx({ platformId: 'midjourney', tier: 2 }))[0]!;
    expect(s.scoreExplanation).toContain('Parametric');
  });

  it('should return true withinOptimal for parametric', () => {
    const s = scoreConversions([makeEntry({ isParametric: true, cost: 0 })], makeCtx())[0]!;
    expect(s.withinOptimal).toBe(true);
  });

  it('should return null withinOptimal without DR data', () => {
    const s = scoreConversions([makeEntry()], makeCtx({ budget: makeBudget({ diminishingReturnsAt: null }) }))[0]!;
    expect(s.withinOptimal).toBeNull();
  });

  describe('buildTaggedSelections()', () => {
    it('should exclude fidelity and negative', () => {
      const t = buildTaggedSelections({ style: ['photo'], fidelity: ['8K'], negative: ['blurry'], lighting: ['golden'] });
      expect(t).toHaveLength(2);
      expect(t.map(x => x.category)).not.toContain('fidelity');
    });
  });

  describe('flattenSelections()', () => {
    it('should flatten excluding fidelity/negative', () => {
      expect(flattenSelections({ style: ['photo'], fidelity: ['8K'], negative: ['blurry'], lighting: ['golden'] })).toEqual(['photo', 'golden']);
    });
  });

  describe('_deduplicateCandidates()', () => {
    it('should keep first occurrence', () => {
      const r = _deduplicateCandidates([makeEntry({ from: '8k', output: 'x' }), makeEntry({ from: 'mp', output: 'x' })]);
      expect(r).toHaveLength(1);
      expect(r[0]!.from).toBe('8k');
    });
  });
});
