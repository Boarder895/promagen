/**
 * Sentinel Signal Correlation Engine (Extra 11)
 *
 * After 8+ weeks of data, computes Pearson correlations between
 * Sentinel's parallel time series: health score, regression count,
 * crawler visits, citation scores, and GA4 referrals.
 *
 * Also computes cross-correlations with lag to detect delayed effects:
 * "Metadata improvements lead to citation increases 2 weeks later."
 *
 * Nobody else connects crawl health → crawler visits → citations
 * → referrals as a measured causal chain. This turns monitoring
 * into proof of what works.
 *
 * Authority: sentinel.md v2.0.0 §15
 * Existing features preserved: Yes
 */

// =============================================================================
// TYPES
// =============================================================================

export interface SignalSeries {
  name: string;
  values: (number | null)[];
  weeks: string[];
}

export interface CorrelationResult {
  signalA: string;
  signalB: string;
  pearsonR: number;
  strength: 'strong' | 'moderate' | 'weak' | 'none';
  direction: 'positive' | 'negative' | 'none';
  sampleSize: number;
  insight: string;
}

export interface LagCorrelation {
  signalA: string;
  signalB: string;
  bestLagWeeks: number;
  pearsonRAtBestLag: number;
  insight: string;
}

export interface CorrelationReport {
  available: boolean;
  minWeeksRequired: number;
  weeksAvailable: number;
  correlations: CorrelationResult[];
  lagCorrelations: LagCorrelation[];
  topInsights: string[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MIN_WEEKS = 8;
const MAX_LAG_WEEKS = 4;

// =============================================================================
// COMPUTATION
// =============================================================================

/**
 * Compute all pairwise correlations between signal series.
 * Returns empty if fewer than MIN_WEEKS of data.
 */
export function computeCorrelations(
  series: SignalSeries[],
): CorrelationReport {
  const maxLen = Math.max(...series.map((s) => s.values.length));

  if (maxLen < MIN_WEEKS) {
    return {
      available: false,
      minWeeksRequired: MIN_WEEKS,
      weeksAvailable: maxLen,
      correlations: [],
      lagCorrelations: [],
      topInsights: [`Need ${MIN_WEEKS - maxLen} more weeks of data for correlation analysis`],
    };
  }

  const correlations: CorrelationResult[] = [];
  const lagCorrelations: LagCorrelation[] = [];

  // Compute all pairwise Pearson correlations
  for (let i = 0; i < series.length; i++) {
    for (let j = i + 1; j < series.length; j++) {
      const a = series[i]!;
      const b = series[j]!;

      // Align series (use overlapping non-null values)
      const { xVals, yVals } = alignSeries(a.values, b.values);

      if (xVals.length < MIN_WEEKS) continue;

      const r = pearsonCorrelation(xVals, yVals);
      const strength = classifyStrength(Math.abs(r));
      const direction = r > 0.1 ? 'positive' : r < -0.1 ? 'negative' : 'none';

      correlations.push({
        signalA: a.name,
        signalB: b.name,
        pearsonR: Math.round(r * 100) / 100,
        strength,
        direction,
        sampleSize: xVals.length,
        insight: generateInsight(a.name, b.name, r, strength),
      });

      // Compute lag correlations (does A lead B?)
      const lag = findBestLag(a.values, b.values, MAX_LAG_WEEKS);
      if (lag && Math.abs(lag.r) > Math.abs(r) + 0.1) {
        lagCorrelations.push({
          signalA: a.name,
          signalB: b.name,
          bestLagWeeks: lag.lagWeeks,
          pearsonRAtBestLag: Math.round(lag.r * 100) / 100,
          insight: `${a.name} changes lead ${b.name} changes by ${lag.lagWeeks} week${lag.lagWeeks > 1 ? 's' : ''} (r=${lag.r.toFixed(2)})`,
        });
      }
    }
  }

  // Sort by absolute correlation strength
  correlations.sort((a, b) => Math.abs(b.pearsonR) - Math.abs(a.pearsonR));
  lagCorrelations.sort((a, b) => Math.abs(b.pearsonRAtBestLag) - Math.abs(a.pearsonRAtBestLag));

  // Generate top insights
  const topInsights: string[] = [];
  const strongCorrs = correlations.filter((c) => c.strength === 'strong');
  for (const c of strongCorrs.slice(0, 3)) {
    topInsights.push(c.insight);
  }
  for (const l of lagCorrelations.slice(0, 2)) {
    topInsights.push(l.insight);
  }

  return {
    available: true,
    minWeeksRequired: MIN_WEEKS,
    weeksAvailable: maxLen,
    correlations,
    lagCorrelations,
    topInsights,
  };
}

/**
 * Format correlation report for the Monday email.
 */
export function formatCorrelationReport(report: CorrelationReport): string | null {
  if (!report.available || report.topInsights.length === 0) return null;

  const lines: string[] = [];
  lines.push(`🔬 SIGNAL CORRELATIONS (${report.weeksAvailable} weeks of data)`);

  for (const insight of report.topInsights) {
    lines.push(`  • ${insight}`);
  }

  return lines.join('\n');
}

// =============================================================================
// MATH
// =============================================================================

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 3) return 0;

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i]!;
    sumY += y[i]!;
    sumXY += x[i]! * y[i]!;
    sumX2 += x[i]! * x[i]!;
    sumY2 += y[i]! * y[i]!;
  }

  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (den === 0) return 0;
  return num / den;
}

function alignSeries(
  a: (number | null)[],
  b: (number | null)[],
): { xVals: number[]; yVals: number[] } {
  const xVals: number[] = [];
  const yVals: number[] = [];
  const len = Math.min(a.length, b.length);

  for (let i = 0; i < len; i++) {
    if (a[i] !== null && b[i] !== null) {
      xVals.push(a[i]!);
      yVals.push(b[i]!);
    }
  }

  return { xVals, yVals };
}

function findBestLag(
  a: (number | null)[],
  b: (number | null)[],
  maxLag: number,
): { lagWeeks: number; r: number } | null {
  let bestR = 0;
  let bestLag = 0;

  for (let lag = 1; lag <= maxLag; lag++) {
    // Shift A forward by lag weeks, compare to B
    const shiftedA = a.slice(0, a.length - lag);
    const shiftedB = b.slice(lag);

    const { xVals, yVals } = alignSeries(shiftedA, shiftedB);
    if (xVals.length < MIN_WEEKS - lag) continue;

    const r = pearsonCorrelation(xVals, yVals);
    if (Math.abs(r) > Math.abs(bestR)) {
      bestR = r;
      bestLag = lag;
    }
  }

  if (bestLag === 0 || Math.abs(bestR) < 0.3) return null;
  return { lagWeeks: bestLag, r: bestR };
}

function classifyStrength(absR: number): CorrelationResult['strength'] {
  if (absR >= 0.7) return 'strong';
  if (absR >= 0.4) return 'moderate';
  if (absR >= 0.2) return 'weak';
  return 'none';
}

function generateInsight(
  nameA: string,
  nameB: string,
  r: number,
  strength: CorrelationResult['strength'],
): string {
  if (strength === 'none' || strength === 'weak') {
    return `${nameA} and ${nameB} show no meaningful correlation`;
  }

  const dir = r > 0 ? 'positively' : 'inversely';
  const strengthWord = strength === 'strong' ? 'strongly' : 'moderately';

  return `${nameA} and ${nameB} are ${strengthWord} ${dir} correlated (r=${r.toFixed(2)})`;
}
