// src/hooks/__tests__/use-learning-data.test.ts
// ============================================================================
// UNIFIED LEARNING DATA HOOK — Tests
// ============================================================================
//
// Phase 7.5, Part 7.5e (Improvement 1) — Tests for the useLearningData
// facade hook that composes useLearnedWeights + usePlatformLearning.
//
// Version: 1.0.0
// Existing features preserved: Yes.
// ============================================================================

import { renderHook } from '@testing-library/react';
import { useLearningData } from '../use-learning-data';

// ============================================================================
// MOCK SETUP
// ============================================================================

// Mock both sub-hooks so we test pure composition, not their internals
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

jest.mock('../use-learned-weights', () => ({
  useLearnedWeights: () => mockTierReturn,
}));

jest.mock('../use-platform-learning', () => ({
  usePlatformLearning: () => mockPlatformReturn,
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
    mockTierReturn.refetch.mockClear();
    mockPlatformReturn.refetch.mockClear();
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

  it('isLoading is true only when BOTH hooks are loading', () => {
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

  it('error is null when both hooks are ok', () => {
    mockTierReturn.error = null;
    mockPlatformReturn.error = null;
    const { result } = renderHook(() => useLearningData());
    expect(result.current.error).toBeNull();
  });

  it('refetch calls both sub-hook refetch functions', async () => {
    const { result } = renderHook(() => useLearningData());
    await result.current.refetch();

    expect(mockTierReturn.refetch).toHaveBeenCalledTimes(1);
    expect(mockPlatformReturn.refetch).toHaveBeenCalledTimes(1);
  });
});
