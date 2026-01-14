// src/types/index-quote.ts
// ============================================================================
// INDEX QUOTE TYPE - Live stock market index data
// ============================================================================
// Represents real-time index data from Marketstack API.
// Used by exchange cards to display headline index performance.
// ============================================================================

/**
 * Represents a single index quote from Marketstack.
 *
 * @example
 * ```ts
 * const nikkei: IndexQuote = {
 *   id: 'tse-tokyo',
 *   benchmark: 'nikkei_225',
 *   indexName: 'Nikkei 225',
 *   price: 38945.72,
 *   change: 312.45,
 *   percentChange: 0.81,
 *   asOf: '2025-01-13T14:23:45Z',
 * };
 * ```
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
   * Used to fetch data from /v2/indexinfo endpoint.
   * @example "nikkei_225", "sp500", "ftse_100"
   */
  benchmark: string;

  /**
   * Human-readable index name.
   * @example "Nikkei 225", "S&P 500", "FTSE 100"
   */
  indexName: string;

  /**
   * Current index price/value.
   * @example 38945.72
   */
  price: number;

  /**
   * Day change in points.
   * Positive = up, negative = down.
   * @example 312.45 or -156.20
   */
  change: number;

  /**
   * Day change as percentage.
   * @example 0.81 for +0.81%
   */
  percentChange: number;

  /**
   * ISO 8601 timestamp of when this quote was fetched.
   * @example "2025-01-13T14:23:45Z"
   */
  asOf: string;
}

/**
 * Direction indicator for index movement.
 */
export type IndexTick = 'up' | 'down' | 'flat';

/**
 * Derive tick direction from change value.
 */
export function getIndexTick(change: number): IndexTick {
  if (change > 0) return 'up';
  if (change < 0) return 'down';
  return 'flat';
}

/**
 * Format index price with locale-aware thousands separators.
 * @example formatIndexPrice(38945.72) => "38,945.72"
 */
export function formatIndexPrice(price: number): string {
  return price.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format change with sign and locale-aware formatting.
 * @example formatIndexChange(312.45) => "+312.45"
 * @example formatIndexChange(-156.20) => "-156.20"
 */
export function formatIndexChange(change: number): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format percentage change with sign.
 * @example formatIndexPercent(0.81) => "+0.81%"
 * @example formatIndexPercent(-0.45) => "-0.45%"
 */
export function formatIndexPercent(percent: number): string {
  const sign = percent >= 0 ? '+' : '';
  return `${sign}${percent.toFixed(2)}%`;
}
