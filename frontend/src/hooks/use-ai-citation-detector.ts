// src/hooks/use-ai-citation-detector.ts
// ============================================================================
// AI CITATION LANDING DETECTION (v1.1.0)
// ============================================================================
// v1.1.0: Landing page now captures pathname + search (not just pathname)
//         for authority-page variant tracking. Debug logging added.
//
// Drop into root layout. Fires ai_citation_landing once per session when
// the user arrives from ChatGPT, Perplexity, Claude, Gemini, etc.
//
// Authority: analytics-build-plan-v1.3.md §9 Extra 1
// Existing features preserved: Yes
// ============================================================================

'use client';

import { useEffect } from 'react';
import { trackAiCitationLanding } from '@/lib/analytics/events';

const AI_REFERRER_MAP: ReadonlyArray<{ pattern: string; source: string }> = [
  { pattern: 'chatgpt.com', source: 'chatgpt' },
  { pattern: 'chat.openai.com', source: 'chatgpt' },
  { pattern: 'perplexity.ai', source: 'perplexity' },
  { pattern: 'claude.ai', source: 'claude' },
  { pattern: 'gemini.google.com', source: 'gemini' },
  { pattern: 'copilot.microsoft.com', source: 'copilot' },
  { pattern: 'you.com', source: 'you' },
  { pattern: 'phind.com', source: 'phind' },
];

const SESSION_KEY = 'promagen:ai-citation-detected';
const DEBUG = process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === 'true';

/** Exported for unit testing. */
export function matchAiReferrer(referrer: string): string | null {
  if (!referrer) return null;
  try {
    const hostname = new URL(referrer).hostname.toLowerCase();
    for (const entry of AI_REFERRER_MAP) {
      if (hostname === entry.pattern || hostname.endsWith(`.${entry.pattern}`)) {
        return entry.source;
      }
    }
  } catch { /* malformed referrer */ }
  return null;
}

function getUtmParams(): {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
} {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const result: Record<string, string> = {};
  const source = params.get('utm_source');
  const medium = params.get('utm_medium');
  const campaign = params.get('utm_campaign');
  if (source) result.utmSource = source;
  if (medium) result.utmMedium = medium;
  if (campaign) result.utmCampaign = campaign;
  return result;
}

/**
 * useAiCitationDetector
 *
 * Usage in root layout client wrapper:
 * ```tsx
 * import { useAiCitationDetector } from '@/hooks/use-ai-citation-detector';
 * function LayoutClient({ children }) {
 *   useAiCitationDetector();
 *   return <>{children}</>;
 * }
 * ```
 */
export function useAiCitationDetector(): void {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
    } catch { return; }

    const aiSource = matchAiReferrer(document.referrer);

    if (DEBUG) {
      console.debug('[analytics:ai-citation] referrer:', document.referrer, '→', aiSource ?? 'no match');
    }

    if (!aiSource) return;

    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* still fire */ }

    // Capture pathname + search for authority-page variant tracking
    const landingPage = window.location.pathname + window.location.search;
    const utmParams = getUtmParams();

    trackAiCitationLanding({
      aiSource,
      landingPage,
      ...utmParams,
    });
  }, []);
}
