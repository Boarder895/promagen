// src/lib/analytics.ts
// Thin, safe analytics wrapper. Never throws, accepts flexible args.

export type AnalyticsPayload = Record<string, unknown>;

export function track(event: string, payload: AnalyticsPayload = {}): void {
  try {
    const gtag = (globalThis as any).gtag as
      | ((type: string, action: string, params?: unknown) => void)
      | undefined;

    if (typeof gtag === "function") {
      gtag("event", event, payload);
      return;
    }

    // Hook other backends here later (PostHog, Segment, etc.)
    // console.debug("[analytics.track]", event, payload);
  } catch {
    /* ignore */
  }
}

/**
 * Accepts either:
 *  - trackTabClicked("providers", { source: "route", path: "/..." })
 *  - trackTabClicked({ tabId: "providers", source: "route", path: "/..." })
 */
export function trackTabClicked(
  arg1: string | (AnalyticsPayload & { tabId: string }),
  payload: AnalyticsPayload = {}
): void {
  if (typeof arg1 === "string") {
    track("tab_clicked", { tabId: arg1, ...payload });
  } else {
    const { tabId, ...rest } = arg1;
    track("tab_clicked", { tabId, ...rest });
  }
}

/**
 * Same flexible signatures as trackTabClicked.
 */
export function trackTabActive(
  arg1: string | (AnalyticsPayload & { tabId: string }),
  payload: AnalyticsPayload = {}
): void {
  if (typeof arg1 === "string") {
    track("tab_active", { tabId: arg1, ...payload });
  } else {
    const { tabId, ...rest } = arg1;
    track("tab_active", { tabId, ...rest });
  }
}

