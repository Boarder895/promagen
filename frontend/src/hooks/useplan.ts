// src/hooks/use-user-plan.ts

'use client';

import { useEffect, useState } from 'react';
import {
  USER_PLANS,
  coercePlanId,
  getDefaultPlanId,
  type UserPlan,
  type UserPlanId,
} from '@/lib/user-plan';

export interface UseUserPlanResult {
  planId: UserPlanId;
  plan: UserPlan;
  setPlanId: (next: UserPlanId) => void;
}

const STORAGE_KEY = 'promagen:user-plan';

export function useUserPlan(): UseUserPlanResult {
  // SSR-safe default; we do not touch window here.
  const [planId, setPlanIdState] = useState<UserPlanId>(getDefaultPlanId());

  // Hydrate from localStorage on the client.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setPlanIdState(coercePlanId(stored));
      }
    } catch {
      // Ignore storage errors; stay on default plan.
    }
  }, []);

  const setPlanId = (next: UserPlanId) => {
    setPlanIdState(next);

    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore; not fatal.
    }
  };

  const plan = USER_PLANS[planId] ?? USER_PLANS[getDefaultPlanId()];

  return { planId, plan, setPlanId };
}

export type { UserPlan, UserPlanId };
