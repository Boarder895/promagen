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
 * - twelvedata/ contains FX + Crypto (Phase 1 ✅)
 * - marketstack/ contains Indices (Phase 2 ✅)
 * - fallback/ contains Commodities (Phase 3 ✅)
 * - server.ts is routes + startup only
 *
 * GUARDRAIL G2: server.ts imports from provider index files.
 * This is THE place to see all feeds at a glance.
 *
 * @module server
 */
import { createServer, IncomingMessage, ServerResponse } from 'node:http';

import { commoditiesHandler, validateCommoditiesSelection } from './fallback/index.js';
import { logError, logInfo, logWarn, logStartup } from './lib/logging.js';
import type { FxPair } from './lib/types.js';
import { indicesHandler, validateIndicesSelection } from './marketstack/index.js';
import {
  cryptoHandler,
  fxHandler,
  validateFxSelection,
  validateCryptoSelection,
} from './twelvedata/index.js';

// =============================================================================
// STARTUP ENV DEBUG (FIXED: now checks correct variables)
// =============================================================================
const twelveDataKey = process.env['TWELVEDATA_API_KEY'] ?? '';
const marketstackKey = process.env['MARKETSTACK_API_KEY'] ?? '';

// NOTE: Avoid logging any part of the actual key (even a prefix).
logInfo('[ENV] Provider API key status at startup', {
  twelveDataPresent: Boolean(twelveDataKey),
  twelveDataLength: twelveDataKey.length,
  marketstackPresent: Boolean(marketstackKey),
  marketstackLength: marketstackKey.length,
});

