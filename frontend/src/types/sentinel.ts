/**
 * Sentinel Type Definitions & Constants
 *
 * All types for the Sentinel AI Visibility Intelligence System.
 *
 * Authority: sentinel.md v1.2.0
 * Existing features preserved: Yes
 */

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Postgres advisory lock ID for Sentinel cron.
 * Must not collide with INDEX_RATING_ADVISORY_LOCK_ID (424243).
 */
export const SENTINEL_ADVISORY_LOCK_ID = 535354;

/**
 * Sentinel User-Agent string for self-crawl requests.
 */
export const SENTINEL_USER_AGENT = 'PromagenSentinel/1.0 (+https://promagen.com)';

/**
 * Crawl controls (sentinel.md §3.10)
 */
export const CRAWL_CONCURRENCY = 5;
export const CRAWL_TIMEOUT_MS = 10_000;
export const CRAWL_RETRY_DELAY_MS = 3_000;
export const CRAWL_MAX_RETRIES = 1;
export const CRAWL_MAX_PAGES = 100;

// =============================================================================
// PAGE CLASSES
// =============================================================================

export const PAGE_CLASSES = [
  'homepage',
  'hub',
  'profile',
  'guide',
  'comparison',
  'use_case',
  'methodology',
  'product',
] as const;

export type PageClass = (typeof PAGE_CLASSES)[number];

// =============================================================================
// RUN TYPES & STATES
// =============================================================================

export const RUN_TYPES = ['weekly', 'tripwire', 'manual'] as const;
export type RunType = (typeof RUN_TYPES)[number];

export const RUN_STATUSES = [
  'started',
  'crawl_complete',
  'diff_complete',
  'reported',
  'failed',
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

// =============================================================================
// SEVERITY
// =============================================================================

export const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'IGNORED'] as const;
export type Severity = (typeof SEVERITIES)[number];

// =============================================================================
// REGRESSION TYPES
// =============================================================================

export const REGRESSION_TYPES = [
  'page_down',
  'title_lost',
  'meta_desc_lost',
  'schema_lost',
  'h1_changed',
  'content_shrink_20',
  'content_shrink_30',
  'canonical_lost',
  'links_dropped_30',
  'performance_spike_3x',
  'ssot_drift',
] as const;
export type RegressionType = (typeof REGRESSION_TYPES)[number];

// =============================================================================
// CLASS-SPECIFIC REGRESSION THRESHOLDS (sentinel.md §3.4)
// =============================================================================

/**
 * Full policy matrix: page class × regression type → severity.
 * IGNORED means the regression is not tracked for that page class.
 */
export const REGRESSION_THRESHOLD_MATRIX: Record<
  RegressionType,
  Record<PageClass, Severity>
> = {
  page_down: {
    homepage: 'CRITICAL', hub: 'CRITICAL', profile: 'CRITICAL', guide: 'CRITICAL',
    comparison: 'CRITICAL', use_case: 'CRITICAL', methodology: 'CRITICAL', product: 'HIGH',
  },
  title_lost: {
    homepage: 'HIGH', hub: 'HIGH', profile: 'HIGH', guide: 'HIGH',
    comparison: 'HIGH', use_case: 'HIGH', methodology: 'HIGH', product: 'MEDIUM',
  },
  meta_desc_lost: {
    homepage: 'HIGH', hub: 'HIGH', profile: 'HIGH', guide: 'HIGH',
    comparison: 'HIGH', use_case: 'HIGH', methodology: 'HIGH', product: 'LOW',
  },
  schema_lost: {
    homepage: 'MEDIUM', hub: 'HIGH', profile: 'HIGH', guide: 'HIGH',
    comparison: 'HIGH', use_case: 'HIGH', methodology: 'HIGH', product: 'LOW',
  },
  h1_changed: {
    homepage: 'IGNORED', hub: 'MEDIUM', profile: 'MEDIUM', guide: 'MEDIUM',
    comparison: 'MEDIUM', use_case: 'MEDIUM', methodology: 'MEDIUM', product: 'IGNORED',
  },
  content_shrink_20: {
    homepage: 'IGNORED', hub: 'HIGH', profile: 'MEDIUM', guide: 'HIGH',
    comparison: 'MEDIUM', use_case: 'MEDIUM', methodology: 'HIGH', product: 'IGNORED',
  },
  content_shrink_30: {
    homepage: 'MEDIUM', hub: 'CRITICAL', profile: 'HIGH', guide: 'CRITICAL',
    comparison: 'HIGH', use_case: 'HIGH', methodology: 'CRITICAL', product: 'LOW',
  },
  canonical_lost: {
    homepage: 'MEDIUM', hub: 'HIGH', profile: 'HIGH', guide: 'HIGH',
    comparison: 'HIGH', use_case: 'HIGH', methodology: 'HIGH', product: 'MEDIUM',
  },
  links_dropped_30: {
    homepage: 'LOW', hub: 'MEDIUM', profile: 'MEDIUM', guide: 'MEDIUM',
    comparison: 'LOW', use_case: 'LOW', methodology: 'MEDIUM', product: 'IGNORED',
  },
  performance_spike_3x: {
    homepage: 'LOW', hub: 'MEDIUM', profile: 'LOW', guide: 'LOW',
    comparison: 'LOW', use_case: 'LOW', methodology: 'LOW', product: 'IGNORED',
  },
  ssot_drift: {
    homepage: 'IGNORED', hub: 'HIGH', profile: 'MEDIUM', guide: 'MEDIUM',
    comparison: 'MEDIUM', use_case: 'MEDIUM', methodology: 'LOW', product: 'IGNORED',
  },
};

