/**
 * Sentinel AI Crawler Canary (Phase 2)
 *
 * Detects AI crawler visits from Vercel logs. Tracks which bots
 * are visiting which pages and how often.
 *
 * Known AI crawler User-Agents (sentinel.md §4.3):
 *   OAI-SearchBot   — OpenAI indexing for ChatGPT search
 *   GPTBot          — OpenAI training/indexing
 *   ClaudeBot       — Anthropic indexing
 *   PerplexityBot   — Perplexity indexing
 *   Google-Extended — Google indexing for Gemini
 *
 * Implementation note: The exact log retrieval mechanism is TBD
 * (Vercel Log Drain, CLI extraction, or runtime logs API).
 * This module defines the detection logic and storage contract.
 * The ingestion adapter will be built when the log source is proven.
 *
 * Authority: sentinel.md v1.2.0 §4.3
 * Existing features preserved: Yes
 */

import 'server-only';

import { db } from '@/lib/db';

// =============================================================================
// TYPES
// =============================================================================

export interface CrawlerVisitSummary {
  botName: string;
  pagesVisited: number;
  previousWeekPages: number | null;
  delta: number | null;
  lastSeen: string | null;
  topPages: Array<{ url: string; visits: number }>;
}

export interface CanaryReport {
  available: boolean;
  weekDate: string;
  crawlers: CrawlerVisitSummary[];
  confidence: 'full' | 'partial';
  error: string | null;
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const AI_CRAWLERS = [
  { name: 'OAI-SearchBot', uaContains: 'OAI-SearchBot', description: 'OpenAI search indexing' },
  { name: 'GPTBot', uaContains: 'GPTBot', description: 'OpenAI training/indexing' },
  { name: 'ClaudeBot', uaContains: 'ClaudeBot', description: 'Anthropic indexing' },
  { name: 'PerplexityBot', uaContains: 'PerplexityBot', description: 'Perplexity indexing' },
  { name: 'Google-Extended', uaContains: 'Google-Extended', description: 'Google Gemini indexing' },
] as const;

// =============================================================================
// DETECTION
// =============================================================================

/**
 * Detect which AI crawler a User-Agent string belongs to.
 * Returns the bot name or null if not an AI crawler.
 */
export function detectCrawler(userAgent: string): string | null {
  for (const crawler of AI_CRAWLERS) {
    if (userAgent.includes(crawler.uaContains)) {
      return crawler.name;
    }
  }
  return null;
}

/**
 * Get crawler visit summary for a given week.
 * Reads from sentinel_crawler_visits (populated by the ingestion adapter).
 */
export async function getCrawlerReport(weekDate: string): Promise<CanaryReport> {
  const sql = db();

  // Check if we have any data for this week
  const rows = await sql<{
    bot_name: string;
    total_visits: string;
    unique_pages: string;
    last_seen: string | null;
    confidence: string;
  }[]>`
    SELECT
      bot_name,
      SUM(visit_count)::TEXT AS total_visits,
      COUNT(DISTINCT url)::TEXT AS unique_pages,
      MAX(last_seen)::TEXT AS last_seen,
      MIN(confidence) AS confidence
    FROM sentinel_crawler_visits
    WHERE week_date = ${weekDate}
    GROUP BY bot_name
    ORDER BY SUM(visit_count) DESC
  `;

  if (rows.length === 0) {
    return {
      available: false,
      weekDate,
      crawlers: [],
      confidence: 'full',
      error: 'No crawler visit data for this week (Phase 2 ingestion not active)',
    };
  }

  // Get previous week for delta
  const prevWeekDate = getPreviousMonday(weekDate);
  const prevRows = await sql<{
    bot_name: string;
    unique_pages: string;
  }[]>`
    SELECT bot_name, COUNT(DISTINCT url)::TEXT AS unique_pages
    FROM sentinel_crawler_visits
    WHERE week_date = ${prevWeekDate}
    GROUP BY bot_name
  `;
  const prevMap = new Map(prevRows.map((r) => [r.bot_name, parseInt(r.unique_pages, 10)]));

  // Get top pages per bot
  const crawlers: CrawlerVisitSummary[] = [];

  for (const row of rows) {
    const topPages = await sql<{ url: string; visits: string }[]>`
      SELECT url, SUM(visit_count)::TEXT AS visits
      FROM sentinel_crawler_visits
      WHERE week_date = ${weekDate} AND bot_name = ${row.bot_name}
      GROUP BY url ORDER BY SUM(visit_count) DESC LIMIT 5
    `;

    const pagesVisited = parseInt(row.unique_pages, 10);
    const prevPages = prevMap.get(row.bot_name) ?? null;

    crawlers.push({
      botName: row.bot_name,
      pagesVisited,
      previousWeekPages: prevPages,
      delta: prevPages !== null ? pagesVisited - prevPages : null,
      lastSeen: row.last_seen,
      topPages: topPages.map((p) => ({ url: p.url, visits: parseInt(p.visits, 10) })),
    });
  }

  // Overall confidence
  const overallConfidence = rows.some((r) => r.confidence === 'partial') ? 'partial' : 'full';

  return {
    available: true,
    weekDate,
    crawlers,
    confidence: overallConfidence as 'full' | 'partial',
    error: null,
  };
}

/**
 * Format canary data for the Monday report.
 */
export function formatCanaryReport(data: CanaryReport): string | null {
  if (!data.available) return null;

  const lines: string[] = [];
  lines.push('🕷️ AI CRAWLER ACTIVITY');

  for (const crawler of data.crawlers) {
    const deltaStr = crawler.delta !== null
      ? ` (${crawler.delta >= 0 ? '▲' : '▼'} from ${crawler.previousWeekPages})`
      : '';
    lines.push(`  ${crawler.botName}: ${crawler.pagesVisited} pages visited${deltaStr}`);
  }

  // Flag bots not seen this week
  for (const known of AI_CRAWLERS) {
    if (!data.crawlers.some((c) => c.botName === known.name)) {
      lines.push(`  ${known.name}: 0 pages (not seen this week)`);
    }
  }

  if (data.confidence === 'partial') {
    lines.push('  ⚠️ Crawler data is partial this week');
  }

  return lines.join('\n');
}

// =============================================================================
// HELPERS
// =============================================================================

function getPreviousMonday(dateStr: string): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() - 7);
  return date.toISOString().slice(0, 10);
}
