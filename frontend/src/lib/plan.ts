// src/lib/plan.ts
import type { Plan } from '@/types/user';

export const FEATURES = {
  fx: {
    multipleSelections: (plan: Plan) => plan === 'paid',
    hourlyLiveUpdates: (plan: Plan) => plan === 'paid',
  },
  homepage: {
    extraExchanges: (plan: Plan) => plan === 'paid',
  },
  cosmic: {
    overlays: (plan: Plan) => plan === 'paid',
  },
} as const;

export function hasFeature(path: keyof typeof FEATURES, feature: string, plan: Plan): boolean {
  const bucket = FEATURES[path as keyof typeof FEATURES] as Record<string, (p: Plan) => boolean>;
  const fn = bucket?.[feature];
  return typeof fn === 'function' ? fn(plan) : false;
}
