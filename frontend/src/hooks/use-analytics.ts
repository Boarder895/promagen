// src/hooks/use-analytics.ts
'use client';

import { useCallback } from 'react';
import {
  trackEvent as rawTrackEvent,
  trackPageView as rawTrackPageView,
  type AnalyticsEventName,
  type AnalyticsEventParams,
} from '@/lib/analytics/ga';

/**
 * Small client-side hook that exposes Promagen's analytics helpers
 * to components in a typed, memoised way.
 */
export function useAnalytics() {
  const trackEvent = useCallback(
    <K extends AnalyticsEventName>(name: K, params?: AnalyticsEventParams<K>) => {
      rawTrackEvent(name, params);
    },
    [],
  );

  const trackPageView = useCallback((path: string) => {
    rawTrackPageView(path);
  }, []);

  return {
    trackEvent,
    trackPageView,
  };
}
