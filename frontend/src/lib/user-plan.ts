// frontend/src/lib/user-plan.ts
// -----------------------------------------------------------------------------
// Tiny helper for working out whether the current user is on a free or paid
// plan. For now this is backed by localStorage only; once real auth/session
// is in place this module becomes the thin wrapper over that.
// -----------------------------------------------------------------------------

import type { Plan } from '@/types/user';
import { KEYS, getLocal, setLocal } from '@/lib/storage.keys';

const FALLBACK_PLAN: Plan = 'free';

function normalisePlan(raw: string | null): Plan {
  if (raw === 'paid' || raw === 'free') return raw;
  return FALLBACK_PLAN;
}

/**
 * Read the user's plan from localStorage, falling back safely to "free".
 * This stays side-effect free at module top-level.
 */
export function getUserPlan(): Plan {
  if (typeof window === 'undefined') return FALLBACK_PLAN;
  const raw = getLocal(KEYS.user.planV1);
  return normalisePlan(raw);
}

/**
 * Persist the user's plan. This is intentionally very small – it does not
 * attempt to be a source of truth, just a client-side hint.
 */
export function setUserPlan(plan: Plan): void {
  setLocal(KEYS.user.planV1, plan);
}

/**
 * Convenience helper for the common case.
 */
export function isPaidUser(): boolean {
  return getUserPlan() === 'paid';
}
