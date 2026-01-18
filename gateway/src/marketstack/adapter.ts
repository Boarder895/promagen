/**
 * Promagen Gateway - Marketstack API Adapter
 * ============================================
 * Handles all communication with the Marketstack API.
 *
 * Security: 10/10
 * - API key fetched dynamically at call time (never cached)
 * - Input validation on all parameters
 * - Timeout protection (15 second limit)
 * - Structured error handling
 * - No sensitive data in logs
 *
 * API: Uses v1 EOD endpoint (more reliable than v2/indexinfo)
 * Note: Free tier uses HTTP, not HTTPS
 *
 * @module marketstack/adapter
 */

import { logDebug, logWarn, logError } from '../lib/logging.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Marketstack API base URL.
 * Note: Free tier only supports HTTP, not HTTPS.
 */
const MARKETSTACK_BASE_URL = 'http://api.marketstack.com';

/** Request timeout in milliseconds */
const REQUEST_TIMEOUT_MS = 15_000;

/** Maximum symbols per request */
const MAX_SYMBOLS_PER_REQUEST = 100;

// =============================================================================
// BENCHMARK TO SYMBOL MAPPING
// =============================================================================

/**
 * Maps our benchmark keys to Marketstack v1 EOD index symbols.
 * Format: benchmark_key -> SYMBOL.INDX
 *
 * IMPORTANT: This is the authoritative mapping.
 * If you add new indices, add them here first.
 */
export const BENCHMARK_TO_MARKETSTACK: Record<string, string> = {
  // ==========================================================================
  // Major US Indices
  // ==========================================================================
  sp500: 'GSPC.INDX',
  dow_jones: 'DJI.INDX',
  djia: 'DJI.INDX', // Alias: catalog uses 'djia'
  nasdaq_composite: 'IXIC.INDX',
  nasdaq: 'IXIC.INDX', // Alias: catalog uses 'nasdaq' for nasdaq-new-york
  russell_2000: 'RUT.INDX',

  // ==========================================================================
  // European Indices
  // ==========================================================================
  ftse_100: 'FTSE.INDX',
  dax: 'GDAXI.INDX',
  cac_40: 'FCHI.INDX',
  ibex_35: 'IBEX.INDX',
  ftse_mib: 'FTSEMIB.INDX',
  aex: 'AEX.INDX',
  smi: 'SSMI.INDX',
  atx: 'ATX.INDX',
  // Belgium
  bel20: 'BFX.INDX',
  bel_20: 'BFX.INDX', // Alias: catalog uses 'bel_20' for euronext-brussels
  // Portugal
  psi20: 'PSI20.INDX',
  psi_20: 'PSI20.INDX', // Alias: catalog uses 'psi_20' for euronext-lisbon
  // Nordics
  omx_stockholm_30: 'OMXS30.INDX',
  omx_copenhagen_20: 'OMXC20.INDX',
  omx_helsinki_25: 'OMXH25.INDX',
  osebx: 'OSEAX.INDX',
  // Poland
  wig20: 'WIG20.INDX',
  wig_20: 'WIG20.INDX', // Alias: catalog uses 'wig_20' for gpw-warsaw
  // Hungary (Budapest)
  bux: 'BUX.INDX', // Budapest Stock Exchange - catalog uses 'bux' for budapest-bet
  // Greece, Romania, Russia, Turkey
  athex: 'GD.INDX',
  bet: 'BET.INDX',
  moex: 'IMOEX.INDX',
  bist_100: 'XU100.INDX',

  // ==========================================================================
  // Asia-Pacific Indices
  // ==========================================================================
  nikkei_225: 'N225.INDX',
  hang_seng: 'HSI.INDX',
  sse_composite: '000001.INDX',
  szse_component: '399001.INDX',
  kospi: 'KS11.INDX',
  taiex: 'TWII.INDX',
  asx200: 'AXJO.INDX',
  nzx_50: 'NZ50.INDX',
  nifty_50: 'NSEI.INDX',
  sensex: 'BSESN.INDX',
  sti: 'STI.INDX',
  klci: 'KLSE.INDX',
  set: 'SET.INDX',
  // Indonesia
  jci: 'JKSE.INDX',
  idx_composite: 'JKSE.INDX', // Alias: catalog uses 'idx_composite' for idx-jakarta
  psei: 'PSEI.INDX',
  aspi: 'CSE.INDX',

  // ==========================================================================
  // Americas (excl. US)
  // ==========================================================================
  tsx_composite: 'GSPTSE.INDX',
  tsx: 'GSPTSE.INDX', // Alias: catalog uses 'tsx' for tsx-toronto
  ibovespa: 'BVSP.INDX',
  merval: 'MERV.INDX',
  ipsa: 'IPSA.INDX',

  // ==========================================================================
  // Middle East & Africa
  // ==========================================================================
  ta_35: 'TA35.INDX',
  tasi: 'TASI.INDX',
  dfm_general: 'DFMGI.INDX',
  adx_general: 'ADI.INDX',
  qe_general: 'QSI.INDX',
  egx_30: 'EGX30.INDX',
  jse_all_share: 'J203.INDX',
  ase: 'AMMAN.INDX',
};

