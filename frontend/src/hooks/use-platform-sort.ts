// src/hooks/use-platform-sort.ts
// ============================================================================
// PLATFORM SORT HOOK — Extracted from platform-hub-table
// ============================================================================
// Handles sort state + comparator for the authority hub table.
// Extracted to reduce table component weight and keep sorting logic testable.
//
// Default: name ascending (matches SSR render order).
// Numeric columns default to descending on first click.
// ============================================================================

import { useState, useMemo, useCallback } from 'react';
import type { AuthorityPlatform, NegativeSupportType } from '@/lib/authority/platform-data';

export type SortKey = 'name' | 'tier' | 'negativeSupport' | 'sweetSpot' | 'maxChars';
export type SortDir = 'asc' | 'desc';

const NEG_SORT_ORDER: Record<NegativeSupportType, number> = { separate: 0, inline: 1, none: 2 };

function compare(a: AuthorityPlatform, b: AuthorityPlatform, key: SortKey): number {
  switch (key) {
    case 'name':
      return a.name.localeCompare(b.name);
    case 'tier':
      return a.tier - b.tier || a.name.localeCompare(b.name);
    case 'negativeSupport':
      return NEG_SORT_ORDER[a.negativeSupport] - NEG_SORT_ORDER[b.negativeSupport] || a.name.localeCompare(b.name);
    case 'sweetSpot':
      return (a.sweetSpot || 0) - (b.sweetSpot || 0);
    case 'maxChars':
      return (a.maxChars ?? 0) - (b.maxChars ?? 0);
  }
}

export function usePlatformSort(platforms: AuthorityPlatform[]) {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const sorted = useMemo(() => {
    return [...platforms].sort((a, b) => {
      const cmp = compare(a, b, sortKey);
      return sortDir === 'desc' ? -cmp : cmp;
    });
  }, [platforms, sortKey, sortDir]);

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // Numeric columns default to descending (most useful first)
      setSortDir(key === 'sweetSpot' || key === 'maxChars' ? 'desc' : 'asc');
    }
  }, [sortKey]);

  return { sorted, sortKey, sortDir, toggleSort };
}
