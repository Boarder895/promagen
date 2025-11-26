// src/lib/analytics/core.ts

export type AnalyticsEventName = string;

/**
 * Very low-level payload type.
 *
 * The strongly-typed event map lives in higher-level helpers. At this level
 * we just accept “some object” and push it into dataLayer if present.
 */
export type AnalyticsEventPayload = unknown;

/**
 * Low-level analytics event dispatcher.
 *
 * - In the browser: pushes into window.dataLayer if it exists (GTM-style).
 * - In tests / SSR: no-ops.
 */
export function sendAnalyticsEvent(
  name: AnalyticsEventName,
  payload?: AnalyticsEventPayload,
): void {
  if (typeof window === 'undefined') {
    // SSR / tests: do nothing.
    return;
  }

  const anyWindow = window as unknown as {
    dataLayer?: Array<Record<string, unknown>>;
  };

  if (!Array.isArray(anyWindow.dataLayer)) {
    // No GTM dataLayer present – nothing to do.
    return;
  }

  const base: Record<string, unknown> = { event: name };

  if (payload && typeof payload === 'object') {
    Object.assign(base, payload as Record<string, unknown>);
  }

  anyWindow.dataLayer.push(base);
}
