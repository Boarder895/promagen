// src/lib/analytics/core.ts

export type AnalyticsEventName = string;

export interface AnalyticsEventPayload {
  [key: string]: unknown;
}

/**
 * Low-level analytics event dispatcher.
 *
 * - In the browser: pushes into window.dataLayer if it exists (GTM).
 * - In tests/SSR: no-ops.
 */
export function sendAnalyticsEvent(
  name: AnalyticsEventName,
  payload?: AnalyticsEventPayload,
): void {
  if (typeof window === 'undefined') {
    return;
  }

  const anyWindow = window as unknown as {
    dataLayer?: Array<Record<string, unknown>>;
  };

  if (Array.isArray(anyWindow.dataLayer)) {
    anyWindow.dataLayer.push({
      event: name,
      ...(payload ?? {}),
    });
  }
}
