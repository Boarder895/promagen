import { readFileSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';

import { fetchFmpFxQuotes } from './adapters/fmp.fx';
import { fetchTwelveDataFxQuotes } from './adapters/twelvedata.fx';
import { fetchDemoFxQuotes } from './adapters/demo.fx';

/**
 * Promagen API Gateway — FX entry point
 *
 * Reads the API Brain configuration from config/api/*
 * and exposes typed helpers used by the frontend and workers.
 *
 * This file:
 * - Has no provider-specific HTTP details
 * - Has no hard-coded provider URLs
 * - Drives everything from providers.registry + roles.policies
 */

// -----------------------------------------------------------------------------
// Configuration types
// -----------------------------------------------------------------------------

interface ProviderAuthConfig {
  type: 'none' | 'query_param';
  /**
   * Name of the query parameter that carries the API key, if type="query_param".
   */
  key_name?: string;
  /**
   * Name of the environment variable that holds the secret.
   */
  env?: string;
}

interface ProviderEndpointConfig {
  fx_quotes?: string;
}

export interface ProviderConfig {
  id: string;
  display_name: string;
  description?: string;
  capabilities: string[];
  endpoints: ProviderEndpointConfig;
  adapters: {
    fx_quotes?: string;
  };
  auth: ProviderAuthConfig;
  metadata?: Record<string, unknown>;
}

interface ProvidersRegistryFile {
  $schema?: string;
  version: number;
  providers: Record<string, ProviderConfig>;
}

export type QualityDegradationMode = 'fallback' | 'cached' | string;

export interface RolePolicy {
  role: string;
  primary_provider: string;
  backup_providers?: string[];
  cache_ttl_seconds?: number;
  quality_degradation_mode?: QualityDegradationMode;
}

interface RolesPoliciesFile {
  $schema?: string;
  version: number;
  roles: Record<string, RolePolicy>;
}

// -----------------------------------------------------------------------------
// FX result types
// -----------------------------------------------------------------------------

export type FxMode = 'live' | 'fallback' | 'demo' | 'cached';

export interface FxRibbonQuote {
  /**
   * Pair identifier, e.g. "GBPUSD".
   */
  pair: string;
  /**
   * Base currency code, e.g. "GBP".
   */
  base: string;
  /**
   * Quote currency code, e.g. "USD".
   */
  quote: string;
  /**
   * Mid or last traded price for display.
   */
  price: number;
  /**
   * Optional bid / ask for richer widgets.
   */
  bid?: number;
  ask?: number;
  /**
   * Absolute 24h change in price.
   */
  change_24h?: number;
  /**
   * Percentage 24h change in price.
   */
  change_24h_pct?: number;
}

export interface FxGatewayResult {
  /**
   * Logical role, e.g. "fx_ribbon" or "fx_mini_widget".
   */
  role: string;
  /**
   * The provider the role *prefers* (from roles.policies.json).
   */
  primaryProvider: string;
  /**
   * The provider that actually served the data (could be backup or demo).
   */
  sourceProvider: string;
  /**
   * Quality mode of this response.
   */
  mode: FxMode;
  /**
   * ISO timestamp of when these prices were assembled.
   */
  asOf: string;
  /**
   * Normalised FX quotes for the current role.
   */
  pairs: FxRibbonQuote[];
}

export interface FxGatewayOptions {
  /**
   * Force the gateway to use a specific provider instead of the role's chain.
   * Example: "demo" for smoke-testing without hitting live APIs.
   */
  forceProviderId?: string;
  /**
   * When forcing a provider, optionally skip reading/writing cache.
   */
  bypassCache?: boolean;
  /**
   * Optional time source (handy for tests).
   */
  now?: () => Date;
}

// -----------------------------------------------------------------------------
// Caching
// -----------------------------------------------------------------------------

interface CacheEntry {
  value: FxGatewayResult;
  storedAt: number;
  ttlMs: number;
}

const cache = new Map<string, CacheEntry>();

// -----------------------------------------------------------------------------
// Adapters
// -----------------------------------------------------------------------------

// Adapters are responsible for calling each provider's HTTP API
// and returning a normalised FX ribbon quote list.
export type FxAdapter = (options: {
  provider: ProviderConfig;
  role: string;
}) => Promise<FxRibbonQuote[]>;

const FX_ADAPTERS: Record<string, FxAdapter> = {
  fmp: fetchFmpFxQuotes,
  twelvedata: fetchTwelveDataFxQuotes,
  demo: fetchDemoFxQuotes,
};

// -----------------------------------------------------------------------------
// Config loading — robust against Next.js/webpack bundling
// -----------------------------------------------------------------------------

function findRepoRoot(startDir: string): string {
  let dir = startDir;

  for (let index = 0; index < 10; index += 1) {
    const base = basename(dir).toLowerCase();

    if (base === 'promagen') {
      return dir;
    }

    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }

    dir = parent;
  }

  // Fallback – shouldn't normally happen, but keeps things predictable.
  return startDir;
}

function loadJsonFile<T>(relativePathFromRepoRoot: string): T {
  const repoRoot = findRepoRoot(process.cwd());
  const absolute = resolve(repoRoot, relativePathFromRepoRoot);
  const raw = readFileSync(absolute, 'utf8');
  return JSON.parse(raw) as T;
}

let providersRegistryCache: ProvidersRegistryFile | null = null;
let rolesPoliciesCache: RolesPoliciesFile | null = null;

