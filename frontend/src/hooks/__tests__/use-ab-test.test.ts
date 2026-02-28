// src/hooks/__tests__/use-ab-test.test.ts
// ============================================================================
// A/B TEST HOOK — Tests
// ============================================================================
//
// Phase 7.6, Part 7.6e/f — Tests for the useABTest hook.
//
// Uses static imports and _resetCacheForTesting() to avoid jest.resetModules()
// breaking React's internal dispatcher (same pattern as use-platform-learning).
//
// act() Warning Fix (7.6f):
// The mock fetch is `Promise.resolve(...)` — a microtask chain that resolves
// AFTER renderHook()'s internal act() exits, causing setState outside act().
// Fix: `await act(async () => {})` after each renderHook flushes the pending
// microtask chain within React's act boundary. The refetch test wraps the
// refetch() call in act() for the same reason.
//
// Version: 1.2.0 — Zero act() warnings, zero console noise
// Existing features preserved: Yes.
// ============================================================================

import { renderHook, waitFor, act } from '@testing-library/react';
import { useABTest, _resetCacheForTesting } from '../use-ab-test';

// ============================================================================
// MOCK DATA
// ============================================================================

const MOCK_AB_HASH = '550e8400-e29b-41d4-a716-446655440000';

const MOCK_ASSIGNMENT_VARIANT_B = {
  testId: 'test-abc-123',
  testName: 'copy-rate-weight-shift',
  variant: 'B' as const,
  weights: { coherence: 0.3, diversity: 0.2 },
  splitPct: 50,
};

const MOCK_ASSIGNMENT_VARIANT_A = {
  testId: 'test-abc-123',
  testName: 'copy-rate-weight-shift',
  variant: 'A' as const,
  weights: null,
  splitPct: 50,
};

const MOCK_NO_TEST = {
  testId: null,
  testName: null,
  variant: null,
  weights: null,
  splitPct: null,
};

// ============================================================================
// MOCKS
// ============================================================================

// Mock getAbHash — returns a stable hash
jest.mock('@/lib/telemetry/ab-hash', () => ({
  getAbHash: jest.fn(() => MOCK_AB_HASH),
}));

/**
 * Create a mock fetch that returns the given response data.
 * Casts through `unknown` to satisfy the full `Response` type
 * without stubbing all 12+ properties we don't need.
 */
const createMockFetch = (responseData: unknown = MOCK_NO_TEST) =>
  jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(responseData),
    } as unknown as Response),
  );

// ============================================================================
// SETUP
// ============================================================================

beforeEach(() => {
  _resetCacheForTesting();
  global.fetch = createMockFetch();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ============================================================================
// TESTS
// ============================================================================

describe('useABTest', () => {
  it('starts with isLoading=true on first render', async () => {
    const { result, unmount } = renderHook(() => useABTest());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.activeTestId).toBeNull();
    expect(result.current.variant).toBeNull();
    expect(result.current.variantWeights).toBeNull();

    // Flush the async useEffect (fetch → setState) so it doesn't leak
    await act(async () => {});
    unmount();
  });

  it('fetches assignment and returns variant B data', async () => {
    global.fetch = createMockFetch(MOCK_ASSIGNMENT_VARIANT_B);

    const { result } = renderHook(() => useABTest());

    // Flush microtask chain (mock fetch → json → setState) within act boundary
    await act(async () => {});

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.activeTestId).toBe('test-abc-123');
    expect(result.current.activeTestName).toBe('copy-rate-weight-shift');
    expect(result.current.variant).toBe('B');
    expect(result.current.variantWeights).toEqual({ coherence: 0.3, diversity: 0.2 });
    expect(result.current.abHash).toBe(MOCK_AB_HASH);
    expect(result.current.error).toBeNull();
  });

  it('returns null weights for variant A (control)', async () => {
    global.fetch = createMockFetch(MOCK_ASSIGNMENT_VARIANT_A);

    const { result } = renderHook(() => useABTest());
    await act(async () => {});

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.variant).toBe('A');
    expect(result.current.variantWeights).toBeNull();
  });

  it('returns all null fields when no test is running', async () => {
    global.fetch = createMockFetch(MOCK_NO_TEST);

    const { result } = renderHook(() => useABTest());
    await act(async () => {});

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.activeTestId).toBeNull();
    expect(result.current.variant).toBeNull();
    expect(result.current.variantWeights).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('passes abHash as query parameter to the API', async () => {
    global.fetch = createMockFetch(MOCK_NO_TEST);

    renderHook(() => useABTest());
    await act(async () => {});

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain(`abHash=${MOCK_AB_HASH}`);
  });

  it('handles fetch errors gracefully (returns error, keeps null data)', async () => {
    // Suppress expected console.error from the hook's catch block
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = jest.fn(() =>
      Promise.reject(new Error('Network error')),
    ) as unknown as typeof fetch;

    const { result } = renderHook(() => useABTest());
    await act(async () => {});

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.activeTestId).toBeNull();
    expect(result.current.variant).toBeNull();

    spy.mockRestore();
  });

  it('handles non-ok responses gracefully', async () => {
    // Suppress expected console.error from the hook's catch block
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      } as unknown as Response),
    );

    const { result } = renderHook(() => useABTest());
    await act(async () => {});

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toContain('500');
    expect(result.current.activeTestId).toBeNull();

    spy.mockRestore();
  });

  it('caches data across re-renders (does not refetch within interval)', async () => {
    global.fetch = createMockFetch(MOCK_ASSIGNMENT_VARIANT_B);

    const { result, rerender } = renderHook(() => useABTest());
    await act(async () => {});

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Re-render (simulates parent re-render) — should use cache
    rerender();

    // Should still only have 1 fetch call
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result.current.variant).toBe('B');
  });

  it('exposes refetch function that forces a new fetch', async () => {
    global.fetch = createMockFetch(MOCK_NO_TEST);

    const { result } = renderHook(() => useABTest());
    await act(async () => {});

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.activeTestId).toBeNull();

    // Simulate test starting — update fetch to return variant B
    _resetCacheForTesting(); // Clear cache so refetch hits API
    global.fetch = createMockFetch(MOCK_ASSIGNMENT_VARIANT_B);

    // Wrap refetch in act() so the async setState lands within act boundary
    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.activeTestId).toBe('test-abc-123');
    });
  });
});
