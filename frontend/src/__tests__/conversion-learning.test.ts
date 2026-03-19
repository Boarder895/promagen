// src/__tests__/conversion-learning.test.ts
import { computeTermQualityScores } from '@/lib/learning/term-quality-scoring';
import type { PromptEventRow } from '@/lib/learning/database';

/** MIN_EVENTS_FOR_SCORING = 30, so tests need 35+ events with outcome variance */
const EVENT_COUNT = 35;

function buildEvent(o: Partial<PromptEventRow> = {}, index: number = 0): PromptEventRow {
  // Vary outcomes so stddev > 0 and z-scores produce non-trivial results
  const varied = index % 3 === 0;
  return {
    id: `evt_${Math.random().toString(36).slice(2)}`,
    session_id: '550e8400-e29b-41d4-a716-446655440000',
    attempt_number: 1,
    selections: { subject: ['mountain landscape'], style: ['photorealistic'], lighting: ['golden hour'], colour: ['warm tones'] },
    category_count: 4, char_length: varied ? 200 : 120, score: varied ? 95 : 91,
    score_factors: { coherence: varied ? 95 : 88, fill: varied ? 98 : 90 },
    platform: 'flux', tier: 3, scene_used: null,
    outcome: {
      copied: true,
      saved: varied,
      returnedWithin60s: varied,
      reusedFromLibrary: false,
    },
    feedback_rating: null, feedback_credibility: null,
    conversion_meta: null,
    created_at: new Date().toISOString(),
    ...o,
  };
}

describe('Conversion Learning Pipeline', () => {
  it('should process events without conversion_meta', () => {
    const r = computeTermQualityScores(Array.from({ length: EVENT_COUNT }, (_, i) => buildEvent({}, i)));
    expect(r.eventCount).toBe(EVENT_COUNT);
    expect(r.global.termCount).toBeGreaterThan(0);
  });

  it('should index conversion output terms', () => {
    const events = Array.from({ length: EVENT_COUNT }, (_, i) => buildEvent({
      selections: { subject: ['portrait'], style: ['photorealistic'], lighting: ['studio'], colour: ['balanced'], fidelity: ['8k'] },
      category_count: 5,
      conversion_meta: { fidelityConverted: 1, fidelityDeferred: 0, negativesConverted: 0, negativesDeferred: 0, budgetCeiling: 80, budgetRemaining: 40, parametricCount: 0 },
    }, i));
    const r = computeTermQualityScores(events);
    expect(Object.keys(r.global.terms)).toContain('captured with extraordinary clarity');
  });

  it('should index both original and converted terms', () => {
    const events = Array.from({ length: EVENT_COUNT }, (_, i) => buildEvent({
      selections: { subject: ['cat'], style: ['photorealistic'], lighting: ['soft'], colour: ['warm'], fidelity: ['8k'] },
      category_count: 5,
      conversion_meta: { fidelityConverted: 1, fidelityDeferred: 0, negativesConverted: 0, negativesDeferred: 0, budgetCeiling: 80, budgetRemaining: 50, parametricCount: 0 },
    }, i));
    const r = computeTermQualityScores(events);
    const terms = Object.keys(r.global.terms);
    expect(terms).toContain('8k');
    expect(terms).toContain('captured with extraordinary clarity');
  });

  it('should tag conversion terms with source: conversion', () => {
    const events = Array.from({ length: EVENT_COUNT }, (_, i) => buildEvent({
      selections: { subject: ['cat'], style: ['photorealistic'], lighting: ['soft'], colour: ['warm'], fidelity: ['8k'] },
      category_count: 5,
      conversion_meta: { fidelityConverted: 1, fidelityDeferred: 0, negativesConverted: 0, negativesDeferred: 0, budgetCeiling: 80, budgetRemaining: 50, parametricCount: 0 },
    }, i));
    const r = computeTermQualityScores(events);
    const ct = r.global.terms['captured with extraordinary clarity'];
    if (ct) { expect(ct.source).toBe('conversion'); }
    const ut = r.global.terms['photorealistic'];
    if (ut) { expect(ut.source).toBe('user'); }
  });

  it('should NOT index conversion terms when meta is null', () => {
    const events = Array.from({ length: EVENT_COUNT }, (_, i) => buildEvent({
      selections: { subject: ['cat'], style: ['photorealistic'], lighting: ['soft'], colour: ['warm'], fidelity: ['8k'] },
      category_count: 5, conversion_meta: null,
    }, i));
    const r = computeTermQualityScores(events);
    expect(Object.keys(r.global.terms)).not.toContain('captured with extraordinary clarity');
  });

  it('should index negative conversion outputs', () => {
    const events = Array.from({ length: EVENT_COUNT }, (_, i) => buildEvent({
      platform: 'openai', tier: 3,
      selections: { subject: ['portrait'], style: ['photorealistic'], lighting: ['studio'], colour: ['balanced'], negative: ['blurry'] },
      category_count: 5,
      conversion_meta: { fidelityConverted: 0, fidelityDeferred: 0, negativesConverted: 1, negativesDeferred: 0, budgetCeiling: 160, budgetRemaining: 100, parametricCount: 0 },
    }, i));
    const r = computeTermQualityScores(events);
    expect(Object.keys(r.global.terms)).toContain('sharp focus');
  });
});
