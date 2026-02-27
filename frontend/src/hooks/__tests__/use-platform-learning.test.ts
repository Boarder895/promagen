// src/hooks/__tests__/use-platform-learning.test.ts
// ============================================================================
// PER-PLATFORM LEARNING HOOK — Tests
// ============================================================================
//
// Phase 7.5, Part 7.5e — Tests for the usePlatformLearning hook.
//
// Uses static imports (not dynamic) to avoid jest.resetModules() breaking
// React's internal dispatcher. Module-level cache is reset via the
// _resetCacheForTesting() utility exported from the hook.
//
// Version: 1.2.0 — Clean output (consolidated state eliminates act warnings)
// Existing features preserved: Yes.
// ============================================================================

import { renderHook, waitFor } from '@testing-library/react';
import { usePlatformLearning, _resetCacheForTesting } from '../use-platform-learning';

// ============================================================================
// MOCK DATA
// ============================================================================

const MOCK_UPDATED_AT = '2026-02-27T03:00:00Z';

const MOCK_TERM_QUALITY_DATA = {
  tiers: {
    '1': {
      platforms: {
        leonardo: {
          terms: {
            'neon glow': { score: 85, sampleSize: 12, trend: 'rising' as const },
            cyberpunk: { score: 72, sampleSize: 8, trend: 'stable' as const },
          },
          confidence: 0.8,
          eventCount: 45,
        },
      },
    },
  },
  eventCount: 200,
  totalTermsScored: 2,
  totalPlatforms: 1,
  graduatedPlatforms: 1,
  computedAt: MOCK_UPDATED_AT,
};

const MOCK_CO_OCCURRENCE_DATA = {
  tiers: {
    '1': {
      platforms: {
        leonardo: {
          pairs: [{ terms: ['cyberpunk', 'neon glow'], weight: 78, coCount: 10 }],
          confidence: 0.7,
          eventCount: 45,
        },
      },
    },
  },
  eventCount: 200,
  totalPairs: 1,
  totalPlatforms: 1,
  graduatedPlatforms: 1,
  computedAt: MOCK_UPDATED_AT,
};

// ============================================================================
// MOCK FETCH FACTORIES
// ============================================================================

function createMockFetch(
  termQualityData: unknown = MOCK_TERM_QUALITY_DATA,
  coOccurrenceData: unknown = MOCK_CO_OCCURRENCE_DATA,
) {
  return jest.fn((url: string) => {
    if (url.includes('platform-term-quality')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            data: termQualityData,
            updatedAt: MOCK_UPDATED_AT,
          }),
      });
    }
    if (url.includes('platform-co-occurrence')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            data: coOccurrenceData,
            updatedAt: MOCK_UPDATED_AT,
          }),
      });
    }
    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });
}

function createNullFetch() {
  return jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          ok: true,
          data: null,
          updatedAt: null,
        }),
    }),
  );
}

/**
 * Both fetches reject — triggers the allRejected detection path
 * inside the hook (Promise.allSettled never throws; the hook checks
 * for both status === 'rejected' explicitly).
 */
function createErrorFetch() {
  return jest.fn(() => Promise.reject(new Error('Network error')));
}

// ============================================================================
// SETUP / TEARDOWN
// ============================================================================

// Keep a reference to the real console.error for passthrough
const realConsoleError = console.error;

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-02-27T04:00:00Z'));
  jest.restoreAllMocks();
  _resetCacheForTesting();

  // Silence two categories of expected console.error noise:
  // 1. React act() warning — single remaining setState from async Promise
  //    resolution. Harmless in production; React 18 flags it in test mode.
  // 2. Hook error log — "[usePlatformLearning] Both fetches rejected" is
  //    intentional production behaviour tested in the error-handling suite.
  jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : '';
    if (msg.includes('not wrapped in act(')) return;
    if (msg.includes('[usePlatformLearning]')) return;
    realConsoleError(...args);
  });
});

afterEach(() => {
  jest.useRealTimers();
});

// ============================================================================
// TESTS
// ============================================================================

