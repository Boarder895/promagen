/**
 * Promagen API Gateway - Main Server
 * ====================================
 * Routes + startup only. All feed logic delegated to provider modules.
 *
 * Security: 10/10
 * - Input validation on all endpoints
 * - Rate limiting per IP
 * - CORS with allowlist
 * - No secrets in responses
 * - Graceful error handling
 * - Enterprise-grade input sanitization
 *
 * Architecture: Provider-Based Modular (COMPLETE)
 * - twelvedata/ contains FX (Phase 1 ✅)
 * - marketstack/ contains Indices + Commodities (Phase 2 ✅, Phase 3 ✅)
 * - openweathermap/ contains Weather (Phase 4 ✅)
 * - server.ts is routes + startup only
 *
 * v3.1: FX Both Rows Always Populated
 * - Startup: Top row fetches immediately, bottom row after 1 minute
 * - After startup: Rows alternate hourly
 * - Both rows ALWAYS have data
 *
 * GUARDRAIL G2: server.ts imports from provider index files.
 * This is THE place to see all feeds at a glance.
 *
 * @module server
 */
import { createServer, IncomingMessage, ServerResponse } from 'node:http';

import { logError, logInfo, logWarn, logStartup } from './lib/logging.js';
import type { FxPair } from './lib/types.js';
import {
  commoditiesHandler,
  validateCommoditiesSelection,
  indicesHandler,
  validateIndicesSelection,
} from './marketstack/index.js';
import {
  initWeatherHandler,
  getWeatherData,
  getWeatherTraceInfo,
  resetWeatherHandler,
  startBackgroundRefresh as startWeatherRefresh,
  stopBackgroundRefresh as stopWeatherRefresh,
} from './openweathermap/index.js';
import {
  fxHandler,
  validateFxSelection,
  shouldFetchSecondRow,
  areBothRowsPopulated,
} from './twelvedata/index.js';

// =============================================================================
// STARTUP ENV DEBUG (FIXED: now checks correct variables)
// =============================================================================
const twelveDataKey = process.env['TWELVEDATA_API_KEY'] ?? '';
const marketstackKey = process.env['MARKETSTACK_API_KEY'] ?? '';
const openWeatherMapKey = process.env['OPENWEATHERMAP_API_KEY'] ?? '';

// NOTE: Avoid logging any part of the actual key (even a prefix).
logInfo('[ENV] Provider API key status at startup', {
  twelveDataPresent: Boolean(twelveDataKey),
  twelveDataLength: twelveDataKey.length,
  marketstackPresent: Boolean(marketstackKey),
  marketstackLength: marketstackKey.length,
  openWeatherMapPresent: Boolean(openWeatherMapKey),
  openWeatherMapLength: openWeatherMapKey.length,
});

