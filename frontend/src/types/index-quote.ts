// frontend/src/types/index-quote.ts
// ============================================================================
// INDEX QUOTE TYPE - Live stock market index data (gateway response shape)
// ============================================================================
// Important: gateway can legitimately return nulls for prices/changes (provider
// downtime, closed markets, budget blocks, etc.). This file matches that reality.
// ============================================================================

/**
 * Represents a single index quote from the gateway (Marketstack-backed).
 *
 * Note: price/change/percentChange/asOf can be null.
 */
export interface IndexQuote {
  /**
   * Exchange ID this index belongs to.
   * Matches Exchange.id in exchanges.catalog.json.
   * @example "tse-tokyo", "nyse-new-york"
   */
  id: string;

  /**
   * Marketstack benchmark key.
   * @example "nikkei_225", "sp500", "ftse_100"
   */
  benchmark: string;

  /**
   * Human-readable index name.
   * @example "Nikkei 225", "S&P 500", "FTSE 100"
   */
  indexName: string;

  /**
   * Current index price/value (nullable).
   */
  price: number | null;

  /**
   * Day change in points (nullable).
   */
  change: number | null;

  /**
   * Day change as percentage (nullable).
   */
  percentChange: number | null;

  /**
   * ISO 8601 timestamp of quote (nullable).
   */
  asOf: string | null;
}

/**
 * Direction indicator for index movement.
 */
export type IndexTick = 'up' | 'down' | 'flat';

/**
 * Derive tick direction from change/percentChange (nullable-safe).
 */
export function getIndexTick(change: number | null, percentChange?: number | null): IndexTick {
  const c = change ?? null;
  const p = percentChange ?? null;

  if (c === null && p === null) return 'flat';

  // Prefer percentChange if present; otherwise use change.
  const signal = p !== null ? p : c !== null ? c : 0;

  if (signal > 0) return 'up';
  if (signal < 0) return 'down';
  return 'flat';
}

/**
 * Format index price with locale-aware thousands separators.
 */
export function formatIndexPrice(price: number | null): string {
  if (price === null || !Number.isFinite(price)) return '—';
  return price.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format change with sign and locale-aware formatting.
 */
export function formatIndexChange(change: number | null): string {
  if (change === null || !Number.isFinite(change)) return '—';
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format percentage change with sign.
 */
export function formatIndexPercent(percent: number | null): string {
  if (percent === null || !Number.isFinite(percent)) return '—';
  const sign = percent >= 0 ? '+' : '';
  return `${sign}${percent.toFixed(2)}%`;
}
