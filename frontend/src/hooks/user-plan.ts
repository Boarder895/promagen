// src/lib/user-plan.ts

export type UserPlanId = 'guest' | 'free' | 'pro';

export interface UserPlan {
  id: UserPlanId;
  /**
   * Human-friendly label if you ever need to show it in the UI.
   */
  label: string;
  /**
   * Intended FX refresh cadence for this plan, in milliseconds.
   * (You already have separate polling logic; this is the target SLA.)
   */
  fxRefreshMs: number;
}

/**
 * Canonical plan matrix for Promagen.
 *
 * This is deliberately tiny but centralised so you can:
 * - Keep behaviour consistent across the app.
 * - Extend with more metadata later (limits, flags, etc.).
 */
export const USER_PLANS: Record<UserPlanId, UserPlan> = {
  guest: {
    id: 'guest',
    label: 'Guest',
    fxRefreshMs: 5 * 60 * 1000, // 5 minutes target for anonymous visitors
  },
  free: {
    id: 'free',
    label: 'Free',
    fxRefreshMs: 3 * 60 * 1000, // 3 minutes target (example)
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    fxRefreshMs: 60 * 1000, // 1 minute target (example)
  },
};

const DEFAULT_PLAN_ID: UserPlanId = 'free';

/**
 * Returns the default plan id when nothing is stored / resolved yet.
 * For now, that’s your free tier. You can flip this when you add auth.
 */
export function getDefaultPlanId(): UserPlanId {
  return DEFAULT_PLAN_ID;
}

/**
 * Coerce an arbitrary value into a valid UserPlanId.
 * Falls back to the default if the value is unknown.
 */
export function coercePlanId(value: unknown): UserPlanId {
  if (value === 'guest' || value === 'free' || value === 'pro') {
    return value;
  }

  return DEFAULT_PLAN_ID;
}

/**
 * Convenience helper if you ever want a non-hook way of checking paid.
 * This is *pure* and does not touch storage or the browser.
 */
export function isPaidPlan(planId: UserPlanId): boolean {
  return planId === 'pro';
}