/**
 * Reverse mapping: Marketstack symbol -> benchmark key.
 * Used when parsing API responses.
 */
export const MARKETSTACK_TO_BENCHMARK: Record<string, string> = Object.fromEntries(
  Object.entries(BENCHMARK_TO_MARKETSTACK).map(([k, v]) => [v, k]),
);

// =============================================================================
// API KEY MANAGEMENT
// =============================================================================

/**
 * Get Marketstack API key from environment.
 *
 * SECURITY: Fetched dynamically at call time, not cached at module load.
 * This ensures the key is available even if env vars weren't ready at startup.
 *
 * @returns API key or empty string if not configured
 */
export function getMarketstackApiKey(): string {
  return process.env['MARKETSTACK_API_KEY'] ?? '';
}

/**
 * Check if Marketstack API key is configured.
 */
export function hasMarketstackApiKey(): boolean {
  return getMarketstackApiKey().length > 0;
}

// =============================================================================
// FETCH FUNCTIONS
// =============================================================================

/**
 * Fetch index data from Marketstack v1 EOD endpoint.
 *
 * @param benchmarks - Array of benchmark keys (e.g., ['sp500', 'nikkei_225'])
 * @returns Raw API response
 * @throws Error if request fails or times out
 *
 * @example
 * ```typescript
 * const data = await fetchMarketstackIndices(['sp500', 'nikkei_225']);
 * // Returns: { data: [{ symbol: 'GSPC.INDX', close: 5950.25, ... }] }
 * ```
 */
export async function fetchMarketstackIndices(benchmarks: string[]): Promise<unknown> {
  // Validate input
  if (!Array.isArray(benchmarks) || benchmarks.length === 0) {
    throw new Error('benchmarks must be a non-empty array');
  }

  // Get API key
  const apiKey = getMarketstackApiKey();
  if (!apiKey) {
    throw new Error('MARKETSTACK_API_KEY not configured');
  }

  // Convert benchmark keys to Marketstack symbols
  const symbols: string[] = [];
  for (const benchmark of benchmarks) {
    const symbol = BENCHMARK_TO_MARKETSTACK[benchmark];
    if (symbol) {
      symbols.push(symbol);
    } else {
      logWarn('No Marketstack symbol mapping for benchmark', { benchmark });
    }
  }

  if (symbols.length === 0) {
    throw new Error('No valid Marketstack symbols to fetch');
  }

  // Dedupe and enforce limit
  const uniqueSymbols = [...new Set(symbols)].slice(0, MAX_SYMBOLS_PER_REQUEST);

  // Build URL
  const symbolsParam = uniqueSymbols.join(',');
  const url = `${MARKETSTACK_BASE_URL}/v1/eod/latest?access_key=${encodeURIComponent(
    apiKey,
  )}&symbols=${encodeURIComponent(symbolsParam)}`;

  logDebug('Marketstack request', {
    benchmarkCount: benchmarks.length,
    symbolCount: uniqueSymbols.length,
    symbols: uniqueSymbols.slice(0, 5),
  });

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Promagen-Gateway/1.0',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      logError('Marketstack API error', {
        status: response.status,
        statusText: response.statusText,
        body: text.slice(0, 200),
      });
      throw new Error(`Marketstack API error: HTTP ${response.status}`);
    }

    const data: unknown = await response.json();

    // Check for API-level errors
    if (isApiError(data)) {
      const errorData = data as { error: { code: string; message: string } };
      throw new Error(
        `Marketstack API error: ${errorData.error.message} (${errorData.error.code})`,
      );
    }

    logDebug('Marketstack response received', {
      symbolCount: uniqueSymbols.length,
    });

    return data;
  } catch (error) {
    // Handle timeout
    if (error instanceof Error && error.name === 'TimeoutError') {
      logError('Marketstack request timeout', {
        symbolCount: uniqueSymbols.length,
        timeoutMs: REQUEST_TIMEOUT_MS,
      });
      throw new Error('Marketstack request timeout');
    }

    // Re-throw other errors
    throw error;
  }
}

