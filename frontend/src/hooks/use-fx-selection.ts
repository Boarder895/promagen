// src/hooks/use-fx-selection.ts

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useUserPlan } from '@/hooks/use-user-plan';
import {
  getFxSelectionForPlan,
  setFxSelectionForPlan,
  type FxSelection,
} from '@/lib/user-preferences/selection-store';
import { DEFAULT_FREE_FX_PAIR_IDS } from '@/lib/finance/fx-pairs';

export interface UseFxSelectionResult {
  pairIds: string[];
  setPairIds: (next: string[]) => void;
}

export function useFxSelection(): UseFxSelectionResult {
  const { planId } = useUserPlan();

  const [pairIds, setPairIdsState] = useState<string[]>(() => {
    const selection = getFxSelectionForPlan(planId);
    return selection?.pairIds ?? [...DEFAULT_FREE_FX_PAIR_IDS];
  });

  // When the plan changes (free → pro, etc.), hydrate from that plan’s selection.
  useEffect(() => {
    const selection = getFxSelectionForPlan(planId);
    setPairIdsState(selection?.pairIds ?? [...DEFAULT_FREE_FX_PAIR_IDS]);
  }, [planId]);

  const setPairIds = useCallback(
    (next: string[]) => {
      setPairIdsState(next);
      const selection: FxSelection = { pairIds: next };
      setFxSelectionForPlan(planId, selection);
    },
    [planId],
  );

  return { pairIds, setPairIds };
}
