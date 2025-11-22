// src/lib/analytics/events.ts
import { sendAnalyticsEvent } from '@/lib/analytics/core';

/**
 * Unified analytics events for Promagen.
 * These are simple wrappers so you can later wire them to GA4, GTM, or your
 * internal event pipeline without rewriting the UI.
 */

export function trackTierChange(newPlanId: string): void {
  sendAnalyticsEvent('tier_change', {
    plan: newPlanId,
  });
}

export function trackFxPairSelect(pairIds: string[]): void {
  sendAnalyticsEvent('fx_pair_select', {
    count: pairIds.length,
    ids: pairIds.join(','),
  });
}
