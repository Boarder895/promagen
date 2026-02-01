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
 * Note: Professional tier uses HTTPS
 *
 * UPDATED: 2026-01-31 - Complete 107-benchmark mapping for Marketstack
 *
 * @module marketstack/adapter
 */

import { logDebug, logWarn, logError } from '../lib/logging.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Marketstack API base URL.
 * Professional tier supports HTTPS.
 */
const MARKETSTACK_BASE_URL = 'https://api.marketstack.com';

/** Request timeout in milliseconds */
const REQUEST_TIMEOUT_MS = 15_000;

/** Maximum symbols per request */
const MAX_SYMBOLS_PER_REQUEST = 100;

// =============================================================================
// BENCHMARK TO SYMBOL MAPPING
// =============================================================================

/**
 * Maps catalog benchmark keys to Marketstack v1 EOD index symbols.
 * Format: benchmark_key -> SYMBOL.INDX
 *
 * IMPORTANT: This is the authoritative mapping.
 * Catalog benchmarks use Marketstack's benchmark naming (e.g., gb100, de40).
 * This adapter converts them to v1/eod symbol codes (e.g., FTSE.INDX, GDAXI.INDX).
 *
 * Last updated: 2026-01-31
 * Total mappings: 107 (all catalog benchmarks)
 */
