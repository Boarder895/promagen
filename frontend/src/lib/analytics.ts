// frontend/src/lib/analytics.ts
// Privacy-light analytics: DOM CustomEvent that Playwright/Jest can observe.
// No PII, strictly typed, zero 'any', SSR-safe.

export type TabClickedPayload = {
  feature: 'providers' | 'leaderboard' | 'nav' | string;
  tabId: string;
  label: string;
  source?: string;
  path?: string;
  extra?: Record<string, unknown>;
};

type AnalyticsEvent =
  | { type: 'tab_clicked'; payload: TabClickedPayload }
  | { type: 'provider_clicked'; payload: { providerId: string; source?: string } };

function emit(evt: AnalyticsEvent): void {
  if (typeof window === 'undefined') return;

  // Keep this module “observational only” (no fetches):
  // - Tests can observe the CustomEvent
  // - Real analytics (GA / Vercel Analytics component) can be layered elsewhere
  const enabled = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== 'false';
  if (!enabled) return;

  window.dispatchEvent(new CustomEvent('promagen:analytics', { detail: evt }));
}

/** Specific helper kept for older call sites. */
export function emitTabClicked(payload: TabClickedPayload): void {
  emit({ type: 'tab_clicked', payload });
}

/** Generic helper (kept for legacy imports that call track('provider_open_website', …)). */
export function track(name: string, payload: Record<string, unknown> = {}): void {
  if (name === 'tab_clicked') {
    emit({ type: 'tab_clicked', payload: payload as TabClickedPayload });
    return;
  }

  // Legacy behaviour: everything else collapses to “provider_clicked”.
  // This avoids breaking older call sites that send different event names.
  emit({
    type: 'provider_clicked',
    payload: payload as { providerId: string; source?: string },
  });
}