// =============================================================================
// RESPONSE PARSING
// =============================================================================

/**
 * Check if response is an API-level error.
 */
function isApiError(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return 'error' in obj && obj['error'] !== null;
}

/**
 * Parsed index data from Marketstack response.
 */
export interface ParsedIndexData {
  benchmark: string;
  symbol: string;
  close: number;
  open: number;
  high: number;
  low: number;
  date: string;
}

/**
 * Parse Marketstack v1 EOD response.
 *
 * Response format:
 * {
 *   "data": [
 *     {
 *       "symbol": "GSPC.INDX",
 *       "open": 5920.50,
 *       "high": 5965.00,
 *       "low": 5900.00,
 *       "close": 5950.25,
 *       "volume": 3500000000,
 *       "date": "2026-01-14T00:00:00+0000"
 *     }
 *   ]
 * }
 *
 * @param data - Raw API response
 * @returns Parsed index data entries
 */
export function parseMarketstackResponse(data: unknown): ParsedIndexData[] {
  const results: ParsedIndexData[] = [];

  if (!data || typeof data !== 'object') {
    return results;
  }

  const obj = data as Record<string, unknown>;

  // Check for error response
  if (obj['error']) {
    logError('Marketstack returned error', { error: obj['error'] });
    return results;
  }

  const dataArr = obj['data'];
  if (!Array.isArray(dataArr)) {
    logWarn('Marketstack returned non-array data', { keys: Object.keys(obj) });
    return results;
  }

  for (const item of dataArr) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;

    const symbol = typeof row['symbol'] === 'string' ? row['symbol'] : '';
    if (!symbol) continue;

    // Map symbol back to benchmark
    const benchmark = MARKETSTACK_TO_BENCHMARK[symbol];
    if (!benchmark) {
      logDebug('Unknown Marketstack symbol in response', { symbol });
      continue;
    }

    const close = parseFloat(String(row['close'] ?? ''));
    if (!Number.isFinite(close) || close <= 0) continue;

    const open = parseFloat(String(row['open'] ?? ''));
    const high = parseFloat(String(row['high'] ?? ''));
    const low = parseFloat(String(row['low'] ?? ''));
    const date = typeof row['date'] === 'string' ? row['date'] : '';

    results.push({
      benchmark,
      symbol,
      close,
      open: Number.isFinite(open) ? open : close,
      high: Number.isFinite(high) ? high : close,
      low: Number.isFinite(low) ? low : close,
      date,
    });
  }

  logDebug('Parsed Marketstack data', {
    count: results.length,
    benchmarks: results.slice(0, 5).map((r) => r.benchmark),
  });

  return results;
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Check if a benchmark key has a valid Marketstack mapping.
 */
export function hasMarketstackMapping(benchmark: string): boolean {
  return benchmark in BENCHMARK_TO_MARKETSTACK;
}

/**
 * Get Marketstack symbol for a benchmark key.
 */
export function getMarketstackSymbol(benchmark: string): string | undefined {
  return BENCHMARK_TO_MARKETSTACK[benchmark];
}
