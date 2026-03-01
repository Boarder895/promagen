// src/lib/admin/scoring-health-types.ts
// ============================================================================
// SCORING HEALTH DASHBOARD — Shared TypeScript Types
// ============================================================================
//
// Types used across all scoring health dashboard components and API routes.
// Single source of truth — all components import from here.
//
// Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md
//
// Version: 9.1.0 — Phase 7.11j v2 (Git-Aware + Act-on-Proposal — all 12 sections live)
// Created: 2026-03-01
//
// Existing features preserved: Yes.
// ============================================================================

// ============================================================================
// SPARKLINE DATA
// ============================================================================

/** Single data point for CSS sparkline rendering */
export interface SparklinePoint {
  /** ISO timestamp or label */
  label: string;
  /** Numeric value (will be normalised 0–1 for rendering) */
  value: number;
}

// ============================================================================
// PULSE INDICATORS
// ============================================================================

/** Traffic-light status for quick-pulse indicators */
export type PulseStatus = 'healthy' | 'warning' | 'critical' | 'unknown';

/** Single pulse indicator (e.g., "Correlation ✅") */
export interface PulseIndicator {
  /** Human-readable label */
  label: string;
  /** Traffic-light status */
  status: PulseStatus;
  /** Optional tooltip detail */
  detail?: string;
}

// ============================================================================
// SECTION 1: SCORER HEALTH OVERVIEW
// ============================================================================

/** Response shape for GET /api/admin/scoring-health/overview */
export interface ScorerHealthOverviewData {
  /** Current score-outcome Pearson correlation (0–1) */
  correlation: number;

  /** Per-tier correlations (keys: "1", "2", "3", "4") */
  tierCorrelations: Record<string, number>;

  /** Month-over-month correlation change (positive = improving) */
  correlationTrend: number;

  /** 30-point sparkline history (one per cron run) */
  correlationHistory: SparklinePoint[];

  /** Total qualifying events in the learning pipeline */
  totalPrompts: number;

  /** Events added in the last 7 days */
  weeklyDelta: number;

  /** Count of A/B tests by status */
  abTests: {
    running: number;
    pending: number;
    concluded: number;
  };

  /** Last cron run details */
  lastCron: {
    /** ISO timestamp of last run */
    timestamp: string | null;
    /** Duration in seconds */
    durationSeconds: number | null;
    /** Whether the last run succeeded */
    success: boolean;
  };

  /** Pipeline uptime percentage over last 30 days */
  pipelineUptime: number;

  /** Quick-pulse traffic-light indicators */
  pulse: PulseIndicator[];

  /** ISO timestamp when this data was generated */
  generatedAt: string;
}

// ============================================================================
// SECTION 2: WEIGHT DRIFT
// ============================================================================

/** Drift summary for a single scoring factor */
export interface FactorDrift {
  /** Factor name (e.g. "coherence", "categoryCount") */
  factor: string;
  /** Weight at baseline (uniform 1/N) */
  startWeight: number;
  /** Current learned weight */
  endWeight: number;
  /** Percentage change: ((end - start) / start) * 100 */
  changePercent: number;
  /** Direction of drift */
  direction: 'up' | 'down' | 'flat';
  /** Per-factor sparkline (weight-drift over time from health history) */
  sparkline: SparklinePoint[];
}

/** Response shape for GET /api/admin/scoring-health/weight-history */
export interface WeightDriftData {
  /** Per-factor drift summaries, sorted by |changePercent| descending */
  factors: FactorDrift[];
  /** Overall weight drift metric from health report (0 = stable, 1 = overhaul) */
  overallDrift: number;
  /** The factor that grew most */
  biggestMover: { factor: string; changePercent: number } | null;
  /** The factor that shrunk most */
  biggestDecline: { factor: string; changePercent: number } | null;
  /** How many historical snapshots are available */
  snapshotCount: number;
  /** ISO timestamp */
  generatedAt: string;
}

// ============================================================================
// SECTION 3: PER-TIER MODELS HEATMAP
// ============================================================================

/** Weight profile for a single tier */
export interface TierProfile {
  /** Tier key: "1" | "2" | "3" | "4" | "global" */
  tier: string;
  /** Human-readable label (e.g. "Tier 1 (CLIP)") */
  label: string;
  /** Factor → normalised weight */
  weights: Record<string, number>;
  /** Events that contributed to this tier's weights */
  eventCount: number;
}