function getProvidersRegistry(): ProvidersRegistryFile {
  if (!providersRegistryCache) {
    const raw = loadJsonFile<ProvidersRegistryFile>('config/api/providers.registry.json');

    if (typeof raw.version !== 'number') {
      throw new Error('providers.registry.json is missing numeric "version".');
    }

    if (!raw.providers || typeof raw.providers !== 'object') {
      throw new Error('providers.registry.json is missing "providers" object.');
    }

    providersRegistryCache = raw;
  }

  return providersRegistryCache;
}

function getRolesPolicies(): RolesPoliciesFile {
  if (!rolesPoliciesCache) {
    const raw = loadJsonFile<RolesPoliciesFile>('config/api/roles.policies.json');

    if (typeof raw.version !== 'number') {
      throw new Error('roles.policies.json is missing numeric "version".');
    }

    if (!raw.roles || typeof raw.roles !== 'object') {
      throw new Error('roles.policies.json is missing "roles" object.');
    }

    rolesPoliciesCache = raw;
  }

  return rolesPoliciesCache;
}

function getProviderConfig(providerId: string): ProviderConfig {
  const registry = getProvidersRegistry();
  const provider = registry.providers[providerId];

  if (!provider) {
    throw new Error(`Unknown provider id "${providerId}" in providers.registry.json.`);
  }

  return provider;
}

function getRolePolicy(role: string): RolePolicy {
  const policies = getRolesPolicies();
  const policy = policies.roles[role];

  if (!policy) {
    throw new Error(`Unknown role "${role}" in roles.policies.json.`);
  }

  return policy;
}

function pickProviderChain(
  role: string,
  forceProviderId?: string,
): {
  rolePolicy: RolePolicy;
  chain: string[];
} {
  const rolePolicy = getRolePolicy(role);

  if (forceProviderId) {
    return {
      rolePolicy,
      chain: [forceProviderId],
    };
  }

  const chain = [rolePolicy.primary_provider, ...(rolePolicy.backup_providers ?? [])];

  return { rolePolicy, chain };
}

function getCacheKey(role: string, options?: FxGatewayOptions): string {
  const forced = options?.forceProviderId ?? '';
  return `${role}::${forced}`;
}

function getFromCache(
  role: string,
  options?: FxGatewayOptions,
  nowFn: () => Date = () => new Date(),
): FxGatewayResult | null {
  if (options?.bypassCache) {
    return null;
  }

  const key = getCacheKey(role, options);
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  const now = nowFn().getTime();

  if (now - entry.storedAt > entry.ttlMs) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

function storeInCache(
  result: FxGatewayResult,
  rolePolicy: RolePolicy,
  options?: FxGatewayOptions,
  nowFn: () => Date = () => new Date(),
): void {
  if (options?.bypassCache) {
    return;
  }

  const cacheTtlSeconds = rolePolicy.cache_ttl_seconds ?? 0;
  if (cacheTtlSeconds <= 0) {
    return;
  }

  const key = getCacheKey(result.role, options);
  const ttlMs = cacheTtlSeconds * 1000;
  const storedAt = nowFn().getTime();

  cache.set(key, { value: result, storedAt, ttlMs });
}

// -----------------------------------------------------------------------------
// Core engine
// -----------------------------------------------------------------------------

async function getFxForRole(role: string, options?: FxGatewayOptions): Promise<FxGatewayResult> {
  const nowFn = options?.now ?? (() => new Date());
  const { rolePolicy, chain } = pickProviderChain(role, options?.forceProviderId);

  const cached = getFromCache(role, options, nowFn);
  if (cached) {
    return {
      ...cached,
      mode: 'cached',
    };
  }

  const registry = getProvidersRegistry();
  const asOf = nowFn().toISOString();

  let lastError: unknown;

  for (const providerId of chain) {
    const providerConfig = getProviderConfig(providerId);

    if (!providerConfig.capabilities.includes(role)) {
      continue;
    }

    const adapter = FX_ADAPTERS[providerId];
    if (!adapter) {
      continue;
    }

    try {
      const pairs = await adapter({ provider: providerConfig, role });

      const mode: FxMode =
        providerId === 'demo'
          ? 'demo'
          : rolePolicy.quality_degradation_mode === 'fallback'
          ? 'fallback'
          : 'live';

      const result: FxGatewayResult = {
        role,
        primaryProvider: rolePolicy.primary_provider,
        sourceProvider: providerId,
        mode,
        asOf,
        pairs,
      };

      storeInCache(result, rolePolicy, options, nowFn);

      return result;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`[gateway] Failed to fetch FX quotes from provider "${providerId}"`, error);
      lastError = error;
    }
  }

  // If we reach here, every provider in the chain has failed.
  // As a safety net, try the demo provider even if not listed.
  try {
    const registryDemo = registry.providers.demo;
    const providerConfig = registryDemo ?? getProviderConfig('demo');

    const demoAdapter = FX_ADAPTERS.demo;
    if (!demoAdapter) {
      throw new Error('[gateway] Demo FX adapter is not registered.');
    }

    const pairs = await demoAdapter({ provider: providerConfig, role });

    const result: FxGatewayResult = {
      role,
      primaryProvider: rolePolicy.primary_provider,
      sourceProvider: 'demo',
      mode: 'demo',
      asOf,
      pairs,
    };

    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[gateway] Demo FX provider also failed', error);
    throw lastError ?? error;
  }
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Homepage 5-chip FX belt.
 */
export async function getFxRibbon(options?: FxGatewayOptions): Promise<FxGatewayResult> {
  return getFxForRole('fx_ribbon', options);
}

/**
 * Studio / prompt-builder mini FX widget.
 */
export async function getFxMiniWidget(options?: FxGatewayOptions): Promise<FxGatewayResult> {
  return getFxForRole('fx_mini_widget', options);
}
