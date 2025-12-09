// C:\Users\Proma\Projects\promagen\gateway\index.ts

import fs from 'node:fs';
import path from 'node:path';

import { getFromCache, saveToCache } from './lib/cache';
import { applyQuotaAllowance } from './lib/quota';
import { withResilience } from './lib/resilience';
import { logInfo, logError } from './lib/logging';

import demoFxAdapter from './adapters/demo.fx';
import fmpFxAdapter from './adapters/fmp.fx';
import twelvedataFxAdapter from './adapters/twelvedata.fx';

// -----------------------------------------------------
// TYPES
// -----------------------------------------------------

export interface FxRibbonQuote {
  base: string;
  quote: string;
  /**
   * Canonical pair label, e.g. "GBP/USD".
   * Optional for legacy demo data which may not provide it.
   */
  pair?: string;
  price: number;
  /**
   * Absolute 24-hour change, if the provider exposes it.
   */
  change_24h?: number;
  /**
   * 24-hour percentage change, if the provider exposes it.
   */
  change_24h_pct?: number;
  /**
   * Provider-specific symbol, e.g. "GBPUSD" or "GBP/USD".
   */
  providerSymbol?: string;
}

export interface FxRibbonResult {
  role: string;
  primaryProvider: string;
  sourceProvider: string;
  mode: 'live' | 'fallback' | 'demo' | 'cached';
  asOf: string;
  pairs: FxRibbonQuote[];
}

/**
 * Request contract used by live FX adapters (FMP, TwelveData, etc.).
 */
export interface FxAdapterRequest {
  /**
   * Canonical pairs for the ribbon in "BASE/QUOTE" form.
   */
  pairs: string[];

  /**
   * Fully-qualified base URL for the provider endpoint, e.g.
   * "https://financialmodelingprep.com/api/v3/fx" or
   * "https://api.twelvedata.com/price".
   */
  url: string;

  /**
   * Provider API key, if required.
   */
  apiKey?: string | null;

  /**
   * Optional timeout in milliseconds. Defaults to 3000ms.
   */
  timeoutMs?: number;
}

type FxAdapter = (request: FxAdapterRequest) => Promise<FxRibbonQuote[]>;

// -----------------------------------------------------
// CONFIG LOADING
// -----------------------------------------------------

function resolveConfigPath(relativeFromRoot: string): string {
  const cwd = process.cwd();

  // First try: relative to current working directory
  const direct = path.join(cwd, relativeFromRoot);
  if (fs.existsSync(direct)) {
    return direct;
  }

  // Second try: one level up (repo root when cwd is /frontend)
  const parent = path.join(cwd, '..', relativeFromRoot);
  if (fs.existsSync(parent)) {
    return parent;
  }

  throw new Error(
    `Gateway config not found. Tried:\n` + `  ${direct}\n` + `  ${parent}\n` + `CWD was: ${cwd}`,
  );
}

function loadJson(relativeFromRoot: string): any {
  const fullPath = resolveConfigPath(relativeFromRoot);
  const raw = fs.readFileSync(fullPath, 'utf8');
  return JSON.parse(raw);
}

// These are deliberately typed as any – the structure is owned by the
// JSON docs and validated separately.
const providersRegistry: any = loadJson('config/api/providers.registry.json');
const rolesPolicies: any = loadJson('config/api/roles.policies.json');

// -----------------------------------------------------
// ADAPTER MAP
// -----------------------------------------------------

const FX_ADAPTERS: Record<string, FxAdapter> = {
  fmp_fx_v1: fmpFxAdapter,
  twelvedata_fx_v1: twelvedataFxAdapter,
};

// -----------------------------------------------------
// PUBLIC API
// -----------------------------------------------------

