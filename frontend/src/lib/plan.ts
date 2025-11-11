import type { Plan } from '@/types/user';

export const FEATURES = {
  fx: {
    multipleSelections: (plan: Plan) => plan === 'paid',      // choose up to 5 exchange-rate cards
    hourlyLiveUpdates: (plan: Plan) => plan === 'paid',       // live API (not just demo jitter)
  },
  homepage: {
    extraExchanges: (plan: Plan) => plan === 'paid',          // 6–16 rails selection
  },
  cosmic: {
    overlays: (plan: Plan) => plan === 'paid',                // show solstices/eclipses layer
  },
} as const;

export function hasFeature(path: keyof typeof FEATURES, feature: string, plan: Plan): boolean {
  const bucket = FEATURES[path as keyof typeof FEATURES] as Record<string, (p: Plan) => boolean>;
  const fn = bucket?.[feature];
  return typeof fn === 'function' ? fn(plan) : false;
}