/** Heatmap extreme (hottest or coldest cell) */
export interface HeatmapExtreme {
  factor: string;
  tier: string;
  weight: number;
}

/** Response shape for GET /api/admin/scoring-health/tier-weights */
export interface TierWeightsData {
  /** All unique factor names across all tiers, sorted */
  factors: string[];
  /** Per-tier profiles (Tier 1–4 + global) */
  tiers: TierProfile[];
  /** Maximum weight across all cells (for heatmap normalisation) */
  maxWeight: number;
  /** Highest weight cell */
  hottest: HeatmapExtreme | null;
  /** Lowest non-zero weight cell */
  coldest: HeatmapExtreme | null;
  /** ISO timestamp */
  generatedAt: string;
}

// ============================================================================
// LIVE CONTROL PANEL — WEIGHT EDITING
// ============================================================================

/** Request body for POST /api/admin/scoring-health/weight-edit */
export interface WeightEditRequest {
  /** Tier to edit: "1", "2", "3", "4", or "global" */
  tier: string;
  /** Factor to edit (e.g. "coherence") */
  factor: string;
  /** New weight value (0–1). Will be renormalised across all factors in that tier. */
  newWeight: number;
  /** Whether to auto-normalise remaining factors to sum to 1.0 */
  normalise: boolean;
}

/** Response from POST /api/admin/scoring-health/weight-edit */
export interface WeightEditResponse {
  /** The tier that was edited */
  tier: string;
  /** Updated weights for that tier (all factors, post-normalisation) */
  updatedWeights: Record<string, number>;
  /** Previous weights (for undo) */
  previousWeights: Record<string, number>;
  /** ISO timestamp */
  editedAt: string;
}

// ============================================================================
// SECTION 4: TERM QUALITY LEADERBOARD
// ============================================================================

/** A single term's quality data for the leaderboard */
export interface TermQualityEntry {
  /** The term text */
  term: string;
  /** Quality score 0–100 (50 = average) */
  score: number;
  /** Usage count (events containing this term) */
  usage: number;
  /** Trend: score delta vs last run, clamped [-1, +1] */
  trend: number;
  /** Vocabulary category this term belongs to */
  category: string;
}

/** Sort column options */
export type TermQualitySortField = 'score' | 'usage' | 'trend' | 'term';

/** Filter/sort state for the leaderboard */
export interface TermQualityFilters {
  category: string;
  tier: string;
  sortBy: TermQualitySortField;
  sortDir: 'asc' | 'desc';
  search: string;
}

/** API response for GET /api/admin/scoring-health/term-quality */
export interface TermQualityData {
  top: TermQualityEntry[];
  bottom: TermQualityEntry[];
  summary: {
    totalScored: number;
    highPerformers: number;
    lowPerformers: number;
    averageScore: number;
  };
  tier: string;
  generatedAt: string;
}

// ============================================================================
// SECTION 5: ANTI-PATTERN ALERTS
// ============================================================================

/** Severity level for anti-pattern alerts */
export type AntiPatternSeverity = 'high' | 'medium' | 'low';

/** A single anti-pattern alert for display */
export interface AntiPatternAlert {
  /** Unique ID for this alert */
  id: string;
  /** The term pair that triggers this pattern */
  termA: string;
  termB: string;
  /** Type: collision, conflict, or redundancy */
  patternType: 'collision' | 'conflict' | 'redundancy';
  /** Severity score 0–1 */
  severity: number;
  /** Computed severity bucket */
  severityLevel: AntiPatternSeverity;
  /** How many times this pair has been seen */
  occurrenceCount: number;
  /** Average quality impact (negative = bad) */
  qualityImpact: number;
  /** Whether this alert has been suppressed by admin */
  suppressed: boolean;
  /** Whether this alert has been dismissed by admin */
  dismissed: boolean;
}

/** API response for GET /api/admin/scoring-health/anti-patterns */
export interface AntiPatternData {
  /** Alerts grouped by severity */
  high: AntiPatternAlert[];
  medium: AntiPatternAlert[];
  low: AntiPatternAlert[];
  /** Summary stats */
  summary: {
    totalActive: number;
    overridesApplied: number;
    autoDetectedThisMonth: number;
  };
  /** Which tier this data represents */
  tier: string;
  generatedAt: string;
}