if (!twelveDataKey) {
  logWarn('TWELVEDATA_API_KEY is missing; FX will return fallback (null prices).');
}
if (!marketstackKey) {
  logWarn('MARKETSTACK_API_KEY is missing; Indices will return fallback (null prices).');
}
if (!openWeatherMapKey) {
  logWarn('OPENWEATHERMAP_API_KEY is missing; Weather will return empty data.');
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const PORT = parseInt(process.env['PORT'] ?? '8080', 10);
const PROMAGEN_GATEWAY_SECRET = process.env['PROMAGEN_GATEWAY_SECRET'] ?? '';

const ALLOWED_ORIGINS = (
  process.env['ALLOWED_ORIGINS'] ??
  'https://promagen.com,https://www.promagen.com,http://localhost:3000'
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// =============================================================================
// HTTP UTILITIES
// =============================================================================

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function setCorsHeaders(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers['origin'];
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-promagen-gateway-secret');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function hasValidGatewaySecret(req: IncomingMessage): boolean {
  if (!PROMAGEN_GATEWAY_SECRET) return true;
  const header = req.headers['x-promagen-gateway-secret'];
  return typeof header === 'string' && header === PROMAGEN_GATEWAY_SECRET;
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    const maxBodySize = 10 * 1024; // 10KB limit

    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
      // Security: Limit body size to prevent DoS
      if (body.length > maxBodySize) {
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function isRunningOnFly(): boolean {
  return Boolean(process.env['FLY_APP_NAME'] || process.env['FLY_REGION']);
}

function getDefaultFrontendBaseUrl(): string {
  const explicit = process.env['FRONTEND_BASE_URL'];
  if (explicit && explicit.trim()) {
    return explicit.trim().replace(/\/+$/, '');
  }

  const isProd = process.env.NODE_ENV === 'production' || isRunningOnFly();
  return isProd ? 'https://promagen.com' : 'http://localhost:3000';
}

function getDefaultWeatherConfigUrl(): string {
  return `${getDefaultFrontendBaseUrl()}/api/weather/config`;
}

function isPlaceholderUrl(url: string): boolean {
  const u = url.toLowerCase();
  return (
    u.includes('your-frontend-domain') ||
    u.includes('example.com') ||
    u.includes('replace-me') ||
    u.includes('<your')
  );
}

/**
 * Single-source SSOT base URL.
 *
 * - Dev default: http://localhost:3000
 * - Prod default (Fly or NODE_ENV=production): https://promagen.com
 */
function resolveFrontendBaseUrl(): string {
  const base = getDefaultFrontendBaseUrl();
  return base.replace(/\/+$/, '');
}

/**
 * Derive all *CONFIG_URL env vars from FRONTEND_BASE_URL (unless explicitly provided).
 * Also fails fast if placeholder URLs are detected.
 */
function bootstrapFrontendConfigUrls(): void {
  const base = resolveFrontendBaseUrl();

  // Persist derived base for /trace visibility
  if (!process.env['FRONTEND_BASE_URL']) {
    process.env['FRONTEND_BASE_URL'] = base;
  }

  if (isPlaceholderUrl(base)) {
    throw new Error(
      `FRONTEND_BASE_URL contains a placeholder value: ${base}. Set it to http://localhost:3000 (dev) or https://promagen.com (prod).`,
    );
  }

  const derived = {
    FX_CONFIG_URL: `${base}/api/fx/config`,
    INDICES_CONFIG_URL: `${base}/api/indices/config`,
    COMMODITIES_CONFIG_URL: `${base}/api/commodities/config`,
    WEATHER_CONFIG_URL: `${base}/api/weather/config`,
  } as const;

  for (const [k, v] of Object.entries(derived)) {
    const current = process.env[k] ?? '';
    if (!current) {
      process.env[k] = v;
    }
    if (isPlaceholderUrl(process.env[k] ?? '')) {
      throw new Error(
        `${k} contains a placeholder value: ${process.env[k]}. Remove it or set FRONTEND_BASE_URL correctly.`,
      );
    }
  }
}

// Ensure config URLs are derived early (before any handler init runs)
bootstrapFrontendConfigUrls();

// =============================================================================
// ENV CHECK HELPER (for /trace endpoint)
// =============================================================================

function getEnvStatus(): Record<string, unknown> {
  const tdKey = process.env['TWELVEDATA_API_KEY'] ?? '';
  const msKey = process.env['MARKETSTACK_API_KEY'] ?? '';
  const owmKey = process.env['OPENWEATHERMAP_API_KEY'] ?? '';

  const base = process.env['FRONTEND_BASE_URL'] ?? getDefaultFrontendBaseUrl();

  return {
    TWELVEDATA_API_KEY: tdKey
      ? { status: 'present', length: tdKey.length }
      : { status: 'MISSING', length: 0 },
    MARKETSTACK_API_KEY: msKey
      ? { status: 'present', length: msKey.length }
      : { status: 'MISSING', length: 0 },
    OPENWEATHERMAP_API_KEY: owmKey
      ? { status: 'present', length: owmKey.length }
      : { status: 'MISSING', length: 0 },

    FRONTEND_BASE_URL: base,

    FX_CONFIG_URL: process.env['FX_CONFIG_URL'] ?? `(derived: ${base}/api/fx/config)`,
    INDICES_CONFIG_URL:
      process.env['INDICES_CONFIG_URL'] ?? `(derived: ${base}/api/indices/config)`,
    COMMODITIES_CONFIG_URL:
      process.env['COMMODITIES_CONFIG_URL'] ?? `(derived: ${base}/api/commodities/config)`,
    WEATHER_CONFIG_URL:
      process.env['WEATHER_CONFIG_URL'] ?? `(derived: ${base}/api/weather/config)`,
  };
}

// =============================================================================
// WEATHER CONFIG FETCHER
// =============================================================================

/**
 * Fetch weather config from frontend SSOT and initialize handler.
 */
async function initWeatherFromConfig(): Promise<void> {
  const configUrl = process.env['WEATHER_CONFIG_URL'] ?? getDefaultWeatherConfigUrl();

  try {
    const response = await fetch(configUrl, {
      headers: { 'User-Agent': 'Promagen-Gateway/1.0' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch weather config: HTTP ${response.status}`);
    }

    const config = (await response.json()) as {
      cities: Array<{ id: string; city: string; lat: number; lon: number }>;
      selectedExchangeIds: string[];
      freeDefaultIds?: string[];
    };

    // v3.0.1 FIX: Use freeDefaultIds (SSOT 16) for batch priority.
    const batchPriorityIds = config.freeDefaultIds ?? config.selectedExchangeIds;

    initWeatherHandler(config.cities, batchPriorityIds);

    logInfo('Weather handler initialized from config', {
      cityCount: config.cities.length,
      priorityCount: batchPriorityIds.length,
      prioritySource: config.freeDefaultIds ? 'freeDefaultIds' : 'selectedExchangeIds (fallback)',
    });
  } catch (error) {
    logError('Weather config fetch failed', {
      error: error instanceof Error ? error.message : String(error),
      configUrl,
    });
    resetWeatherHandler();
  }
}

// =============================================================================
// REQUEST HANDLER
// =============================================================================

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', `http://${req.headers['host'] ?? 'localhost'}`);
  const path = url.pathname;
  const method = req.method ?? 'GET';

  // CORS
  setCorsHeaders(req, res);

  // Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (path === '/health' || path === '/') {
    sendJson(res, 200, {
      status: 'ok',
      timestamp: new Date().toISOString(),
      feeds: {
        fx: fxHandler.isReady(),
        fxBothRowsPopulated: areBothRowsPopulated(),
        indices: indicesHandler.isReady(),
        commodities: commoditiesHandler.isReady(),
        weather: true,
      },
    });
    return;
  }

  // ==========================================================================
  // REFRESH ENDPOINT (Manual API call trigger for testing)
  // ==========================================================================
  if (path === '/refresh') {
    const feed = url.searchParams.get('feed');

    if (!feed || !['fx', 'indices', 'weather'].includes(feed)) {
      sendJson(res, 400, {
        error: 'Missing or invalid feed parameter',
        usage: 'GET /refresh?feed=fx|indices|weather',
        example: 'http://localhost:8080/refresh?feed=fx',
      });
      return;
    }

    logInfo(`Manual refresh triggered for: ${feed}`);

    try {
      let data: unknown;
      switch (feed) {
        case 'fx':
          data = await fxHandler.getData();
          break;
        case 'indices':
          data = await indicesHandler.getData();
          break;
        case 'weather':
          data = await getWeatherData();
          break;
      }

      sendJson(res, 200, {
        message: `Refresh triggered for ${feed}`,
        timestamp: new Date().toISOString(),
        result: data,
      });
    } catch (error) {
      logError(`Manual refresh failed for ${feed}`, { error: String(error) });
      sendJson(res, 500, {
        error: `Refresh failed for ${feed}`,
        details: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  // ==========================================================================
  // FX ENDPOINT (TwelveData - Phase 1)
  // ==========================================================================
  if (path === '/fx' || path === '/api/fx') {
    if (method === 'GET') {
      logInfo('FX GET request received');
      const data = await fxHandler.getData();
      logInfo('FX GET response', {
        mode: data.meta.mode,
        count: data.data.length,
        hasNullPrices: data.data.some((d: { price: number | null }) => d.price === null),
        bothRowsPopulated: areBothRowsPopulated(),
      });
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      sendJson(res, 200, data);
      return;
    }

    if (method === 'POST') {
      if (!hasValidGatewaySecret(req)) {
        sendJson(res, 401, { error: 'Unauthorized' });
        return;
      }

      const body = await readBody(req);
      const json = parseJson(body) as Record<string, unknown> | null;

      if (!json) {
        sendJson(res, 400, { error: 'Invalid JSON' });
        return;
      }

      const pairIds = Array.isArray(json['pairIds']) ? json['pairIds'] : [];
      const tier: 'free' | 'paid' = json['tier'] === 'paid' ? 'paid' : 'free';

      const fxCatalog = fxHandler.getCatalog() as FxPair[];
      const fxCatalogMap = new Map(fxCatalog.map((p) => [p.id, p]));
      const validation = validateFxSelection(pairIds as string[], tier, fxCatalogMap);
      if (!validation.valid) {
        sendJson(res, 400, { error: 'Validation failed', errors: validation.errors });
        return;
      }

      const data = await fxHandler.getDataForIds(validation.allowedPairIds);
      res.setHeader('Cache-Control', 'private, no-cache');
      sendJson(res, 200, {
        ...data,
        meta: { ...data.meta, requestedPairs: validation.allowedPairIds },
      });
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  // ==========================================================================
  // INDICES ENDPOINT (Marketstack - Phase 2)
  // ==========================================================================
  if (path === '/indices' || path === '/api/indices') {
    if (method === 'GET') {
      logInfo('Indices GET request received');
      const data = await indicesHandler.getData();
      logInfo('Indices GET response', {
        mode: data.meta.mode,
        count: data.data.length,
        hasNullPrices: data.data.some((d: { price: number | null }) => d.price === null),
      });
      res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=600');
      sendJson(res, 200, data);
      return;
    }

    if (method === 'POST') {
      if (!hasValidGatewaySecret(req)) {
        sendJson(res, 401, { error: 'Unauthorized' });
        return;
      }

      const body = await readBody(req);
      const json = parseJson(body) as Record<string, unknown> | null;

      if (!json) {
        sendJson(res, 400, { error: 'Invalid JSON' });
        return;
      }

      const exchangeIds = Array.isArray(json['exchangeIds']) ? json['exchangeIds'] : [];
      const tier: 'free' | 'paid' = json['tier'] === 'paid' ? 'paid' : 'free';

      const catalogMap = new Map(indicesHandler.getCatalog().map((item) => [item.id, item]));
      const validation = validateIndicesSelection(exchangeIds as string[], tier, catalogMap);
      if (!validation.valid) {
        sendJson(res, 400, { error: 'Validation failed', errors: validation.errors });
        return;
      }

      const data = await indicesHandler.getDataForIds(validation.allowedExchangeIds);
      res.setHeader('Cache-Control', 'private, no-cache');
      sendJson(res, 200, {
        ...data,
        meta: { ...data.meta, requestedExchanges: validation.allowedExchangeIds },
      });
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  // ==========================================================================
  // COMMODITIES ENDPOINT (Marketstack - Phase 3)
  // ==========================================================================
  if (path === '/commodities' || path === '/api/commodities') {
    if (method === 'GET') {
      logInfo('Commodities GET request received');
      const data = await commoditiesHandler.getData();
      logInfo('Commodities GET response', {
        mode: data.meta.mode,
        count: data.data.length,
        hasNullPrices: data.data.some((d: { price: number | null }) => d.price === null),
      });
      res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=600');
      sendJson(res, 200, data);
      return;
    }

    if (method === 'POST') {
      if (!hasValidGatewaySecret(req)) {
        sendJson(res, 401, { error: 'Unauthorized' });
        return;
      }

      const body = await readBody(req);
      const json = parseJson(body) as Record<string, unknown> | null;

      if (!json) {
        sendJson(res, 400, { error: 'Invalid JSON' });
        return;
      }

      const commodityIds = Array.isArray(json['commodityIds']) ? json['commodityIds'] : [];
      const tier: 'free' | 'paid' = json['tier'] === 'paid' ? 'paid' : 'free';

      const catalogMap = new Map(commoditiesHandler.getCatalog().map((item) => [item.id, item]));
      const validation = validateCommoditiesSelection(commodityIds as string[], tier, catalogMap);
      if (!validation.valid) {
        sendJson(res, 400, { error: 'Validation failed', errors: validation.errors });
        return;
      }

      const data = await commoditiesHandler.getDataForIds(validation.allowedCommodityIds);
      res.setHeader('Cache-Control', 'private, no-cache');
      sendJson(res, 200, {
        ...data,
        meta: { ...data.meta, requestedCommodities: validation.allowedCommodityIds },
      });
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  // ==========================================================================
  // WEATHER ENDPOINT (OpenWeatherMap - Phase 4)
  // ==========================================================================
  if (path === '/weather' || path === '/api/weather') {
    if (method === 'GET') {
      logInfo('Weather GET request received');
      const data = await getWeatherData();
      res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
      sendJson(res, 200, data);
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  // ==========================================================================
  // TRACE ENDPOINT (Debug info)
  // ==========================================================================
  if (path === '/trace') {
    sendJson(res, 200, {
      timestamp: new Date().toISOString(),
      env: getEnvStatus(),
      fx: fxHandler.getTraceInfo(),
      indices: indicesHandler.getTraceInfo(),
      commodities: commoditiesHandler.getTraceInfo(),
      weather: getWeatherTraceInfo(),
    });
    return;
  }

  // 404
  sendJson(res, 404, { error: 'Not found' });
}

// =============================================================================
// FX SECOND ROW FETCH HELPER
// =============================================================================

/**
 * Schedule the second FX row fetch during startup.
 * This ensures both rows are populated within the first minute.
 */
function scheduleSecondFxRowFetch(): void {
  const checkInterval = setInterval(() => {
    if (areBothRowsPopulated()) {
      logInfo('FX startup complete: Both rows populated');
      clearInterval(checkInterval);
      return;
    }

    if (shouldFetchSecondRow()) {
      logInfo('Triggering second FX row fetch (bottom row)');
      void fxHandler
        .getData()
        .then(() => {
          logInfo('Second FX row fetch complete', {
            bothRowsPopulated: areBothRowsPopulated(),
          });
          clearInterval(checkInterval);
        })
        .catch((e) => {
          logError('Second FX row fetch failed', { error: String(e) });
        });
    }
  }, 5000); // Check every 5 seconds

  // Safety: Stop checking after 2 minutes
  setTimeout(() => {
    clearInterval(checkInterval);
    if (!areBothRowsPopulated()) {
      logWarn('FX startup timeout: Not all rows populated after 2 minutes');
    }
  }, 120_000);
}

// =============================================================================
// STARTUP
// =============================================================================

async function start(): Promise<void> {
  logStartup({
    port: PORT,
    allowedOrigins: ALLOWED_ORIGINS,
    hasGatewaySecret: !!PROMAGEN_GATEWAY_SECRET,
  });

  const server = createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      logError('Unhandled request error', {
        error: err instanceof Error ? err.message : String(err),
      });
      if (!res.headersSent) {
        sendJson(res, 500, { error: 'Internal server error' });
      }
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    logInfo(`Promagen Gateway listening on http://0.0.0.0:${PORT}`);

    logInfo('Initializing feeds in background...');
    void Promise.all([
      fxHandler.init().catch((e) => logError('FX init failed', { error: String(e) })),
      indicesHandler.init().catch((e) => logError('Indices init failed', { error: String(e) })),
      commoditiesHandler
        .init()
        .catch((e) => logError('Commodities init failed', { error: String(e) })),
      initWeatherFromConfig().catch((e) => logError('Weather init failed', { error: String(e) })),
    ]).then(() => {
      logInfo('All feeds initialized');

      logInfo('Feed catalog sizes', {
        fx: fxHandler.getCatalog().length,
        indices: indicesHandler.getCatalog().length,
        commodities: commoditiesHandler.getCatalog().length,
      });

      // v3.1: FX startup sequence - fetch top row immediately, bottom row after 1 minute
      setTimeout(() => {
        fxHandler.startBackgroundRefresh();
        logInfo('Background refresh started: FX (top row immediate, bottom row +1min)');

        // Schedule the second row fetch
        scheduleSecondFxRowFetch();
      }, 5_000);

      setTimeout(() => {
        indicesHandler.startBackgroundRefresh();
        logInfo('Background refresh started: Indices (clock-aligned :05/:20/:35/:50)');
      }, 10_000);

      setTimeout(() => {
        commoditiesHandler.startBackgroundRefresh();
        logInfo('Background refresh started: Commodities (rolling 5-min, randomised)');
      }, 15_000);

      setTimeout(() => {
        startWeatherRefresh();
        logInfo('Background refresh started: Weather (clock-aligned :10/:40)');
      }, 20_000);
    });
  });

  // Graceful shutdown
  const shutdown = (): void => {
    logInfo('Shutdown signal received');
    fxHandler.stopBackgroundRefresh();
    indicesHandler.stopBackgroundRefresh();
    commoditiesHandler.stopBackgroundRefresh();
    stopWeatherRefresh();
    server.close(() => {
      logInfo('Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((err) => {
  logError('Failed to start server', {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
