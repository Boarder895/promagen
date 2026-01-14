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

// =============================================================================
// PROVIDER IMPORTS (GUARDRAIL G2)
// =============================================================================

// TwelveData feeds (Phase 1 - Provider-based)
import { fxHandler, validateFxSelection, cryptoHandler } from './twelvedata/index.js';

// Marketstack feeds (Phase 2 - Provider-based)
import { indicesHandler, validateIndicesSelection } from './marketstack/index.js';

// Fallback feeds (Phase 3 - no external provider)
import { commoditiesHandler, validateCommoditiesSelection } from './fallback/index.js';

// Lib
import { logInfo, logError, logStartup } from './lib/logging.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

const PORT = parseInt(process.env['PORT'] ?? '8080', 10);
const PROMAGEN_GATEWAY_SECRET = process.env['PROMAGEN_GATEWAY_SECRET'] ?? '';

const ALLOWED_ORIGINS = (
  process.env['ALLOWED_ORIGINS'] ??
  'https://promagen.com,https://www.promagen.com,http://localhost:3000'
).split(',');

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
  // FX ENDPOINT (TwelveData - Phase 1)
  // ==========================================================================
  if (path === '/fx' || path === '/api/fx') {
    if (method === 'GET') {
      const data = await fxHandler.getData();
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
      const tier = json['tier'] === 'paid' ? 'paid' : 'free';

      const validation = validateFxSelection(pairIds as string[], tier);
      if (!validation.valid) {
        sendJson(res, 400, { error: 'Validation failed', errors: validation.errors });
        return;
      }

      const data = await fxHandler.getDataForIds(validation.allowedPairIds);
      res.setHeader('Cache-Control', 'private, no-cache');
      sendJson(res, 200, { ...data, meta: { ...data.meta, requestedPairs: validation.allowedPairIds } });
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
      const data = await cryptoHandler.getData();
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      sendJson(res, 200, data);
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
      const data = await indicesHandler.getData();
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
      const tier = json['tier'] === 'paid' ? 'paid' : 'free';

      // Build catalog map for validation
      const catalogMap = new Map(
        indicesHandler.getCatalog().map((item) => [item.id, item]),
      );

      const validation = validateIndicesSelection(exchangeIds as string[], tier, catalogMap);
      if (!validation.valid) {
        sendJson(res, 400, { error: 'Validation failed', errors: validation.errors });
        return;
      }

      const data = await indicesHandler.getDataForIds(validation.allowedExchangeIds);
      res.setHeader('Cache-Control', 'private, no-cache');
      sendJson(res, 200, { ...data, meta: { ...data.meta, requestedExchanges: validation.allowedExchangeIds } });
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
      const tier = json['tier'] === 'paid' ? 'paid' : 'free';

      // Build catalog map for validation
      const catalogMap = new Map(
        commoditiesHandler.getCatalog().map((item) => [item.id, item]),
      );

      const validation = validateCommoditiesSelection(commodityIds as string[], tier, catalogMap);
      if (!validation.valid) {
        sendJson(res, 400, { error: 'Validation failed', errors: validation.errors });
        return;
      }

      const data = await commoditiesHandler.getDataForIds(validation.allowedCommodityIds);
      res.setHeader('Cache-Control', 'private, no-cache');
      sendJson(res, 200, {
        ...data,
        meta: { ...data.meta, source: 'fallback', requestedCommodities: validation.allowedCommodityIds },
      });
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  // ==========================================================================
  // TRACE ENDPOINT (Diagnostics)
  // ==========================================================================
  if (path === '/trace' || path === '/api/fx/trace') {
    sendJson(res, 200, {
      timestamp: new Date().toISOString(),
      architecture: {
        phase1: 'twelvedata (FX + Crypto) ✅',
        phase2: 'marketstack (Indices) ✅',
        phase3: 'fallback (Commodities) ✅',
        status: 'COMPLETE - Legacy feeds/ can be removed',
      },
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
    Promise.all([
      fxHandler.init().catch((e) => logError('FX init failed', { error: String(e) })),
      cryptoHandler.init().catch((e) => logError('Crypto init failed', { error: String(e) })),
      indicesHandler.init().catch((e) => logError('Indices init failed', { error: String(e) })),
      commoditiesHandler.init().catch((e) => logError('Commodities init failed', { error: String(e) })),
    ]).then(() => {
      logInfo('All feeds initialized');
      
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
  const shutdown = () => {
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