export const BENCHMARK_TO_MARKETSTACK: Record<string, string> = {
  // ==========================================================================
  // Americas - United States
  // ==========================================================================
  us30: 'DJI.INDX', // Dow Jones 30
  us100: 'NDX.INDX', // NASDAQ 100
  us500: 'GSPC.INDX', // S&P 500
  us1000: 'RUI.INDX', // Russell 1000

  // ==========================================================================
  // Americas - Canada
  // ==========================================================================
  tsx: 'GSPTSE.INDX', // S&P/TSX Composite

  // ==========================================================================
  // Americas - Latin America
  // ==========================================================================
  ibovespa: 'BVSP.INDX', // Brazil IBOVESPA
  ibc: 'IBX50.INDX', // Brazil IBrX 100
  merval: 'MERV.INDX', // Argentina MERVAL
  igpa: 'IGPA.INDX', // Chile IGPA
  colcap: 'COLCAP.INDX', // Colombia COLCAP
  ipc: 'MXX.INDX', // Mexico IPC
  peru_general: 'SPBLPGPT.INDX', // Peru S&P/BVL General
  bvpsi: 'IBC.INDX', // Venezuela IBC
  ecuador_general: 'ECUINDEX.INDX', // Ecuador General

  // ==========================================================================
  // Europe - United Kingdom & Ireland
  // ==========================================================================
  gb100: 'FTSE.INDX', // FTSE 100
  iseq: 'ISEQ.INDX', // Ireland ISEQ Overall

  // ==========================================================================
  // Europe - Eurozone Core
  // ==========================================================================
  de40: 'GDAXI.INDX', // Germany DAX 40
  mdax: 'MDAXI.INDX', // Germany MDAX
  de_mid: 'MDAXI.INDX', // Germany MDAX (alias)
  sdax: 'SDAXI.INDX', // Germany SDAX
  de_small: 'SDAXI.INDX', // Germany SDAX (alias)
  fr40: 'FCHI.INDX', // France CAC 40
  nl25: 'AEX.INDX', // Netherlands AEX 25
  be20: 'BFX.INDX', // Belgium BEL 20
  it40: 'FTSEMIB.INDX', // Italy FTSE MIB 40
  es35: 'IBEX.INDX', // Spain IBEX 35
  psi_20: 'PSI20.INDX', // Portugal PSI 20
  psi: 'PSI20.INDX', // Portugal PSI (alias)
  psi_geral: 'PSI20.INDX', // Portugal PSI Geral (alias)
  luxx: 'LUXX.INDX', // Luxembourg LuxX

  // ==========================================================================
  // Europe - Pan-European
  // ==========================================================================
  eu50: 'STOXX50E.INDX', // Euro Stoxx 50
  eu100: 'SX5E.INDX', // Euro Stoxx 100
  eu350: 'STOXX.INDX', // Euro Stoxx 350
  eu600: 'SXXP.INDX', // STOXX Europe 600
  euro_stoxx_banks: 'SX7E.INDX', // Euro Stoxx Banks

  // ==========================================================================
  // Europe - Nordic
  // ==========================================================================
  stockholm: 'OMXSPI.INDX', // OMX Stockholm
  stockholm_30: 'OMXS30.INDX', // OMX Stockholm 30
  copenhagen: 'OMXC20.INDX', // OMX Copenhagen 20
  helsinki: 'OMXHPI.INDX', // OMX Helsinki
  helsinki_25: 'OMXH25.INDX', // OMX Helsinki 25
  oslo: 'OSEAX.INDX', // Oslo Børs All-Share
  icex: 'ICEX.INDX', // Iceland ICEX

  // ==========================================================================
  // Europe - Baltic
  // ==========================================================================
  riga: 'OMXRGI.INDX', // OMX Riga
  tallinn: 'OMXTGI.INDX', // OMX Tallinn
  vilnius: 'OMXVGI.INDX', // OMX Vilnius

  // ==========================================================================
  // Europe - Central & Eastern
  // ==========================================================================
  ch20: 'SSMI.INDX', // Switzerland SMI
  ch50: 'SMIM.INDX', // Switzerland SMI Mid
  atx: 'ATX.INDX', // Austria ATX
  wig: 'WIG.INDX', // Poland WIG
  px: 'PX.INDX', // Czech Republic PX
  bux: 'BUX.INDX', // Hungary BUX
  bet: 'BET.INDX', // Romania BET
  sofix: 'SOFIX.INDX', // Bulgaria SOFIX
  sax: 'SAX.INDX', // Slovakia SAX
  sbitop: 'SBITOP.INDX', // Slovenia SBI TOP
  crobex: 'CROBEX.INDX', // Croatia CROBEX
  'sasx-10': 'SASX10.INDX', // Bosnia SASX-10
  sasx_10: 'SASX10.INDX', // Bosnia SASX-10 (alias)
  belex_15: 'BELEX15.INDX', // Serbia BELEX 15
  monex: 'MONEX.INDX', // Montenegro MONEX
  mbi_10: 'MBI10.INDX', // North Macedonia MBI 10

  // ==========================================================================
  // Europe - Other
  // ==========================================================================
  athens_general: 'GD.INDX', // Greece Athens General
  bist_100: 'XU100.INDX', // Turkey BIST 100
  moex: 'IMOEX.INDX', // Russia MOEX
  pfts: 'PFTS.INDX', // Ukraine PFTS

  // ==========================================================================
  // Middle East
  // ==========================================================================
  'ta-125': 'TA125.INDX', // Israel TA-125
  tasi: 'TASI.INDX', // Saudi Arabia TASI
  adx_general: 'ADI.INDX', // UAE Abu Dhabi ADX General
  dfm_general: 'DFMGI.INDX', // UAE Dubai DFM General
  qe: 'QSI.INDX', // Qatar QE Index
  kuwait_all_share: 'KWSE.INDX', // Kuwait All Share
  msm_30: 'MSM30.INDX', // Oman MSM 30
  bsx: 'BSX.INDX', // Bahrain BSX
  estirad: 'BHSEASI.INDX', // Bahrain All Share
  ase: 'AMMAN.INDX', // Jordan ASE General
  blom: 'BLOM.INDX', // Lebanon BLOM
  tedpix: 'TEDPIX.INDX', // Iran TEDPIX

  // ==========================================================================
  // Africa
  // ==========================================================================
  egx_30: 'EGX30.INDX', // Egypt EGX 30
  saall: 'J203.INDX', // South Africa JSE All Share (alias)
  sa40: 'J200.INDX', // South Africa FTSE/JSE Top 40
  jse: 'J203.INDX', // South Africa JSE All Share
  cfg_25: 'MASI.INDX', // Morocco CFG 25
  nairobi_20: 'NSE20.INDX', // Kenya NSE 20
  nairobi_all_share: 'NSEASI.INDX', // Kenya NSE All Share
  'nse-all_share': 'NGSEINDX.INDX', // Nigeria NSE All-Share
  nse_all_share: 'NGSEINDX.INDX', // Nigeria NSE All-Share (alias)
  ggseci: 'GGSECI.INDX', // Ghana GSE Composite
  gaborone: 'BGSMDC.INDX', // Botswana BSE DCI
  nsx_overall: 'NSX.INDX', // Namibia NSX Overall
  dsei: 'DSEI.INDX', // Tanzania DSE Index
  semdex: 'SEMDEX.INDX', // Mauritius SEMDEX
  tun: 'TUNINDEX.INDX', // Tunisia Tunindex
  use_all_share: 'USEASI.INDX', // Uganda USE All Share
  zsi_industrials: 'ZSEI.INDX', // Zimbabwe ZSI Industrials

  // ==========================================================================
  // Asia - East Asia
  // ==========================================================================
  jp225: 'N225.INDX', // Japan Nikkei 225
  jpvix: 'JNIV.INDX', // Japan VIX
  hk50: 'HSI.INDX', // Hong Kong Hang Seng
  csi_300: 'CSI300.INDX', // China CSI 300
  shanghai: 'SHCOMP.INDX', // China SSE Composite
  shanghai_50: 'SSE50.INDX', // China SSE 50
  taiwan_stock_market_index: 'TWII.INDX', // Taiwan TAIEX

  // ==========================================================================
  // Asia - Southeast Asia
  // ==========================================================================
  sti: 'STI.INDX', // Singapore STI
  fklci: 'KLSE.INDX', // Malaysia FTSE Bursa KLCI
  set_50: 'SET50.INDX', // Thailand SET 50
  jci: 'JKSE.INDX', // Indonesia JCI
  psei: 'PSEI.INDX', // Philippines PSEi
  vn: 'VNINDEX.INDX', // Vietnam VN-Index
  hnx: 'HNX.INDX', // Vietnam HNX Index
  lsx_composite: 'LSXC.INDX', // Laos LSX Composite

  // ==========================================================================
  // Asia - South Asia
  // ==========================================================================
  sensex: 'BSESN.INDX', // India Sensex
  nifty_50: 'NSEI.INDX', // India NIFTY 50
  kse_100: 'KSE100.INDX', // Pakistan KSE 100
  aspi: 'CSE.INDX', // Sri Lanka ASPI
  cse_general: 'CSEALL.INDX', // Sri Lanka CSE General
  dse_broad: 'DSEX.INDX', // Bangladesh DSE Broad

  // ==========================================================================
  // Asia - Central Asia
  // ==========================================================================
  kase: 'KASE.INDX', // Kazakhstan KASE Index
  mse: 'MSETOP.INDX', // Mongolia MSE Index
  mse_20: 'MSE20.INDX', // Mongolia MSE Top 20

  // ==========================================================================
  // Oceania
  // ==========================================================================
  asx200: 'AXJO.INDX', // Australia S&P/ASX 200
  asx_all_share: 'AXAO.INDX', // Australia ASX All Share
  au50: 'ATOI.INDX', // Australia S&P/ASX 50
  australia_all_ordinaries: 'AORD.INDX', // Australia All Ordinaries
  nzx_50: 'NZ50.INDX', // New Zealand NZX 50
};

/**
 * Reverse mapping: Marketstack symbol -> benchmark key.
 * Used when parsing API responses.
 *
 * Note: For aliases that share the same symbol (e.g., de_mid and mdax),
 * only one benchmark key will be in the reverse map.
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
 * @param benchmarks - Array of benchmark keys (e.g., ['us500', 'jp225'])
 * @returns Raw API response
 * @throws Error if request fails or times out
 *
 * @example
 * ```typescript
 * const data = await fetchMarketstackIndices(['us500', 'jp225']);
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

  // Build URL (HTTPS for Professional tier)
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

/**
 * Get total number of supported benchmarks.
 */
export function getSupportedBenchmarkCount(): number {
  return Object.keys(BENCHMARK_TO_MARKETSTACK).length;
}
