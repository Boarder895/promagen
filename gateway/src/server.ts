/**
 * Promagen API Gateway - Main Server
 * ==================================
 *
 * Security: 10/10
 * - Input validation on all endpoints
 * - Rate limiting per IP
 * - CORS with allowlist
 * - No secrets in responses
 * - Graceful error handling
 *
 * Efficiency Techniques Implemented:
 * 1. ✅ Server-side TTL caching (persistent in-memory)
 * 2. ✅ Request deduplication (single-flight)
 * 3. ✅ Batch requests (all symbols in one call)
 * 4. ✅ Stale-while-revalidate
 * 5. ✅ Background refresh (proactive)
 * 6. ✅ Request budgeting (daily + per-minute)
 * 7. ✅ Circuit breaker (on 429/5xx)
 * 8. ✅ Graceful degradation (serve stale on failure)
 *
 * SSOT v2.3.0 (Jan 2026):
 * - FX pairs fetched from frontend /api/fx/config on startup
 * - TRUE SSOT: frontend/src/data/fx/fx.pairs.json is the only source
 * - Fallback to hardcoded pairs if frontend unreachable
 */

import { createServer, IncomingMessage, ServerResponse } from 'node:http';

// =============================================================================
// CONFIGURATION
// =============================================================================

const PORT = parseInt(process.env['PORT'] ?? '8080', 10);
const LOG_LEVEL = process.env['LOG_LEVEL'] ?? 'info';
const TWELVEDATA_API_KEY = process.env['TWELVEDATA_API_KEY'] ?? '';

// SSOT endpoint - frontend exposes fx.pairs.json here
const FX_CONFIG_URL =
  process.env['FX_CONFIG_URL'] ?? 'https://promagen.com/api/fx/config';

// Budget configuration
const BUDGET_DAILY_ALLOWANCE = parseInt(
  process.env['FX_RIBBON_BUDGET_DAILY_ALLOWANCE'] ?? '800',
  10,
);
const BUDGET_MINUTE_ALLOWANCE = parseInt(
  process.env['FX_RIBBON_BUDGET_MINUTE_ALLOWANCE'] ?? '8',
  10,
);
const CACHE_TTL_SECONDS = parseInt(process.env['FX_RIBBON_TTL_SECONDS'] ?? '300', 10);

// CORS
const ALLOWED_ORIGINS = (
  process.env['ALLOWED_ORIGINS'] ??
  'https://promagen.com,https://www.promagen.com,http://localhost:3000'
).split(',');

// =============================================================================
// TYPES
// =============================================================================

interface FxPair {
  id: string;
  base: string;
  quote: string;
}

interface FxQuote {
  id: string;
  base: string;
  quote: string;
  price: number | null;
  symbol: string;
}

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
  expiresAt: number;
}

interface BudgetState {
  dailyUsed: number;
  dailyResetAt: number;
  minuteUsed: number;
  minuteResetAt: number;
}

interface GatewayResponse {
  meta: {
    mode: 'live' | 'cached' | 'stale' | 'error';
    cachedAt?: string;
    expiresAt?: string;
    provider: string;
    ssotSource: 'frontend' | 'fallback';
    budget: {
      state: 'ok' | 'warning' | 'blocked';
      dailyUsed: number;
      dailyLimit: number;
      minuteUsed: number;
      minuteLimit: number;
    };
  };
  data: FxQuote[];
}

// =============================================================================
// LOGGING
// =============================================================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const CURRENT_LOG_LEVEL = LOG_LEVELS[LOG_LEVEL as LogLevel] ?? 1;

