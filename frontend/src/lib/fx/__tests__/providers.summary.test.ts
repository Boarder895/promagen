import { describe, expect, it } from '@jest/globals';

import { getFxProviderSummary } from '@/lib/fx/providers';

describe('getFxProviderSummary', () => {
  it('defaults to Twelve Data when providerId is null', () => {
    const s = getFxProviderSummary(null, null);

    expect(s.meta.id).toBe('twelvedata');
    expect(s.meta.name).toBe('Twelve Data');
    expect(s.modeLabel).toBe('—');
    expect(s.emphasiseFallback).toBe(false);
  });

  it('maps live mode correctly', () => {
    const s = getFxProviderSummary('live' as any, 'twelvedata');

    expect(s.modeLabel).toBe('Live');
    expect(s.meta.id).toBe('twelvedata');
    expect(s.meta.name).toBe('Twelve Data');
    expect(s.emphasiseFallback).toBe(false);
  });

  it('maps cached mode correctly', () => {
    const s = getFxProviderSummary('cached' as any, 'cache');

    expect(s.modeLabel).toBe('Cached');
    expect(s.meta.id).toBe('cache');
    expect(s.meta.name).toBe('Cache');
    expect(s.emphasiseFallback).toBe(false);
  });

  it('maps fallback mode and emphasises fallback', () => {
    const s = getFxProviderSummary('fallback' as any, 'fallback');

    expect(s.modeLabel).toBe('Fallback');
    expect(s.meta.id).toBe('fallback');
    expect(s.meta.name).toBe('Fallback');
    expect(s.emphasiseFallback).toBe(true);
  });

  it('passes through unknown provider names safely', () => {
    const s = getFxProviderSummary('live' as any, 'mystery-provider');

    expect(s.meta.id).toBe('mystery-provider');
    expect(s.meta.name).toBe('mystery-provider');
    expect(s.modeLabel).toBe('Live');
  });
});
