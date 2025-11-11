// Lightweight, opt-in analytics shim.
// Usage: track('homepage:view', { plan: 'free' })
// Respects consent via a simple gate: only fires when status === 'granted'.
// You can wire a real provider later without touching call-sites.

export type Props = Record<string, string | number | boolean | undefined>;

let consentStatus: 'granted' | 'denied' | 'unset' = 'unset';

// Listen for consent changes (emitted by useConsent)
if (typeof window !== 'undefined') {
  window.addEventListener('promagen:consent', (e: Event) => {
    try {
      const detail = (e as CustomEvent).detail as { status?: typeof consentStatus };
      if (detail?.status === 'granted' || detail?.status === 'denied' || detail?.status === 'unset') {
        consentStatus = detail.status;
      }
    } catch {
      // ignore
    }
  });
}

// Simple sampling helper (1 = always, 0.1 = 10% etc.)
function pass(sampleRate: number): boolean {
  if (sampleRate >= 1) return true;
  if (sampleRate <= 0) return false;
  return Math.random() < sampleRate;
}

export function track(event: string, props?: Props, sampleRate = 1): void {
  try {
    if (consentStatus !== 'granted') return;
    if (!pass(sampleRate)) return;

    // Replace this block with your real analytics sink when ready.
    // eslint-disable-next-line no-console
    console.debug('[analytics]', event, props ?? {});
    // Example future hook:
    // navigator.sendBeacon('/api/analytics', JSON.stringify({ event, props, at: new Date().toISOString() }));
  } catch {
    // never throw from analytics
  }
}
