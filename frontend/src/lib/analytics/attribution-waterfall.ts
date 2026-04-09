// src/lib/analytics/attribution-waterfall.ts
// ============================================================================
// CONVERSION ATTRIBUTION WATERFALL (v1.1.0)
// ============================================================================
// v1.1.0: Uses shared JourneyBreadcrumb type from session-journey.ts.
//         Normalises at full precision internally, rounds only for output.
//
// When a user converts (provider_outbound), traces backwards through the
// session to build weighted attribution across touchpoints.
//
// Attribution model:
// - Each touchpoint type has a base weight (calibrated from UX research)
// - Recency bias: later events contribute more than earlier ones
// - First-touch bonus: the entry event gets a 1.5× multiplier
// - Scores normalised to sum to 1.0
//
// Weight calibration: initial values based on conversion-intent research.
// Tune by comparing attribution_chain data in GA4 against actual conversion
// rates per touchpoint. Recalibrate quarterly.
//
// Authority: analytics-build-plan-v1.3-FINAL.md §9 Extra 3
// Existing features preserved: Yes
// ============================================================================

import type { JourneyBreadcrumb } from '@/lib/analytics/session-journey';

// ============================================================================
// TOUCHPOINT WEIGHTS
// ============================================================================
// Calibrated from conversion-intent signals. prompt_copy is highest because
// copying a prompt is the strongest pre-conversion action on Promagen.
// Recalibrate quarterly using GA4 attribution_chain vs conversion data.
// ============================================================================

const TOUCHPOINT_WEIGHTS: Record<string, number> = {
  ai_citation_landing: 4.0,     // User chose to come from AI citation
  page_view_custom: 2.0,        // Page navigation
  provider_click: 3.0,          // Browse intent
  prompt_builder_open: 3.5,     // Engagement intent
  explore_drawer_opened: 2.0,   // Discovery
  explore_chip_clicked: 2.5,    // Active discovery
  scene_selected: 3.0,          // Creative engagement
  prompt_copy: 5.0,             // Strongest pre-conversion signal
  cascade_reorder_triggered: 2.0, // Feature usage
  nav_click: 1.0,               // Navigation (weakest signal)
};

const FIRST_TOUCH_MULTIPLIER = 1.5;
const RECENCY_EXPONENT = 1.3;

// ============================================================================
// TYPES
// ============================================================================

export interface AttributionTouchpoint {
  event: string;
  /** Full-precision normalised score (0–1) */
  score: number;
  count: number;
}

export interface AttributionWaterfall {
  touchpoints: AttributionTouchpoint[];
  primary_driver: string;
  /** GA4-safe serialised chain, max 100 chars */
  attribution_chain: string;
  touchpoint_count: number;
}

// ============================================================================
// COMPUTATION
// ============================================================================

export function computeAttribution(breadcrumbs: JourneyBreadcrumb[]): AttributionWaterfall | null {
  if (!breadcrumbs || breadcrumbs.length === 0) return null;

  const eventGroups = new Map<string, { count: number; latestPosition: number }>();

  for (let i = 0; i < breadcrumbs.length; i++) {
    const bc = breadcrumbs[i];
    if (!bc) continue;
    const existing = eventGroups.get(bc.event);
    if (existing) {
      existing.count++;
      existing.latestPosition = i;
    } else {
      eventGroups.set(bc.event, { count: 1, latestPosition: i });
    }
  }

  const total = breadcrumbs.length;
  const rawScores: Array<{ event: string; rawScore: number; count: number }> = [];
  let scoreSum = 0;

  for (const [event, group] of eventGroups) {
    const baseWeight = TOUCHPOINT_WEIGHTS[event] ?? 1.0;
    const recencyFactor = Math.pow((group.latestPosition + 1) / total, RECENCY_EXPONENT);
    const isFirstTouch = breadcrumbs[0]?.event === event;
    const firstTouchFactor = isFirstTouch ? FIRST_TOUCH_MULTIPLIER : 1.0;
    const countFactor = Math.sqrt(group.count);

    const raw = baseWeight * recencyFactor * firstTouchFactor * countFactor;
    scoreSum += raw;
    rawScores.push({ event, rawScore: raw, count: group.count });
  }

  if (scoreSum === 0) return null;

  // Normalise at full precision — round only for serialisation
  const touchpoints: AttributionTouchpoint[] = rawScores
    .map((r) => ({
      event: r.event,
      score: r.rawScore / scoreSum,
      count: r.count,
    }))
    .sort((a, b) => b.score - a.score);

  // GA4-safe chain: round to 2dp only in the string output
  const chainParts: string[] = [];
  let chainLen = 0;
  for (const tp of touchpoints) {
    const part = `${tp.event}:${tp.score.toFixed(2)}`;
    if (chainLen + part.length + 1 > 100) break;
    chainParts.push(part);
    chainLen += part.length + 1;
  }

  return {
    touchpoints,
    primary_driver: touchpoints[0]?.event ?? 'unknown',
    attribution_chain: chainParts.join('|'),
    touchpoint_count: touchpoints.length,
  };
}