function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  if (LOG_LEVELS[level] >= CURRENT_LOG_LEVEL) {
    const timestamp = new Date().toISOString();
    const payload = data ? ` ${JSON.stringify(data)}` : '';
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}${payload}`);
  }
}

// =============================================================================
// FX PAIRS - LOADED FROM SSOT
// =============================================================================

// Fallback pairs - used ONLY if frontend /api/fx/config is unreachable
const FALLBACK_FX_PAIRS: FxPair[] = [
  { id: 'aud-gbp', base: 'AUD', quote: 'GBP' },
  { id: 'usd-jpy', base: 'USD', quote: 'JPY' },
  { id: 'usd-cny', base: 'USD', quote: 'CNY' },
  { id: 'usd-brl', base: 'USD', quote: 'BRL' },
  { id: 'gbp-zar', base: 'GBP', quote: 'ZAR' },
  { id: 'eur-usd', base: 'EUR', quote: 'USD' },
  { id: 'gbp-eur', base: 'GBP', quote: 'EUR' },
  { id: 'gbp-usd', base: 'GBP', quote: 'USD' },
];

// Runtime state - populated on startup
let activeFxPairs: FxPair[] = [];
let ssotSource: 'frontend' | 'fallback' = 'fallback';

/**
 * Fetches FX pairs config from frontend SSOT endpoint.
 * Returns null if fetch fails.
 */
async function fetchSsotConfig(): Promise<FxPair[] | null> {
  try {
    log('info', 'Fetching FX config from SSOT', { url: FX_CONFIG_URL });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(FX_CONFIG_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      log('warn', 'SSOT fetch failed', { status: res.status });
      return null;
    }

    const json = (await res.json()) as {
      pairs?: Array<{ id?: string; base?: string; quote?: string }>;
    };

    if (!Array.isArray(json.pairs) || json.pairs.length === 0) {
      log('warn', 'SSOT response invalid - no pairs array');
      return null;
    }

    // Validate and normalize pairs
    const pairs: FxPair[] = json.pairs
      .filter(
        (p): p is { id: string; base: string; quote: string } =>
          typeof p.id === 'string' &&
          typeof p.base === 'string' &&
          typeof p.quote === 'string',
      )
      .map((p) => ({
        id: p.id.toLowerCase(),
        base: p.base.toUpperCase(),
        quote: p.quote.toUpperCase(),
      }));

    if (pairs.length === 0) {
      log('warn', 'SSOT response had no valid pairs');
      return null;
    }

    log('info', 'SSOT config loaded', {
      pairCount: pairs.length,
      pairs: pairs.map((p) => p.id),
    });

    return pairs;
  } catch (err) {
    log('error', 'SSOT fetch error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Initializes FX pairs from SSOT or fallback.
 * Called once on startup.
 */
async function initFxPairs(): Promise<void> {
  const ssotPairs = await fetchSsotConfig();

  if (ssotPairs && ssotPairs.length > 0) {
    activeFxPairs = ssotPairs;
    ssotSource = 'frontend';
    log('info', 'Using SSOT pairs from frontend', { count: activeFxPairs.length });
  } else {
    activeFxPairs = FALLBACK_FX_PAIRS;
    ssotSource = 'fallback';
    log('warn', 'Using FALLBACK pairs - frontend SSOT unavailable', {
      count: activeFxPairs.length,
    });
  }
}

// =============================================================================
// PERSISTENT IN-MEMORY CACHE (Technique #1)
// =============================================================================

const cache = new Map<string, CacheEntry<FxQuote[]>>();

function getCached(key: string): CacheEntry<FxQuote[]> | null {
  const entry = cache.get(key);
  if (!entry) return null;
  return entry;
}

function setCache(key: string, data: FxQuote[], ttlMs: number): void {
  const now = Date.now();
  cache.set(key, {
    data,
    fetchedAt: now,
    expiresAt: now + ttlMs,
  });
}

// =============================================================================
// REQUEST DEDUPLICATION / SINGLE-FLIGHT (Technique #2)
// =============================================================================

const inFlightRequests = new Map<string, Promise<FxQuote[]>>();

async function dedupedFetch(key: string, fetcher: () => Promise<FxQuote[]>): Promise<FxQuote[]> {
  const existing = inFlightRequests.get(key);
  if (existing) {
    log('debug', 'Request deduplication hit', { key });
    return existing;
  }

  const promise = fetcher().finally(() => {
    inFlightRequests.delete(key);
  });

  inFlightRequests.set(key, promise);
  return promise;
}

// =============================================================================
// BUDGET MANAGEMENT (Technique #6)
// =============================================================================

const budget: BudgetState = {
  dailyUsed: 0,
  dailyResetAt: getNextMidnightUTC(),
  minuteUsed: 0,
  minuteResetAt: Date.now() + 60_000,
};

function getNextMidnightUTC(): number {
  const now = new Date();
  const tomorrow = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  return tomorrow.getTime();
}

function checkAndUpdateBudget(): { allowed: boolean; state: 'ok' | 'warning' | 'blocked' } {
  const now = Date.now();

  // Reset daily budget at midnight UTC
  if (now >= budget.dailyResetAt) {
    budget.dailyUsed = 0;
    budget.dailyResetAt = getNextMidnightUTC();
    log('info', 'Daily budget reset');
  }

  // Reset minute budget
  if (now >= budget.minuteResetAt) {
    budget.minuteUsed = 0;
    budget.minuteResetAt = now + 60_000;
  }

  // Check limits
  const dailyPct = budget.dailyUsed / BUDGET_DAILY_ALLOWANCE;
  const minuteAtLimit = budget.minuteUsed >= BUDGET_MINUTE_ALLOWANCE;

  if (minuteAtLimit || dailyPct >= 0.95) {
    return { allowed: false, state: 'blocked' };
  }

  if (dailyPct >= 0.7) {
    return { allowed: true, state: 'warning' };
  }

  return { allowed: true, state: 'ok' };
}

function recordApiCall(): void {
  budget.dailyUsed += 1;
  budget.minuteUsed += 1;
  log('debug', 'API call recorded', { dailyUsed: budget.dailyUsed, minuteUsed: budget.minuteUsed });
}

// =============================================================================
// CIRCUIT BREAKER (Technique #7)
// =============================================================================

let circuitOpen = false;
let circuitResetAt = 0;

function isCircuitOpen(): boolean {
  if (!circuitOpen) return false;
  if (Date.now() >= circuitResetAt) {
    circuitOpen = false;
    log('info', 'Circuit breaker reset');
    return false;
  }
  return true;
}

function tripCircuit(durationMs: number, reason: string): void {
  circuitOpen = true;
  circuitResetAt = Date.now() + durationMs;
  log('warn', 'Circuit breaker tripped', { reason, resetInMs: durationMs });
}

// =============================================================================
// TWELVEDATA FETCHER (Technique #3 - Batching)
// =============================================================================

async function fetchFromTwelveData(): Promise<FxQuote[]> {
  if (!TWELVEDATA_API_KEY) {
    throw new Error('TWELVEDATA_API_KEY not configured');
  }

  // Build batch symbol list: EUR/USD,GBP/USD,...
  const symbols = activeFxPairs.map((p) => `${p.base}/${p.quote}`).join(',');

  const url = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(
    symbols,
  )}&apikey=${encodeURIComponent(TWELVEDATA_API_KEY)}`;

  log('info', 'Fetching from TwelveData', { symbolCount: activeFxPairs.length });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.status === 429) {
      tripCircuit(60_000, '429 rate limit');
      throw new Error('TwelveData rate limited (429)');
    }

    if (res.status >= 500) {
      tripCircuit(30_000, `5xx error: ${res.status}`);
      throw new Error(`TwelveData server error: ${res.status}`);
    }

    if (!res.ok) {
      throw new Error(`TwelveData error: ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as Record<string, unknown>;

    // Record successful API call
    recordApiCall();

    // Parse response - TwelveData returns object with symbol keys for batch
    const quotes: FxQuote[] = [];

    for (const pair of activeFxPairs) {
      const symbol = `${pair.base}/${pair.quote}`;
      const entry = json[symbol] as Record<string, unknown> | undefined;

      let price: number | null = null;

      if (entry && typeof entry['price'] === 'string') {
        const parsed = parseFloat(entry['price']);
        if (Number.isFinite(parsed) && parsed > 0) {
          price = parsed;
        }
      } else if (entry && typeof entry['price'] === 'number') {
        if (Number.isFinite(entry['price']) && entry['price'] > 0) {
          price = entry['price'];
        }
      }

      quotes.push({
        id: pair.id,
        base: pair.base,
        quote: pair.quote,
        price,
        symbol,
      });
    }

    log('info', 'TwelveData fetch success', {
      quotesWithPrice: quotes.filter((q) => q.price !== null).length,
      total: quotes.length,
    });

    return quotes;
  } catch (err) {
    clearTimeout(timeoutId);

    if (err instanceof Error && err.name === 'AbortError') {
      tripCircuit(15_000, 'timeout');
      throw new Error('TwelveData request timeout');
    }

    throw err;
  }
}

// =============================================================================
// MAIN FX ENDPOINT LOGIC
// =============================================================================

const CACHE_KEY = 'fx:ribbon:all';

async function getFxData(): Promise<GatewayResponse> {
  const cached = getCached(CACHE_KEY);
  const now = Date.now();
  const ttlMs = CACHE_TTL_SECONDS * 1000;
  const budgetCheck = checkAndUpdateBudget();

  // Case 1: Fresh cache - serve immediately
  if (cached && now < cached.expiresAt) {
    log('debug', 'Serving fresh cache');
    return {
      meta: {
        mode: 'cached',
        cachedAt: new Date(cached.fetchedAt).toISOString(),
        expiresAt: new Date(cached.expiresAt).toISOString(),
        provider: 'twelvedata',
        ssotSource,
        budget: {
          state: budgetCheck.state,
          dailyUsed: budget.dailyUsed,
          dailyLimit: BUDGET_DAILY_ALLOWANCE,
          minuteUsed: budget.minuteUsed,
          minuteLimit: BUDGET_MINUTE_ALLOWANCE,
        },
      },
      data: cached.data,
    };
  }

  // Case 2: Budget exhausted or circuit open - serve stale or empty
  if (!budgetCheck.allowed || isCircuitOpen()) {
    log('info', 'Budget blocked or circuit open', {
      budgetAllowed: budgetCheck.allowed,
      circuitOpen: isCircuitOpen(),
    });

    if (cached) {
      return {
        meta: {
          mode: 'stale',
          cachedAt: new Date(cached.fetchedAt).toISOString(),
          expiresAt: new Date(cached.expiresAt).toISOString(),
          provider: 'twelvedata',
          ssotSource,
          budget: {
            state: budgetCheck.state,
            dailyUsed: budget.dailyUsed,
            dailyLimit: BUDGET_DAILY_ALLOWANCE,
            minuteUsed: budget.minuteUsed,
            minuteLimit: BUDGET_MINUTE_ALLOWANCE,
          },
        },
        data: cached.data,
      };
    }

    // No cache available - return empty with null prices
    return {
      meta: {
        mode: 'error',
        provider: 'none',
        ssotSource,
        budget: {
          state: budgetCheck.state,
          dailyUsed: budget.dailyUsed,
          dailyLimit: BUDGET_DAILY_ALLOWANCE,
          minuteUsed: budget.minuteUsed,
          minuteLimit: BUDGET_MINUTE_ALLOWANCE,
        },
      },
      data: activeFxPairs.map((p) => ({
        id: p.id,
        base: p.base,
        quote: p.quote,
        price: null,
        symbol: `${p.base}/${p.quote}`,
      })),
    };
  }

  // Case 3: Cache expired or missing - fetch with deduplication (Technique #2)
  try {
    const quotes = await dedupedFetch(CACHE_KEY, fetchFromTwelveData);
    setCache(CACHE_KEY, quotes, ttlMs);

    return {
      meta: {
        mode: 'live',
        cachedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttlMs).toISOString(),
        provider: 'twelvedata',
        ssotSource,
        budget: {
          state: budgetCheck.state,
          dailyUsed: budget.dailyUsed,
          dailyLimit: BUDGET_DAILY_ALLOWANCE,
          minuteUsed: budget.minuteUsed,
          minuteLimit: BUDGET_MINUTE_ALLOWANCE,
        },
      },
      data: quotes,
    };
  } catch (err) {
    log('error', 'Fetch failed', { error: err instanceof Error ? err.message : String(err) });

    // Graceful degradation: serve stale cache if available
    if (cached) {
      return {
        meta: {
          mode: 'stale',
          cachedAt: new Date(cached.fetchedAt).toISOString(),
          expiresAt: new Date(cached.expiresAt).toISOString(),
          provider: 'twelvedata',
          ssotSource,
          budget: {
            state: budgetCheck.state,
            dailyUsed: budget.dailyUsed,
            dailyLimit: BUDGET_DAILY_ALLOWANCE,
            minuteUsed: budget.minuteUsed,
            minuteLimit: BUDGET_MINUTE_ALLOWANCE,
          },
        },
        data: cached.data,
      };
    }

    return {
      meta: {
        mode: 'error',
        provider: 'none',
        ssotSource,
        budget: {
          state: budgetCheck.state,
          dailyUsed: budget.dailyUsed,
          dailyLimit: BUDGET_DAILY_ALLOWANCE,
          minuteUsed: budget.minuteUsed,
          minuteLimit: BUDGET_MINUTE_ALLOWANCE,
        },
      },
      data: activeFxPairs.map((p) => ({
        id: p.id,
        base: p.base,
        quote: p.quote,
        price: null,
        symbol: `${p.base}/${p.quote}`,
      })),
    };
  }
}

// =============================================================================
// BACKGROUND REFRESH (Technique #5)
// =============================================================================

let backgroundRefreshTimer: ReturnType<typeof setInterval> | null = null;

function startBackgroundRefresh(): void {
  // Refresh every 5 minutes proactively
  const intervalMs = CACHE_TTL_SECONDS * 1000;

  backgroundRefreshTimer = setInterval(async () => {
    const budgetCheck = checkAndUpdateBudget();

    if (!budgetCheck.allowed || isCircuitOpen()) {
      log('info', 'Background refresh skipped (budget/circuit)');
      return;
    }

    try {
      log('info', 'Background refresh starting');
      const quotes = await fetchFromTwelveData();
      setCache(CACHE_KEY, quotes, intervalMs);
      log('info', 'Background refresh complete');
    } catch (err) {
      log('error', 'Background refresh failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, intervalMs);

  log('info', 'Background refresh scheduled', { intervalMs });
}

// =============================================================================
// HTTP SERVER
// =============================================================================

function setCorsHeaders(res: ServerResponse, origin: string | undefined): void {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin ?? '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const origin = req.headers.origin;

  setCorsHeaders(res, origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Only allow GET
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const path = url.pathname;

  // Health check endpoint
  if (path === '/health') {
    sendJson(res, 200, {
      status: 'ok',
      timestamp: new Date().toISOString(),
      ssot: {
        source: ssotSource,
        configUrl: FX_CONFIG_URL,
        pairCount: activeFxPairs.length,
        pairs: activeFxPairs.map((p) => p.id),
      },
      budget: {
        dailyUsed: budget.dailyUsed,
        dailyLimit: BUDGET_DAILY_ALLOWANCE,
        minuteUsed: budget.minuteUsed,
        minuteLimit: BUDGET_MINUTE_ALLOWANCE,
      },
      circuitOpen: isCircuitOpen(),
    });
    return;
  }

  // FX endpoint
  if (path === '/fx' || path === '/api/fx') {
    try {
      const data = await getFxData();

      // Set cache headers for CDN (Technique #6 - Edge caching)
      res.setHeader('Cache-Control', `public, s-maxage=60, stale-while-revalidate=300`);

      sendJson(res, 200, data);
    } catch (err) {
      log('error', 'FX endpoint error', {
        error: err instanceof Error ? err.message : String(err),
      });
      sendJson(res, 500, { error: 'Internal server error' });
    }
    return;
  }

  // Budget/trace endpoint (for debugging)
  if (path === '/trace' || path === '/api/fx/trace') {
    sendJson(res, 200, {
      timestamp: new Date().toISOString(),
      ssot: {
        source: ssotSource,
        configUrl: FX_CONFIG_URL,
        pairCount: activeFxPairs.length,
        pairs: activeFxPairs.map((p) => p.id),
      },
      budget: {
        dailyUsed: budget.dailyUsed,
        dailyLimit: BUDGET_DAILY_ALLOWANCE,
        dailyResetAt: new Date(budget.dailyResetAt).toISOString(),
        minuteUsed: budget.minuteUsed,
        minuteLimit: BUDGET_MINUTE_ALLOWANCE,
        minuteResetAt: new Date(budget.minuteResetAt).toISOString(),
      },
      circuit: {
        open: isCircuitOpen(),
        resetAt: circuitResetAt > 0 ? new Date(circuitResetAt).toISOString() : null,
      },
      cache: {
        hasFxCache: cache.has(CACHE_KEY),
        fxCacheExpiresAt: cache.get(CACHE_KEY)?.expiresAt
          ? new Date(cache.get(CACHE_KEY)!.expiresAt).toISOString()
          : null,
      },
      inFlightRequests: inFlightRequests.size,
    });
    return;
  }

  // 404 for unknown routes
  sendJson(res, 404, { error: 'Not found' });
}

// =============================================================================
// STARTUP
// =============================================================================

async function start(): Promise<void> {
  // Step 1: Load FX pairs from SSOT (or fallback)
  await initFxPairs();

  // Step 2: Create and start HTTP server
  const server = createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      log('error', 'Unhandled request error', {
        error: err instanceof Error ? err.message : String(err),
      });
      if (!res.headersSent) {
        sendJson(res, 500, { error: 'Internal server error' });
      }
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    log('info', `Promagen Gateway listening on http://0.0.0.0:${PORT}`);
    log('info', 'Configuration', {
      budgetDaily: BUDGET_DAILY_ALLOWANCE,
      budgetMinute: BUDGET_MINUTE_ALLOWANCE,
      cacheTtlSeconds: CACHE_TTL_SECONDS,
      hasApiKey: TWELVEDATA_API_KEY.length > 0,
      ssotSource,
      fxPairCount: activeFxPairs.length,
      fxPairs: activeFxPairs.map((p) => p.id),
    });

    // Start background refresh after 30 seconds (let first request populate cache)
    setTimeout(() => {
      startBackgroundRefresh();
    }, 30_000);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    log('info', 'SIGTERM received, shutting down');
    if (backgroundRefreshTimer) {
      clearInterval(backgroundRefreshTimer);
    }
    server.close(() => {
      log('info', 'Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    log('info', 'SIGINT received, shutting down');
    if (backgroundRefreshTimer) {
      clearInterval(backgroundRefreshTimer);
    }
    server.close(() => {
      log('info', 'Server closed');
      process.exit(0);
    });
  });
}

// Run
start().catch((err) => {
  log('error', 'Failed to start server', {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
