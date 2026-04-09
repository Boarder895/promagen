/**
 * Sentinel GA4 Data API Client (Phase 2)
 *
 * Consumes existing GA4 data (ai_citation_landing events, AI referral
 * sessions) via the Google Analytics Data API. Does NOT rebuild
 * analytics — it reads from the existing contract.
 *
 * Prerequisites:
 *   - GA4_PROPERTY_ID env var
 *   - GA4_SERVICE_ACCOUNT_JSON env var (service account credentials)
 *   - @google-analytics/data package (add when Phase 2 activates)
 *
 * Until Phase 2 is activated, this module returns null/empty results
 * and the Monday report notes "GA4 data unavailable".
 *
 * Authority: sentinel.md v1.2.0 §4.1, §4.2
 * Existing features preserved: Yes
 */

import 'server-only';

// =============================================================================
// TYPES
// =============================================================================

export interface AiReferralData {
  platform: string;      // 'chatgpt.com' | 'perplexity.ai' | 'claude.ai' | 'gemini.google.com'
  sessions: number;
  topLandingPages: Array<{ page: string; sessions: number }>;
}

export interface Ga4WeeklyReport {
  available: boolean;
  referrals: AiReferralData[];
  totalAiSessions: number;
  weekOverWeekChange: number | null;
  error: string | null;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

export const AI_REFERRAL_SOURCES = [
  'chatgpt.com',
  'perplexity.ai',
  'claude.ai',
  'gemini.google.com',
] as const;

function isGa4Configured(): boolean {
  const propertyId = process.env.GA4_PROPERTY_ID?.trim();
  const serviceAccount = process.env.GA4_SERVICE_ACCOUNT_JSON?.trim();
  return Boolean(propertyId && serviceAccount);
}

// =============================================================================
// DATA FETCHING
// =============================================================================

/**
 * Fetch AI referral data from GA4 for the previous 7 days.
 *
 * Returns null if GA4 is not configured (Phase 2 not active).
 * Returns partial data with error message if the API call fails.
 *
 * Implementation note: The actual API call uses the @google-analytics/data
 * package. This skeleton returns the correct types and degrades cleanly
 * when the package is not installed.
 */
export async function fetchAiReferrals(): Promise<Ga4WeeklyReport> {
  if (!isGa4Configured()) {
    return {
      available: false,
      referrals: [],
      totalAiSessions: 0,
      weekOverWeekChange: null,
      error: 'GA4 not configured (Phase 2 not active)',
    };
  }

  try {
    // Phase 2 implementation:
    // const { BetaAnalyticsDataClient } = await import('@google-analytics/data');
    // const client = new BetaAnalyticsDataClient({ credentials: JSON.parse(process.env.GA4_SERVICE_ACCOUNT_JSON!) });
    // const [response] = await client.runReport({ ... });

    // For now, return empty with "not yet implemented"
    console.debug('[Sentinel GA4] GA4 configured but Phase 2 fetch not yet implemented');

    return {
      available: false,
      referrals: [],
      totalAiSessions: 0,
      weekOverWeekChange: null,
      error: 'Phase 2 GA4 fetch not yet implemented',
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Sentinel GA4] Fetch failed:', msg);

    return {
      available: false,
      referrals: [],
      totalAiSessions: 0,
      weekOverWeekChange: null,
      error: `GA4 fetch failed: ${msg}`,
    };
  }
}

/**
 * Format GA4 referral data for the Monday report.
 */
export function formatGa4Report(data: Ga4WeeklyReport): string | null {
  if (!data.available || data.referrals.length === 0) {
    if (data.error && !data.error.includes('not configured')) {
      return `🤖 AI REFERRALS: Unavailable this week (${data.error})`;
    }
    return null; // Phase 2 not active — omit section entirely
  }

  const lines: string[] = [];
  lines.push(`🤖 AI REFERRALS THIS WEEK (${data.totalAiSessions} total sessions)`);

  for (const ref of data.referrals) {
    const changeStr = data.weekOverWeekChange !== null
      ? ` (${data.weekOverWeekChange >= 0 ? '▲' : '▼'} ${Math.abs(data.weekOverWeekChange)} from last week)`
      : '';
    lines.push(`  ${ref.platform}: ${ref.sessions} sessions${changeStr}`);

    for (const page of ref.topLandingPages.slice(0, 3)) {
      lines.push(`    ${page.page} (${page.sessions})`);
    }
  }

  return lines.join('\n');
}
