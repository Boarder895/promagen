// src/hooks/__tests__/use-learning-data.test.ts
// ============================================================================
// UNIFIED LEARNING DATA HOOK — Tests
// ============================================================================
//
// Phase 7.5, Part 7.5e (Improvement 1) + Phase 7.6e — Tests for the
// useLearningData facade hook that composes:
//   • useLearnedWeights   (tier-level, Phases 5–7.4)
//   • usePlatformLearning (platform-level, Phase 7.5)
//   • useABTest           (A/B variant assignment, Phase 7.6)
//
// All three sub-hooks are mocked so we test pure composition only.
//
// Version: 2.0.0 — Phase 7.6e A/B mock added (eliminates fetch noise)
// Existing features preserved: Yes.
// ============================================================================

import { renderHook } from '@testing-library/react';
import { useLearningData } from '../use-learning-data';

// ============================================================================
// MOCK SETUP
// ============================================================================

// Mock all three sub-hooks so we test pure composition, not their internals

const mockTierReturn = {
  coOccurrenceLookup: null,
  scoringWeights: null,
  blendRatio: [1.0, 0.0] as [number, number],
  antiPatternLookup: null,
  collisionLookup: null,
  weakTermLookup: null,
  redundancyLookup: null,
  comboLookup: null,
  isLoading: false,
  error: null as string | null,
  refetch: jest.fn(() => Promise.resolve()),
};

const mockPlatformReturn = {
  platformTermQualityLookup: null,
  platformCoOccurrenceLookup: null,
  isLoading: false,
  error: null as string | null,
  lastUpdatedAt: null,
  dataAge: null,
  refetch: jest.fn(() => Promise.resolve()),
};

const mockABReturn = {
  activeTestId: null as string | null,
  activeTestName: null as string | null,
  variant: null as 'A' | 'B' | null,
  variantWeights: null as Record<string, number> | null,
  abHash: null as string | null,
  isLoading: false,
  error: null as string | null,
  refetch: jest.fn(() => Promise.resolve()),
};

jest.mock('../use-learned-weights', () => ({
  useLearnedWeights: () => mockTierReturn,
}));

jest.mock('../use-platform-learning', () => ({
  usePlatformLearning: () => mockPlatformReturn,
}));

jest.mock('../use-ab-test', () => ({
  useABTest: () => mockABReturn,
}));

// ============================================================================
// TESTS
// ============================================================================

describe('useLearningData', () => {
  beforeEach(() => {
    // Reset to defaults
    mockTierReturn.isLoading = false;
    mockTierReturn.error = null;
    mockPlatformReturn.isLoading = false;
    mockPlatformReturn.error = null;
    mockABReturn.isLoading = false;
    mockABReturn.error = null;
    mockABReturn.activeTestId = null;
    mockABReturn.variant = null;
    mockABReturn.variantWeights = null;
    mockABReturn.abHash = null;
    mockTierReturn.refetch.mockClear();
    mockPlatformReturn.refetch.mockClear();
    mockABReturn.refetch.mockClear();
  });

  it('exposes all tier-level fields', () => {
    const { result } = renderHook(() => useLearningData());

    expect(result.current).toHaveProperty('coOccurrenceLookup');
    expect(result.current).toHaveProperty('scoringWeights');
    expect(result.current).toHaveProperty('blendRatio');
    expect(result.current).toHaveProperty('antiPatternLookup');
    expect(result.current).toHaveProperty('collisionLookup');
    expect(result.current).toHaveProperty('weakTermLookup');
    expect(result.current).toHaveProperty('redundancyLookup');
    expect(result.current).toHaveProperty('comboLookup');
  });

  it('exposes all platform-level fields', () => {
    const { result } = renderHook(() => useLearningData());

    expect(result.current).toHaveProperty('platformTermQualityLookup');
    expect(result.current).toHaveProperty('platformCoOccurrenceLookup');
    expect(result.current).toHaveProperty('platformLastUpdatedAt');
    expect(result.current).toHaveProperty('platformDataAge');
  });

  it('exposes all A/B testing fields', () => {
    const { result } = renderHook(() => useLearningData());

    expect(result.current).toHaveProperty('activeTestId');
    expect(result.current).toHaveProperty('activeTestName');
    expect(result.current).toHaveProperty('abVariant');
    expect(result.current).toHaveProperty('abVariantWeights');
    expect(result.current).toHaveProperty('abHash');
    expect(result.current).toHaveProperty('abIsLoading');
  });

  it('isLoading is true only when BOTH tier + platform hooks are loading', () => {
    // Both loading → true
    mockTierReturn.isLoading = true;
    mockPlatformReturn.isLoading = true;
    const { result: r1 } = renderHook(() => useLearningData());
    expect(r1.current.isLoading).toBe(true);

    // Only tier loading → false
    mockTierReturn.isLoading = true;
    mockPlatformReturn.isLoading = false;
    const { result: r2 } = renderHook(() => useLearningData());
    expect(r2.current.isLoading).toBe(false);

    // Only platform loading → false
    mockTierReturn.isLoading = false;
    mockPlatformReturn.isLoading = true;
    const { result: r3 } = renderHook(() => useLearningData());
    expect(r3.current.isLoading).toBe(false);

    // Neither loading → false
    mockTierReturn.isLoading = false;
    mockPlatformReturn.isLoading = false;
    const { result: r4 } = renderHook(() => useLearningData());
    expect(r4.current.isLoading).toBe(false);
  });

  it('abIsLoading tracks AB hook independently', () => {
    mockABReturn.isLoading = true;
    const { result } = renderHook(() => useLearningData());
    expect(result.current.abIsLoading).toBe(true);
    // Main isLoading is NOT affected by AB loading
    expect(result.current.isLoading).toBe(false);
  });

  it('error surfaces first non-null error (tier priority)', () => {
    mockTierReturn.error = 'tier error';
    mockPlatformReturn.error = 'platform error';
    const { result } = renderHook(() => useLearningData());
    expect(result.current.error).toBe('tier error');
  });

  it('error surfaces platform error when tier is ok', () => {
    mockTierReturn.error = null;
    mockPlatformReturn.error = 'platform error';
    const { result } = renderHook(() => useLearningData());
    expect(result.current.error).toBe('platform error');
  });

  it('error surfaces AB error when tier and platform are ok', () => {
    mockTierReturn.error = null;
    mockPlatformReturn.error = null;
    mockABReturn.error = 'ab error';
    const { result } = renderHook(() => useLearningData());
    expect(result.current.error).toBe('ab error');
  });

  it('error is null when all hooks are ok', () => {
    mockTierReturn.error = null;
    mockPlatformReturn.error = null;
    mockABReturn.error = null;
    const { result } = renderHook(() => useLearningData());
    expect(result.current.error).toBeNull();
  });

  it('refetch calls all three sub-hook refetch functions', async () => {
    const { result } = renderHook(() => useLearningData());
    await result.current.refetch();

    expect(mockTierReturn.refetch).toHaveBeenCalledTimes(1);
    expect(mockPlatformReturn.refetch).toHaveBeenCalledTimes(1);
    expect(mockABReturn.refetch).toHaveBeenCalledTimes(1);
  });
});
