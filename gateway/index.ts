import { readFileSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';

import { fetchFmpFxQuotes } from './adapters/fmp.fx';
import { fetchTwelveDataFxQuotes } from './adapters/twelvedata.fx';
import { fetchDemoFxQuotes } from './adapters/demo.fx';

/**
 * Promagen API Gateway — FX entry point
 *
 * Reads API Brain config from config/api/* and exposes a small, stable
 * TypeScript surface:
 *
 *   - getFxRibbon      → homepage 5-chip FX belt
 *   - getFxMiniWidget  → studio / prompt-builder mini FX widget
 *
 * This file:
 * - Knows about providers, roles and caching.
 * - Does *not* know HTTP details (that lives in the adapters).
 * - Is safe to import from both frontend and workers.
 */

// -----------------------------------------------------------------------------
// Configuration types
// -----------------------------------------------------------------------------

interface ProviderAuthConfig {
  /**
   * How auth is supplied to the provider.
   * For FX we only care about "none" and "query_param".
   */
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
  /**
   * Fully qualified FX quotes endpoint or a logical local:// URL for demo.
   */
  fx_quotes?: string;
}

/**
 * One provider definition from providers.registry.json.
 */
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

/**
 * How a role should degrade when live quality is not available.
 *
 * "fallback" → try backups, then demo if all else fails.
 * "cached"   → prefer cached data when upstream is flaky.
 * string     → forward-compatible custom modes.
 */
export type QualityDegradationMode = 'fallback' | 'cached' | string;

/**
 * Role policy row from roles.policies.json.
 */
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

/**
 * Quality mode of the FX data.
 */
export type FxMode = 'live' | 'fallback' | 'demo' | 'cached';

/**
 * Internal FX quote shape used by the gateway and adapters.
 *
 * This is intentionally fairly rich – the API route normalises this to the
 * simpler DTO used by the frontend.
 */
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
   * Mid / last price for the pair.
   */
  price: number;
  /**
   * Optional bid / ask, if the provider offers them.
   */
  bid?: number;
  ask?: number;
  /**
   * Absolute 24h price change.
   */
  change_24h?: number;
  /**
   * Percentage 24h price change.
   */
  change_24h_pct?: number;
}

/**
 * Normalised FX gateway result.
 *
 * All upstream providers (live, backup, demo, cached) are squashed into this.
 */
export interface FxGatewayResult {
  /**
   * Logical role, e.g. "fx_ribbon" or "fx_mini_widget".
   */
  role: string;
  /**
   * Provider the role *prefers* (from roles.policies.json).
   */
  primaryProvider: string;
  /**
   * Provider that actually served this response.
   */
  sourceProvider: string;
  /**
   * Quality mode of the data.
   */
  mode: FxMode;
  /**
   * ISO timestamp when this snapshot was assembled.
   */
  asOf: string;
  /**
   * FX pairs making up the ribbon / widget.
   */
  pairs: FxRibbonQuote[];
}

/**
 * Options for the gateway functions.
 */
export interface FxGatewayOptions {
  /**
   * Force a particular provider id, bypassing role primary/backup ordering.
   * Very handy in tests.
   */
  forceProviderId?: string;
  /**
   * Skip the in-memory cache and always hit upstream providers.
   */
  bypassCache?: boolean;
  /**
   * Optional time source (useful in tests).
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

/**
 * Contract every FX adapter must implement.
 *
 * The adapter:
 * - Receives the provider config + logical role.
 * - Returns a normalised list of FX quotes.
 */
export type FxAdapter = (options: {
  provider: ProviderConfig;
  role: string;
}) => Promise<FxRibbonQuote[]>;

/**
 * Registry of known FX adapters keyed by provider id.
 *
 * If you add a new FX provider to providers.registry.json you wire it here.
 */
const FX_ADAPTERS: Record<string, FxAdapter> = {
  fmp: fetchFmpFxQuotes,
  twelvedata: fetchTwelveDataFxQuotes,
  demo: fetchDemoFxQuotes,
};

// -----------------------------------------------------------------------------
// Config loading — robust against Next.js / bundlers
// -----------------------------------------------------------------------------

/**
 * Walk up from the current working directory until we find the "promagen"
 * repo root. This keeps things working whether we run from /frontend,
 * /gateway or the monorepo root.
 */
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
  const absolutePath = resolve(repoRoot, relativePathFromRepoRoot);
  const raw = readFileSync(absolutePath, 'utf8');
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

  // Try cache first (unless explicitly bypassed).
  const cached = getFromCache(role, options, nowFn);
  if (cached) {
    return {
      ...cached,
      mode: 'cached',
    };
  }

  const asOf = nowFn().toISOString();
  const registry = getProvidersRegistry();
  let lastError: unknown;

  // Walk the provider chain: primary → backups.
  for (const providerId of chain) {
    const providerConfig = registry.providers[providerId] ?? getProviderConfig(providerId);
    const adapter = FX_ADAPTERS[providerId];

    if (!adapter) {
      // No adapter registered for this provider; skip.
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

  // If we reach here, every provider in the role chain has failed.
  // As a last resort, try the demo provider even if it wasn't in the chain.
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