// ============================================================================
// SECTION 6: A/B TEST RESULTS (wraps existing dashboard)
// ============================================================================

/** Single test history entry for the timeline */
export interface ABTestHistoryEntry {
  /** Test ID */
  testId: string;
  /** Test name (human-readable) */
  name: string;
  /** Final outcome */
  outcome: 'promoted' | 'rolled_back' | 'running' | 'pending';
  /** Lift percentage */
  lift: number | null;
  /** When the test concluded */
  concludedAt: string | null;
  /** When the test started */
  startedAt: string;
}

/** API response for GET /api/admin/scoring-health/ab-tests */
export interface ABTestSectionData {
  /** Test history for timeline display */
  history: ABTestHistoryEntry[];
  /** Summary counts */
  summary: {
    running: number;
    promoted: number;
    rolledBack: number;
    totalTests: number;
  };
  generatedAt: string;
}

// ============================================================================
// TERM INSPECTOR (Inline detail panel)
// ============================================================================

/** Per-platform quality breakdown for a term */
export interface TermPlatformBreakdown {
  platformId: string;
  score: number;
  eventCount: number;
  trend: number;
}

/** Full inspection data for a single term */
export interface TermInspectData {
  /** The term text */
  term: string;
  /** Quality scores per tier */
  tierScores: Record<string, { score: number; eventCount: number; trend: number }>;
  /** Per-platform breakdown (within the selected tier) */
  platforms: TermPlatformBreakdown[];
  /** Vocabulary category */
  category: string;
  /** Overall quality score */
  globalScore: number;
  /** Overall usage count */
  globalUsage: number;
  /** Overall trend */
  globalTrend: number;
  generatedAt: string;
}

// ============================================================================
// SECTION NAV
// ============================================================================

/** Sidebar navigation section definition */
export interface ScoringHealthSection {
  /** URL hash / IntersectionObserver target ID */
  id: string;
  /** Display label */
  label: string;
  /** Section number for display */
  number: number;
  /** Whether this section is built yet (false = placeholder) */
  enabled: boolean;
}

/** All sections in the scoring health dashboard */
export const SCORING_HEALTH_SECTIONS: ScoringHealthSection[] = [
  { id: 'scorer-health',       label: 'Scorer Health',       number: 1,  enabled: true },
  { id: 'weight-drift',        label: 'Weight Drift',        number: 2,  enabled: true },
  { id: 'tier-models',         label: 'Per-Tier Models',     number: 3,  enabled: true },
  { id: 'control-panel',       label: 'Control Panel',       number: 11, enabled: true },
  { id: 'term-quality',        label: 'Term Quality',        number: 4,  enabled: true },
  { id: 'anti-patterns',       label: 'Anti-Patterns',       number: 5,  enabled: true },
  { id: 'ab-tests',            label: 'A/B Tests',           number: 6,  enabled: true },
  { id: 'pipeline-graph',      label: 'Pipeline Graph',      number: 7,  enabled: true },
  { id: 'temporal-trends',     label: 'Temporal Trends',     number: 8,  enabled: true },
  { id: 'skill-distribution',  label: 'Skill Distribution',  number: 9,  enabled: true },
  { id: 'feedback-summary',    label: 'Feedback Summary',    number: 10, enabled: true },
  { id: 'code-radar',          label: 'Code Radar',          number: 12, enabled: true },
];

// ============================================================================
// API RESPONSE ENVELOPE
// ============================================================================

/**
 * Standard response shape for all scoring health API routes.
 * Matches the pattern used in /api/learning/* routes.
 */
export interface ScoringHealthApiResponse<T> {
  ok: boolean;
  data: T | null;
  message?: string;
  generatedAt: string;
}

// ============================================================================
// AUTO-REFRESH CONFIGURATION
// ============================================================================

/** Refresh intervals in milliseconds per section */
export const REFRESH_INTERVALS: Record<string, number> = {
  overview:             5 * 60 * 1_000,  // 5 minutes
  'weight-drift':       0,               // On-demand only
  'tier-models':        5 * 60 * 1_000,
  'control-panel':      0,               // On-demand only
  'term-quality':       0,               // On-demand only
  'anti-patterns':      5 * 60 * 1_000,
  'ab-tests':           5 * 60 * 1_000,
  'pipeline-graph':     5 * 60 * 1_000,
  'temporal-trends':    5 * 60 * 1_000,
  'skill-distribution': 0,               // On-demand only
  'feedback-summary':   5 * 60 * 1_000,
  'code-radar':         5 * 60 * 1_000,
};