describe('usePlatformLearning', () => {
  describe('initialization', () => {
    it('starts in loading state when no cached data exists', async () => {
      global.fetch = createNullFetch() as unknown as typeof fetch;

      const { result } = renderHook(() => usePlatformLearning());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.error).toBeNull();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('returns null lookups when API returns null data', async () => {
      global.fetch = createNullFetch() as unknown as typeof fetch;

      const { result } = renderHook(() => usePlatformLearning());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.platformTermQualityLookup).toBeNull();
      expect(result.current.platformCoOccurrenceLookup).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('successful fetch', () => {
    it('builds lookups from valid API data', async () => {
      global.fetch = createMockFetch() as unknown as typeof fetch;

      const { result } = renderHook(() => usePlatformLearning());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Term quality lookup
      expect(result.current.platformTermQualityLookup).not.toBeNull();
      expect(result.current.platformTermQualityLookup!.eventCount).toBe(200);
      expect(
        result.current.platformTermQualityLookup!.tiers['1']!['leonardo']!.get('neon glow'),
      ).toBe(85);

      // Co-occurrence lookup
      expect(result.current.platformCoOccurrenceLookup).not.toBeNull();
      expect(result.current.platformCoOccurrenceLookup!.eventCount).toBe(200);
      expect(
        result.current.platformCoOccurrenceLookup!.tiers['1']!['leonardo']!.get(
          'cyberpunk|neon glow',
        ),
      ).toBe(78);
    });

    it('fetches both endpoints in parallel', async () => {
      const mockFetch = createMockFetch();
      global.fetch = mockFetch as unknown as typeof fetch;

      renderHook(() => usePlatformLearning());

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      const urls = mockFetch.mock.calls.map((c: unknown[]) => c[0]);
      expect(urls).toContain('/api/learning/platform-term-quality');
      expect(urls).toContain('/api/learning/platform-co-occurrence');
    });

    it('provides a refetch function', async () => {
      global.fetch = createMockFetch() as unknown as typeof fetch;

      const { result } = renderHook(() => usePlatformLearning());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.refetch).toBe('function');
    });
  });

  describe('error handling', () => {
    it('sets error when both fetches reject (allSettled total failure)', async () => {
      // Promise.allSettled never throws — but the hook detects when both
      // results have status === 'rejected' and surfaces the first reason.
      global.fetch = createErrorFetch() as unknown as typeof fetch;

      const { result } = renderHook(() => usePlatformLearning());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.platformTermQualityLookup).toBeNull();
      expect(result.current.platformCoOccurrenceLookup).toBeNull();
    });

    it('handles partial failure gracefully — one endpoint fails, other succeeds', async () => {
      global.fetch = jest.fn((url: string) => {
        if ((url as string).includes('platform-term-quality')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                ok: true,
                data: MOCK_TERM_QUALITY_DATA,
                updatedAt: MOCK_UPDATED_AT,
              }),
          });
        }
        // Co-occurrence returns HTTP error
        return Promise.resolve({
          ok: false,
          status: 500,
        });
      }) as unknown as typeof fetch;

      const { result } = renderHook(() => usePlatformLearning());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.platformTermQualityLookup).not.toBeNull();
      expect(result.current.platformCoOccurrenceLookup).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('dataAge indicator (Improvement 2)', () => {
    it('returns null dataAge/lastUpdatedAt when no data exists', async () => {
      global.fetch = createNullFetch() as unknown as typeof fetch;

      const { result } = renderHook(() => usePlatformLearning());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.dataAge).toBeNull();
      expect(result.current.lastUpdatedAt).toBeNull();
    });

    it('computes dataAge from updatedAt when data exists', async () => {
      global.fetch = createMockFetch() as unknown as typeof fetch;

      const { result } = renderHook(() => usePlatformLearning());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.lastUpdatedAt).toBe(MOCK_UPDATED_AT);
      expect(result.current.dataAge).not.toBeNull();
      expect(result.current.dataAge!).toBeGreaterThanOrEqual(3_500_000);
      expect(result.current.dataAge!).toBeLessThanOrEqual(3_700_000);
    });
  });

  describe('return type contract', () => {
    it('exposes all expected fields including dataAge and lastUpdatedAt', async () => {
      global.fetch = createNullFetch() as unknown as typeof fetch;

      const { result } = renderHook(() => usePlatformLearning());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current).toHaveProperty('platformTermQualityLookup');
      expect(result.current).toHaveProperty('platformCoOccurrenceLookup');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('lastUpdatedAt');
      expect(result.current).toHaveProperty('dataAge');
      expect(result.current).toHaveProperty('refetch');
    });
  });
});