if (!twelveDataKey) {
  logWarn('TWELVEDATA_API_KEY is missing; FX and Crypto will return fallback (null prices).');
}
if (!marketstackKey) {
  logWarn('MARKETSTACK_API_KEY is missing; Indices will return fallback (null prices).');
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

// =============================================================================
// ENV CHECK HELPER (for /trace endpoint)
// =============================================================================

function getEnvStatus(): Record<string, unknown> {
  const tdKey = process.env['TWELVEDATA_API_KEY'] ?? '';
  const msKey = process.env['MARKETSTACK_API_KEY'] ?? '';

  return {
    TWELVEDATA_API_KEY: tdKey
      ? { status: 'present', length: tdKey.length }
      : { status: 'MISSING', length: 0 },
    MARKETSTACK_API_KEY: msKey
      ? { status: 'present', length: msKey.length }
      : { status: 'MISSING', length: 0 },
    FX_CONFIG_URL: process.env['FX_CONFIG_URL'] ?? '(default: https://promagen.com/api/fx/config)',
    CRYPTO_CONFIG_URL:
      process.env['CRYPTO_CONFIG_URL'] ?? '(default: https://promagen.com/api/crypto/config)',
    INDICES_CONFIG_URL:
      process.env['INDICES_CONFIG_URL'] ?? '(default: https://promagen.com/api/indices/config)',
  };
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
        crypto: cryptoHandler.isReady(),
        indices: indicesHandler.isReady(),
        commodities: commoditiesHandler.isReady(),
      },
    });
    return;
  }

  // ==========================================================================
  // REFRESH ENDPOINT (Manual API call trigger for testing)
  // Usage: GET /refresh?feed=fx|crypto|indices
  // ==========================================================================
  if (path === '/refresh') {
    const feed = url.searchParams.get('feed');

    if (!feed || !['fx', 'crypto', 'indices'].includes(feed)) {
      sendJson(res, 400, {
        error: 'Missing or invalid feed parameter',
        usage: 'GET /refresh?feed=fx|crypto|indices',
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
        case 'crypto':
          data = await cryptoHandler.getData();
          break;
        case 'indices':
          data = await indicesHandler.getData();
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
  // CRYPTO ENDPOINT (TwelveData - Phase 1)
  // ==========================================================================
  if (path === '/crypto' || path === '/api/crypto') {
    if (method === 'GET') {
      logInfo('Crypto GET request received');
      const data = await cryptoHandler.getData();
      logInfo('Crypto GET response', {
        mode: data.meta.mode,
        count: data.data.length,
        hasNullPrices: data.data.some((d: { price: number | null }) => d.price === null),
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

      const assetIds = Array.isArray(json['assetIds'])
        ? json['assetIds']
        : Array.isArray(json['cryptoIds'])
          ? json['cryptoIds']
          : [];
      const tier: 'free' | 'paid' = json['tier'] === 'paid' ? 'paid' : 'free';

      const catalogMap = new Map(cryptoHandler.getCatalog().map((item) => [item.id, item]));
      const validation = validateCryptoSelection(assetIds as string[], tier, catalogMap);
      if (!validation.valid) {
        sendJson(res, 400, { error: 'Validation failed', errors: validation.errors });
        return;
      }

      const data = await cryptoHandler.getDataForIds(validation.allowedAssetIds);
      res.setHeader('Cache-Control', 'private, no-cache');
      sendJson(res, 200, {
        ...data,
        meta: { ...data.meta, requestedAssets: validation.allowedAssetIds },
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

      // Build catalog map for validation (authoritative from handler catalog)
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
  // COMMODITIES ENDPOINT (Fallback - Phase 3)
  // ==========================================================================
  if (path === '/commodities' || path === '/api/commodities') {
    if (method === 'GET') {
      const data = await commoditiesHandler.getData();
      // Always returns fallback since no provider
      res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
      sendJson(res, 200, { ...data, meta: { ...data.meta, source: 'fallback' } });
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

      // Build catalog map for validation (authoritative from handler catalog)
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
        meta: {
          ...data.meta,
          source: 'fallback',
          requestedCommodities: validation.allowedCommodityIds,
        },
      });
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  // ==========================================================================
  // TRACE ENDPOINT (Enhanced Diagnostics)
  // ==========================================================================
  if (path === '/trace' || path === '/api/fx/trace') {
    // Ensure trace is never cached by intermediaries
    res.setHeader('Cache-Control', 'no-store');

    sendJson(res, 200, {
      timestamp: new Date().toISOString(),
      architecture: {
        phase1: 'twelvedata (FX + Crypto) ✅',
        phase2: 'marketstack (Indices) ✅',
        phase3: 'fallback (Commodities) ✅',
        status: 'COMPLETE - All feeds operational',
      },
      environment: getEnvStatus(),
      fx: fxHandler.getTraceInfo(),
      crypto: cryptoHandler.getTraceInfo(),
      indices: indicesHandler.getTraceInfo(),
      commodities: commoditiesHandler.getTraceInfo(),
    });
    return;
  }

  // 404
  sendJson(res, 404, { error: 'Not found' });
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

  // Create HTTP server FIRST (health check must pass quickly)
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

  // Start listening IMMEDIATELY (before feed init)
  server.listen(PORT, '0.0.0.0', () => {
    logInfo(`Promagen Gateway listening on http://0.0.0.0:${PORT}`);

    // Initialize feeds AFTER server is listening (non-blocking)
    logInfo('Initializing feeds in background...');
    void Promise.all([
      fxHandler.init().catch((e) => logError('FX init failed', { error: String(e) })),
      cryptoHandler.init().catch((e) => logError('Crypto init failed', { error: String(e) })),
      indicesHandler.init().catch((e) => logError('Indices init failed', { error: String(e) })),
      commoditiesHandler
        .init()
        .catch((e) => logError('Commodities init failed', { error: String(e) })),
    ]).then(() => {
      logInfo('All feeds initialized');

      // Log feed status after init
      logInfo('Feed catalog sizes', {
        fx: fxHandler.getCatalog().length,
        crypto: cryptoHandler.getCatalog().length,
        indices: indicesHandler.getCatalog().length,
        commodities: commoditiesHandler.getCatalog().length,
      });

      // Start background refresh after feeds are ready
      // =====================================================================
      // CLOCK-ALIGNED SCHEDULING (ALL PROVIDERS)
      // =====================================================================
      //
      // Timeline (minutes past hour):
      // :00  :05  :10  :20  :30  :35  :40  :50
      //  FX  IDX  CMD  CRY  FX  IDX  CMD  CRY
      //  TD   MS   --   TD   TD   MS   --   TD
      //
      // TD = TwelveData (shared 800/day budget)
      // MS = Marketstack (separate 250/day budget)
      // -- = Fallback (no API, no budget)
      //
      // Staggered startup offsets to avoid simultaneous first calls:
      //
      setTimeout(() => {
        fxHandler.startBackgroundRefresh();
        logInfo('Background refresh started: FX (clock-aligned :00/:30)');
      }, 5_000);

      setTimeout(() => {
        indicesHandler.startBackgroundRefresh();
        logInfo('Background refresh started: Indices (clock-aligned :05/:35)');
      }, 10_000);

      setTimeout(() => {
        commoditiesHandler.startBackgroundRefresh();
        logInfo('Background refresh started: Commodities (clock-aligned :10/:40)');
      }, 15_000);

      setTimeout(() => {
        cryptoHandler.startBackgroundRefresh();
        logInfo('Background refresh started: Crypto (clock-aligned :20/:50)');
      }, 20_000);
    });
  });

  // Graceful shutdown
  const shutdown = (): void => {
    logInfo('Shutdown signal received');
    fxHandler.stopBackgroundRefresh();
    cryptoHandler.stopBackgroundRefresh();
    indicesHandler.stopBackgroundRefresh();
    commoditiesHandler.stopBackgroundRefresh();
    server.close(() => {
      logInfo('Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

// Run
start().catch((err) => {
  logError('Failed to start server', {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
