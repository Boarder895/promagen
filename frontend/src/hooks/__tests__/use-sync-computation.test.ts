// src/hooks/__tests__/use-sync-computation.test.ts
// ============================================================================
// USE SYNC COMPUTATION — Tests
// ============================================================================

import { renderHook, act } from '@testing-library/react';
import { useSyncComputation } from '../use-sync-computation';

// ============================================================================
// Tests
// ============================================================================

describe('useSyncComputation', () => {

  it('returns computed value on first render', () => {
    const { result } = renderHook(() =>
      useSyncComputation(() => 2 + 2, [])
    );

    expect(result.current.value).toBe(4);
  });

  it('recomputes when deps change', () => {
    const { result, rerender } = renderHook(
      ({ x }) => useSyncComputation(() => x * 3, [x]),
      { initialProps: { x: 2 } }
    );

    expect(result.current.value).toBe(6);

    rerender({ x: 5 });
    expect(result.current.value).toBe(15);
  });

  it('refresh() forces recompute even with same deps', () => {
    let callCount = 0;

    const { result } = renderHook(() =>
      useSyncComputation(() => {
        callCount++;
        return 'ok';
      }, [])
    );

    const countBefore = callCount;

    act(() => {
      result.current.refresh();
    });

    // Should have been called again after refresh
    expect(callCount).toBeGreaterThan(countBefore);
    expect(result.current.value).toBe('ok');
  });

  it('does not recompute when deps are stable', () => {
    let callCount = 0;

    const { rerender } = renderHook(
      ({ key }) =>
        useSyncComputation(() => {
          callCount++;
          return key;
        }, [key]),
      { initialProps: { key: 'a' } }
    );

    const countAfterFirst = callCount;

    // Rerender with same dep
    rerender({ key: 'a' });

    expect(callCount).toBe(countAfterFirst);
  });

  it('provides a stable refresh function reference', () => {
    const { result, rerender } = renderHook(
      ({ x }) => useSyncComputation(() => x, [x]),
      { initialProps: { x: 1 } }
    );

    const ref1 = result.current.refresh;

    rerender({ x: 2 });

    const ref2 = result.current.refresh;
    expect(ref1).toBe(ref2);
  });

  it('works with object/array deps via serialised keys', () => {
    const { result, rerender } = renderHook(
      ({ items }) => {
        const key = JSON.stringify(items);
        return useSyncComputation(() => items.length, [key]);
      },
      { initialProps: { items: [1, 2, 3] } }
    );

    expect(result.current.value).toBe(3);

    rerender({ items: [1, 2, 3, 4, 5] });
    expect(result.current.value).toBe(5);
  });
});
