'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Plan } from '@/types/user';

const STORAGE_KEY = 'promagen:plan';

function normalisePlan(raw: string | null): Plan | null {
  if (raw === 'free' || raw === 'paid') return raw;

  // Back-compat: older UI used "pro" but business logic uses "paid".
  if (raw === 'pro') return 'paid';

  return null;
}

type UsePlanState = {
  plan: Plan;
  isPaid: boolean;
  setPlan: (plan: Plan) => void;
};

export function usePlan(): UsePlanState {
  const [plan, setPlanState] = useState<Plan>('free');

  useEffect(() => {
    try {
      const stored = normalisePlan(window.localStorage.getItem(STORAGE_KEY));
      if (stored) setPlanState(stored);
    } catch {
      // Ignore: privacy mode / blocked storage / etc.
    }
  }, []);

  const setPlan = useCallback((next: Plan) => {
    setPlanState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore.
    }
  }, []);

  const isPaid = plan === 'paid';

  return useMemo(() => ({ plan, isPaid, setPlan }), [plan, isPaid, setPlan]);
}