// ============================================================================
// UTILITY: SPARKLINE NORMALISATION
// ============================================================================

/**
 * Normalise sparkline points to 0–1 range for CSS rendering.
 * Returns empty array for empty input. Handles constant values (all same).
 */
export function normaliseSparkline(points: SparklinePoint[]): number[] {
  if (points.length === 0) return [];

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  if (range === 0) return values.map(() => 0.5); // Constant → mid-line

  return values.map((v) => (v - min) / range);
}

// ============================================================================
// UTILITY: TREND FORMATTING
// ============================================================================

/**
 * Format a trend value as a signed string with arrow.
 * Positive = ▲, Negative = ▼, Zero = —
 */
export function formatTrend(value: number): { text: string; direction: 'up' | 'down' | 'flat' } {
  if (Math.abs(value) < 0.001) return { text: '— 0.000', direction: 'flat' };
  if (value > 0) return { text: `▲ +${value.toFixed(3)}`, direction: 'up' };
  return { text: `▼ ${value.toFixed(3)}`, direction: 'down' };
}

/**
 * Format relative time from an ISO timestamp.
 * "2h 14m ago", "3d ago", "just now"
 */
export function formatRelativeTime(isoTimestamp: string | null): string {
  if (!isoTimestamp) return 'Never';

  const ageMs = Date.now() - new Date(isoTimestamp).getTime();
  if (ageMs < 0) return 'just now';

  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m ago` : `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ============================================================================
// UTILITY: FACTOR DRIFT COMPUTATION (Section 2)
// ============================================================================

/**
 * Compute per-factor drift between the uniform baseline (1/N) and current weights.
 *
 * Since historical per-factor snapshots aren't stored yet, we compare the
 * current learned weights against a uniform baseline. This shows how much
 * the system has diverged from the default starting point — i.e. what it
 * has actually "learned".
 *
 * Returns factors sorted by |changePercent| descending (biggest movers first).
 */
export function computeFactorDrift(
  currentWeights: Record<string, number>,
  weightDriftHistory: SparklinePoint[] = [],
): FactorDrift[] {
  const factors = Object.keys(currentWeights);
  if (factors.length === 0) return [];

  const baseline = 1 / factors.length; // Uniform starting weight

  return factors
    .map((factor): FactorDrift => {
      const endWeight = currentWeights[factor] ?? 0;
      const startWeight = baseline;

      let changePercent = 0;
      if (startWeight > 0) {
        changePercent = ((endWeight - startWeight) / startWeight) * 100;
      } else if (endWeight > 0) {
        changePercent = Infinity;
      }

      const direction: 'up' | 'down' | 'flat' =
        Math.abs(changePercent) < 1 ? 'flat' : changePercent > 0 ? 'up' : 'down';

      return {
        factor,
        startWeight,
        endWeight,
        changePercent,
        direction,
        sparkline: weightDriftHistory,
      };
    })
    .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
}

/**
 * Find the biggest mover (most positive) and biggest decline (most negative)
 * from an array of factor drifts. Ignores Infinity values.
 */
export function findDriftExtremes(drifts: FactorDrift[]): {
  biggestMover: { factor: string; changePercent: number } | null;
  biggestDecline: { factor: string; changePercent: number } | null;
} {
  let biggestMover: { factor: string; changePercent: number } | null = null;
  let biggestDecline: { factor: string; changePercent: number } | null = null;

  for (const d of drifts) {
    if (!isFinite(d.changePercent)) continue;

    if (d.changePercent > 0 && (!biggestMover || d.changePercent > biggestMover.changePercent)) {
      biggestMover = { factor: d.factor, changePercent: d.changePercent };
    }
    if (d.changePercent < 0 && (!biggestDecline || d.changePercent < biggestDecline.changePercent)) {
      biggestDecline = { factor: d.factor, changePercent: d.changePercent };
    }
  }

  return { biggestMover, biggestDecline };
}

// ============================================================================
// SECTION 8: TEMPORAL TRENDS PANEL
// ============================================================================

/** A trending term entry for dashboard display */
export interface TrendingTermDisplay {
  term: string;
  category: string;
  velocity: number;
  direction: 'rising' | 'falling' | 'stable';
  recentCount: number;
  baselineCount: number;
}

/** Seasonal pattern for the current month */
export interface SeasonalInsight {
  term: string;
  category: string;
  currentMonthBoost: number;
  totalEvents: number;
}

/** Weekend/weekday pattern */
export interface WeeklyInsight {
  term: string;
  category: string;
  weekendBoost: number;
  totalEvents: number;
}

/** Freshness status of a temporal data channel */
export interface TemporalFreshness {
  label: string;
  generatedAt: string | null;
  ageMinutes: number;
  status: 'fresh' | 'stale' | 'no-data';
}

/** Complete data for Section 8 */
export interface TemporalTrendsData {
  trending: TrendingTermDisplay[];
  seasonalInsights: SeasonalInsight[];
  weeklyInsights: WeeklyInsight[];
  freshness: {
    seasonal: TemporalFreshness;
    trending: TemporalFreshness;
  };
  tier: string;
  generatedAt: string;
}

// ============================================================================
// SECTION 10: FEEDBACK SUMMARY PANEL
// ============================================================================

/** Feedback distribution across ratings */
export interface FeedbackDistribution {
  positive: number;
  neutral: number;
  negative: number;
  total: number;
}

/** Per-platform satisfaction row */
export interface PlatformFeedback {
  platform: string;
  score: number;
  eventCount: number;
}

/** Daily feedback for sparkline */
export interface DailyFeedback {
  date: string;
  positive: number;
  neutral: number;
  negative: number;
}

/** Red flag alert from feedback data */
export interface FeedbackRedFlag {
  type: string;
  message: string;
  severity: 'warning' | 'critical';
  platform?: string;
}

/** Complete data for Section 10 */
export interface FeedbackSummaryData {
  velocity: {
    today: number;
    thisWeek: number;
    allTime: number;
  };
  sentiment: FeedbackDistribution;
  dailySpark: DailyFeedback[];
  platformSatisfaction: PlatformFeedback[];
  redFlags: FeedbackRedFlag[];
  generatedAt: string;
}

// ============================================================================
// SECTION 9: SKILL DISTRIBUTION PANEL
// ============================================================================

/** Skill level classification */
export type SkillLevel = 'beginner' | 'intermediate' | 'expert';

/** Distribution bar for a single skill level */
export interface SkillLevelBar {
  level: SkillLevel;
  count: number;
  percentage: number;
}

/** Graduation funnel entry (transitions between skill levels) */
export interface GraduationFunnel {
  from: SkillLevel;
  to: SkillLevel;
  count: number;
  avgSessions: number;
}

/** Tier usage breakdown per skill level */
export interface TierUsageBySkill {
  level: SkillLevel;
  /** Percentage of this skill level's events in each tier (keys: "1","2","3","4") */
  tiers: Record<string, number>;
}

/** Complete data for Section 9 */
export interface SkillDistributionData {
  distribution: SkillLevelBar[];
  totalUsers: number;
  graduationFunnel: GraduationFunnel[];
  avgGraduationDays: number;
  tierUsageBySkill: TierUsageBySkill[];
  generatedAt: string;
}

// ============================================================================
// UTILITY: HEATMAP EXTREMES (Section 3)
// ============================================================================

/**
 * Find the hottest (highest weight) and coldest (lowest non-zero weight)
 * cells across all tiers and factors.
 */
export function findHeatmapExtremes(
  tiers: TierProfile[],
  factors: string[],
): { hottest: HeatmapExtreme | null; coldest: HeatmapExtreme | null } {
  let hottest: HeatmapExtreme | null = null;
  let coldest: HeatmapExtreme | null = null;

  for (const tier of tiers) {
    for (const factor of factors) {
      const w = tier.weights[factor] ?? 0;
      if (!hottest || w > hottest.weight) {
        hottest = { factor, tier: tier.label, weight: w };
      }
      if (w > 0 && (!coldest || w < coldest.weight)) {
        coldest = { factor, tier: tier.label, weight: w };
      }
    }
  }

  return { hottest, coldest };
}
