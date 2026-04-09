// src/lib/analytics/session-journey.ts
// ============================================================================
// SESSION JOURNEY SNAPSHOT (v1.1.0)
// ============================================================================
// v1.1.0: Exports JourneyBreadcrumb type and getRawBreadcrumbs() so
//         attribution-waterfall.ts can share the type (no drift).
//
// Must remain powerless: no fetches, no timers, no cookies. Never throws.
// Safe for SSR (all sessionStorage access is guarded).
//
// Authority: analytics-build-plan-v1.3-FINAL.md §9 Extra 2
// Existing features preserved: Yes
// ============================================================================

const JOURNEY_KEY = 'promagen:session-journey';

// ============================================================================
// TYPES (exported — shared with attribution-waterfall.ts)
// ============================================================================

export interface JourneyBreadcrumb {
  event: string;
  provider_id?: string;
  ts: number;
}

interface JourneyState {
  started_at: number;
  entry_page: string;
  entry_source: string;
  breadcrumbs: JourneyBreadcrumb[];
}

export interface JourneySnapshot {
  journey_providers_viewed: number;
  journey_prompts_copied: number;
  journey_pages_visited: number;
  journey_duration_seconds: number;
  journey_entry_source: string;
  journey_entry_page: string;
}

// ============================================================================
// INTERNALS
// ============================================================================

function getEntrySource(): string {
  if (typeof document === 'undefined') return 'direct';
  try {
    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get('utm_source');
    if (utmSource) return utmSource;
  } catch { /* fall through */ }
  try {
    if (document.referrer) return new URL(document.referrer).hostname;
  } catch { /* fall through */ }
  return 'direct';
}

function readState(): JourneyState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(JOURNEY_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as JourneyState;
  } catch { return null; }
}

function writeState(state: JourneyState): void {
  if (typeof window === 'undefined') return;
  try { sessionStorage.setItem(JOURNEY_KEY, JSON.stringify(state)); }
  catch { /* silent */ }
}

function ensureState(): JourneyState {
  const existing = readState();
  if (existing) return existing;
  const fresh: JourneyState = {
    started_at: Date.now(),
    entry_page: typeof window !== 'undefined' ? window.location.pathname : '/',
    entry_source: getEntrySource(),
    breadcrumbs: [],
  };
  writeState(fresh);
  return fresh;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/** Append a breadcrumb. Max 200 per session. */
export function recordEvent(event: string, providerId?: string): void {
  const state = ensureState();
  if (state.breadcrumbs.length >= 200) return;
  state.breadcrumbs.push({ event, provider_id: providerId, ts: Date.now() });
  writeState(state);
}

/** Build summary for conversion event payload. */
export function getSnapshot(): JourneySnapshot | null {
  const state = readState();
  if (!state || state.breadcrumbs.length === 0) return null;

  const uniqueProviders = new Set(
    state.breadcrumbs
      .filter((b) => b.event === 'provider_click' && b.provider_id)
      .map((b) => b.provider_id),
  );
  const promptCopies = state.breadcrumbs.filter((b) => b.event === 'prompt_copy').length;
  const uniquePages = new Set(
    state.breadcrumbs.filter((b) => b.provider_id).map((b) => b.provider_id),
  );

  return {
    journey_providers_viewed: uniqueProviders.size,
    journey_prompts_copied: promptCopies,
    journey_pages_visited: Math.max(uniquePages.size, 1),
    journey_duration_seconds: Math.round((Date.now() - state.started_at) / 1000),
    journey_entry_source: state.entry_source,
    journey_entry_page: state.entry_page,
  };
}

/**
 * getRawBreadcrumbs — returns the raw breadcrumb array for attribution-waterfall.
 * Returns null if no journey data exists.
 */
export function getRawBreadcrumbs(): JourneyBreadcrumb[] | null {
  const state = readState();
  if (!state || state.breadcrumbs.length === 0) return null;
  return state.breadcrumbs;
}

/** Clear the session journey. Exposed for testing. */
export function resetJourney(): void {
  if (typeof window === 'undefined') return;
  try { sessionStorage.removeItem(JOURNEY_KEY); } catch { /* silent */ }
}
