// src/lib/user-plan.ts

export type UserPlanId = 'free' | 'pro';

export interface UserPlan {
  id: UserPlanId;
  label: string;
  description: string;
  /**
   * Maximum number of FX pairs the user can show in the ribbon / widgets.
   * You can evolve this later for other asset classes.
   */
  maxFxPairs: number;
}

export const USER_PLANS: Record<UserPlanId, UserPlan> = {
  free: {
    id: 'free',
    label: 'Free',
    description: 'Default plan with fixed FX ribbon.',
    maxFxPairs: 5,
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    description: 'Pro plan with a configurable FX ribbon.',
    maxFxPairs: 5,
  },
};

/**
 * Coerce arbitrary input (e.g. from query params or localStorage)
 * into a known plan id.
 */
export function coercePlanId(input: unknown): UserPlanId {
  if (input === 'pro') {
    return 'pro';
  }
  return 'free';
}

/**
 * Default plan for a brand new user or on the server.
 *
 * We keep this pure and SSR-safe; any localStorage hydration
 * is done inside the use-user-plan hook.
 */
export function getDefaultPlanId(): UserPlanId {
  return 'free';
}