/**
 * Minimum weeks of history required before a regression type fires.
 * (sentinel.md §3.4 — avoids false alarms during early operation)
 */
export const REGRESSION_MIN_HISTORY: Partial<Record<RegressionType, number>> = {
  content_shrink_20: 3,
  content_shrink_30: 3,
  links_dropped_30: 3,
  performance_spike_3x: 4,
};

// =============================================================================
// DATABASE ROW TYPES
// =============================================================================

export interface SentinelRunRow {
  id: string;             // BIGSERIAL comes back as string from postgres.js
  run_date: string;
  run_type: RunType;
  is_rerun: boolean;
  status: RunStatus;
  pages_crawled: number;
  pages_total: number;
  regressions_found: number;
  suppressions_applied: number;
  crawl_duration_ms: number | null;
  diff_duration_ms: number | null;
  report_sent: boolean;
  failure_reason: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface SentinelSnapshotRow {
  id: string;
  run_id: string;
  crawl_date: string;
  url: string;
  page_class: PageClass;
  status_code: number;
  title: string | null;
  meta_desc: string | null;
  h1: string | null;
  canonical: string | null;
  word_count: number | null;
  schema_types: string[] | null;
  internal_links_out: number | null;
  internal_links_in: number | null;
  ssot_version: string | null;
  last_verified: string | null;
  faq_count: number | null;
  response_ms: number | null;
  created_at: string;
}

export interface SentinelRegressionRow {
  id: string;
  run_id: string;
  crawl_date: string;
  url: string;
  page_class: PageClass;
  regression_type: RegressionType;
  severity: Severity;
  previous_value: string | null;
  current_value: string | null;
  resolved: boolean;
  resolved_date: string | null;
  suppressed: boolean;
  suppression_id: string | null;
  forensic_html_gz: Buffer | null;
  created_at: string;
}

export interface SentinelSuppressionRow {
  id: string;
  url: string;
  regression_type: string;     // specific type or '*'
  reason: string;
  expires_at: string | null;
  created_by: string;
  created_at: string;
}

export interface SentinelLinkEdge {
  source_url: string;
  target_url: string;
  source_class: PageClass;
  target_class: PageClass;
}

// =============================================================================
// CRAWLER TYPES
// =============================================================================

/** Raw extraction result for a single page */
export interface CrawlResult {
  url: string;
  statusCode: number;
  title: string | null;
  metaDesc: string | null;
  h1: string | null;
  canonical: string | null;
  wordCount: number;
  schemaTypes: string[];
  internalLinksOut: number;
  internalLinkTargets: string[];
  ssotVersion: string | null;
  lastVerified: string | null;
  faqCount: number;
  responseMs: number;
  /** Raw HTML body — used for Extra A forensic snapshots */
  rawHtml: string;
  /** True if this result came from a retry */
  retried: boolean;
  /** Error message if fetch failed entirely */
  error: string | null;
}

// =============================================================================
// HEALTH SCORE (sentinel.md §7)
// =============================================================================

export interface HealthScoreComponents {
  availability: number;       // 0–100
  metadata: number;           // 0–100
  schema: number;             // 0–100
  regressionBurden: number;   // 0–100
  orphanRisk: number;         // 0–100
}

export const HEALTH_WEIGHTS = {
  availability: 0.40,
  metadata: 0.20,
  schema: 0.15,
  regressionBurden: 0.15,
  orphanRisk: 0.10,
} as const;

/**
 * Compute composite health score from components.
 * Component percentages computed from exact fractions,
 * rounded to one decimal place after weighting.
 */
export function computeHealthScore(c: HealthScoreComponents): number {
  const raw =
    c.availability * HEALTH_WEIGHTS.availability +
    c.metadata * HEALTH_WEIGHTS.metadata +
    c.schema * HEALTH_WEIGHTS.schema +
    c.regressionBurden * HEALTH_WEIGHTS.regressionBurden +
    c.orphanRisk * HEALTH_WEIGHTS.orphanRisk;
  return Math.round(raw * 10) / 10;
}

// =============================================================================
// CRON RESPONSE
// =============================================================================

export interface SentinelCronResponse {
  ok: boolean;
  message: string;
  runId: string | null;
  pagesCrawled: number;
  pagesTotal: number;
  regressionsFound: number;
  durationMs: number;
  ranAt: string;
  skipped?: boolean;
  skipReason?: string;
}
