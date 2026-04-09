// src/components/analytics/ai-citation-detector.tsx
// ============================================================================
// AI CITATION LANDING DETECTOR (v1.0.0)
// ============================================================================
// Client-only mount point for useAiCitationDetector(). Placed in the root
// layout alongside GoogleAnalytics. Fires ai_citation_landing once per
// session when a user arrives from ChatGPT, Perplexity, Claude, Gemini,
// Copilot, You, or Phind. Renders nothing — pure side-effect component.
//
// Respects the same NEXT_PUBLIC_ANALYTICS_ENABLED gate as GoogleAnalytics
// so that disabling analytics globally also silences citation detection.
//
// Authority: analytics-build-plan-v1.3-FINAL.md §9 Extra 1
// Existing features preserved: Yes
// ============================================================================

'use client';

import { useAiCitationDetector } from '@/hooks/use-ai-citation-detector';

const ANALYTICS_ENABLED =
  (process.env.NEXT_PUBLIC_ANALYTICS_ENABLED ?? 'on').toLowerCase() === 'on';

export function AiCitationDetector() {
  useAiCitationDetector({ enabled: ANALYTICS_ENABLED });
  return null;
}

AiCitationDetector.displayName = 'AiCitationDetector';
