// frontend/src/hooks/usePlan.ts
// Simple, typed plan hook. No any.

import { useEffect, useState } from 'react';

export type Plan = 'free' | 'pro' | 'enterprise';

const KEY = 'promagen.plan';

export function usePlan(): { plan: Plan; setPlan: (p: Plan) => void } {
  const [plan, setPlanState] = useState<Plan>('free');

  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? (window.localStorage.getItem(KEY) as Plan | null) : null;
      if (raw === 'pro' || raw === 'enterprise' || raw === 'free') setPlanState(raw);
    } catch {
      /* noop */
    }
  }, []);

  const setPlan = (p: Plan) => {
    setPlanState(p);
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(KEY, p);
    } catch {
      /* noop */
    }
  };

  return { plan, setPlan };
}