export async function getFxRibbon(opts?: { forceProviderId?: string }): Promise<FxRibbonResult> {
  const roleName = 'fx_ribbon';
  const role = resolveRole(roleName);

  const cacheKey = 'fx_ribbon';
  const ttl = role.cache_ttl_seconds ?? 30;

  // -----------------------------------------
  // TEST MODE OVERRIDE (force demo)
  // -----------------------------------------
  if (opts?.forceProviderId) {
    const demoPairs = await runDemoAdapter();

    return {
      role: roleName,
      primaryProvider: role.primary_provider,
      sourceProvider: opts.forceProviderId,
      mode: 'demo',
      asOf: new Date().toISOString(),
      pairs: demoPairs,
    };
  }

  // -----------------------------------------
  // 1. CHECK CACHE
  // -----------------------------------------
  const cached = getFromCache<FxRibbonResult>(cacheKey);
  if (cached) {
    logInfo('FX Ribbon: Serving from cache');
    return {
      role: roleName,
      primaryProvider: role.primary_provider,
      sourceProvider: cached.sourceProvider,
      mode: 'cached',
      asOf: cached.asOf,
      pairs: cached.pairs,
    };
  }

  // -----------------------------------------
  // 2. BUILD PROVIDER CHAIN
  // -----------------------------------------
  const chain: string[] = [role.primary_provider, ...(role.backup_providers ?? [])].filter(Boolean);

  if (chain.length === 0) {
    logError('FX Ribbon: No providers configured for role fx_ribbon – falling back to DEMO');
    const pairs = await runDemoAdapter();
    const fallback: FxRibbonResult = {
      role: roleName,
      primaryProvider: 'demo',
      sourceProvider: 'demo',
      mode: 'demo',
      asOf: new Date().toISOString(),
      pairs,
    };
    saveToCache(cacheKey, fallback, ttl);
    return fallback;
  }

  // Canonical pair list for live providers – derived from the demo adapter so
  // ribbon order stays consistent between demo and live.
  const ribbonPairs = await getRibbonPairsFromDemo();

  // -----------------------------------------
  // 3. TRY PROVIDERS IN ORDER
  // -----------------------------------------
  for (const providerId of chain) {
    try {
      // Demo provider is handled explicitly – it does not use live HTTP.
      if (providerId === 'demo') {
        const pairs = await runDemoAdapter();

        const result: FxRibbonResult = {
          role: roleName,
          primaryProvider: role.primary_provider,
          sourceProvider: providerId,
          mode: 'demo',
          asOf: new Date().toISOString(),
          pairs,
        };

        saveToCache(cacheKey, result, ttl);
        return result;
      }

      const providerConfig = getProviderConfig(providerId);

      const adapterName = providerConfig.adapters?.fx_quotes;
      const adapter = FX_ADAPTERS[adapterName as string];
      if (!adapter) {
        throw new Error(
          `Missing FX adapter for provider '${providerId}' – expected '${adapterName}'`,
        );
      }

      const mode: FxRibbonResult['mode'] =
        providerId === role.primary_provider ? 'live' : 'fallback';

      logInfo(`FX Ribbon: Trying provider '${providerId}' in mode '${mode}'`);

      // Respect quota (currently logs / no-op based on config).
      applyQuotaAllowance(providerConfig);

      const request: FxAdapterRequest = {
        pairs: ribbonPairs,
        url: providerConfig.base_url,
        apiKey: resolveApiKey(providerConfig),
        timeoutMs: providerConfig.timeout_ms ?? 3000,
      };

      const pairs = await withResilience(async () => adapter(request));

      const result: FxRibbonResult = {
        role: roleName,
        primaryProvider: role.primary_provider,
        sourceProvider: providerId,
        mode,
        asOf: new Date().toISOString(),
        pairs,
      };

      saveToCache(cacheKey, result, ttl);
      return result;
    } catch (err: any) {
      logError(`FX Ribbon: Provider '${providerId}' failed`, err?.message || err);
      // Try the next provider in the chain
      continue;
    }
  }

  // -----------------------------------------
  // 4. ALL FAILED → FALLBACK TO DEMO
  // -----------------------------------------
  logError('FX Ribbon: ALL providers failed → Using DEMO');

  const pairs = await runDemoAdapter();

  const fallback: FxRibbonResult = {
    role: roleName,
    primaryProvider: role.primary_provider,
    sourceProvider: 'demo',
    mode: 'demo',
    asOf: new Date().toISOString(),
    pairs,
  };

  saveToCache(cacheKey, fallback, ttl);
  return fallback;
}

// -----------------------------------------------------
// INTERNAL HELPERS
// -----------------------------------------------------

function getProviderConfig(providerId: string): any {
  const providers: any[] = Array.isArray(providersRegistry?.providers)
    ? providersRegistry.providers
    : [];

  const found = providers.find((p) => p.id === providerId);
  if (!found) {
    throw new Error(`Unknown provider: ${providerId}`);
  }
  return found;
}

function resolveRole(roleName: string): any {
  const roles: any[] = Array.isArray(rolesPolicies?.roles) ? rolesPolicies.roles : [];
  const found = roles.find((r) => r.role === roleName);
  if (!found) {
    throw new Error(`Unknown role: ${roleName}`);
  }
  return found;
}

/**
 * Pull the API key for a provider from process.env based on the provider's
 * auth configuration. If the provider does not need a key or it is missing,
 * this returns null. The adapter is responsible for deciding how to behave.
 */
function resolveApiKey(providerConfig: any): string | null {
  const auth = providerConfig?.auth;
  if (!auth || typeof auth !== 'object') {
    return null;
  }

  const envVarName: unknown =
    (auth as any).env ?? (auth as any).env_var ?? (auth as any).env_var_name;

  if (typeof envVarName !== 'string' || envVarName.trim().length === 0) {
    return null;
  }

  const value = process.env[envVarName];
  if (!value || value.trim().length === 0) {
    logError(
      `FX Ribbon: Missing API key in env '${envVarName}' for provider '${providerConfig.id}'`,
    );
    return null;
  }

  return value;
}

// Cache the canonical ribbon pair list (e.g. ["GBP/USD", ...]) so we only
// have to derive it from demo data once per process.
let cachedRibbonPairs: string[] | null = null;

async function getRibbonPairsFromDemo(): Promise<string[]> {
  if (cachedRibbonPairs && cachedRibbonPairs.length > 0) {
    return cachedRibbonPairs;
  }

  const demoPairs = await runDemoAdapter();

  const pairs = demoPairs
    .map((pair) => {
      if (typeof pair.pair === 'string' && pair.pair.trim().length > 0) {
        return pair.pair.toUpperCase();
      }

      const base = typeof pair.base === 'string' ? pair.base.trim().toUpperCase() : '';
      const quote = typeof pair.quote === 'string' ? pair.quote.trim().toUpperCase() : '';

      if (base && quote) {
        return `${base}/${quote}`;
      }

      return null;
    })
    .filter((p): p is string => !!p);

  cachedRibbonPairs = pairs;
  return pairs;
}

// DEMO ADAPTER HELPER

async function runDemoAdapter(): Promise<FxRibbonQuote[]> {
  // demoFxAdapter returns the canonical ribbon pairs with mock prices.
  return demoFxAdapter();
}
