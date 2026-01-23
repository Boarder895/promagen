/**
 * Promagen Gateway - Shared Types
 * ================================
 * Single source of truth for all gateway type definitions.
 *
 * Security: 10/10
 * - All types are readonly where possible
 * - Discriminated unions for state machines
 * - Branded types for ID validation
 * - No 'any' types anywhere
 *
 * GUARDRAIL G4: Shared interfaces for schedulers and budgets.
 * All provider implementations MUST implement these interfaces.
 *
 * @module lib/types
 */

// =============================================================================
// BRANDED TYPES (Type-safe IDs)
// =============================================================================

/**
 * Branded type pattern for compile-time ID safety.
 * Prevents accidentally passing wrong ID type to functions.
 */
declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

/** FX pair ID (e.g., "eur-usd") */
export type FxPairId = Brand<string, 'FxPairId'>;

/** Commodity ID (e.g., "wti-crude") */
export type CommodityId = Brand<string, 'CommodityId'>;

/** Crypto asset ID (e.g., "btc") */
export type CryptoId = Brand<string, 'CryptoId'>;

/** Exchange ID (e.g., "tse-tokyo") */
export type ExchangeId = Brand<string, 'ExchangeId'>;

/** Marketstack benchmark key (e.g., "nikkei_225") */
export type BenchmarkKey = Brand<string, 'BenchmarkKey'>;

// =============================================================================
// STATE TYPES (Discriminated Unions)
// =============================================================================

/** Provider budget state */
export type BudgetState = 'ok' | 'warning' | 'blocked';

/** Circuit breaker state */
export type CircuitState = 'closed' | 'open' | 'half-open';

/** Data freshness mode */
export type DataMode = 'live' | 'cached' | 'stale' | 'error' | 'fallback';

/** Tick direction for price changes */
export type TickDirection = 'up' | 'down' | 'flat';

/** User tier */
export type UserTier = 'free' | 'paid';

/** SSOT source - indicates where the SSOT configuration was loaded from */
export type SsotSource = 'frontend' | 'fallback' | 'snapshot-fallback';

/** Feed identifier */
export type FeedId = 'fx' | 'commodities' | 'crypto' | 'indices';

/** Provider identifier */
export type ProviderId = 'twelvedata' | 'marketstack' | 'none';

// =============================================================================
// GUARDRAIL G4: SHARED INTERFACES
// =============================================================================

/**
 * GUARDRAIL G4: Shared interface for all feed schedulers.
 * All provider schedulers MUST implement this interface.
 * TypeScript compiler enforces consistency across providers.
 */
export interface FeedScheduler {
  /**
   * Get milliseconds until the next scheduled refresh slot.
   * Used by background refresh to align with clock.
   */
  getMsUntilNextSlot(): number;

  /**
   * Get the next scheduled refresh time.
   * Returns Date object for the next slot.
   */
  getNextSlotTime(): Date;

  /**
   * Check if the current time is within a refresh slot window.
   * A slot is "active" for ~2 minutes around the target time.
   */
  isSlotActive(): boolean;

  /**
   * Get the scheduled slot minutes for this feed.
   * E.g., [0, 30] for FX, [20, 50] for Crypto.
   */
  getSlotMinutes(): readonly number[];
}

/**
 * GUARDRAIL G4: Shared interface for all budget managers.
 * All provider budget managers MUST implement this interface.
 * TypeScript compiler enforces consistency across providers.
 */
export interface BudgetManagerInterface {
  /**
   * Check if budget allows spending credits.
   * @param credits - Number of credits to spend
   * @returns true if spending is allowed
   */
  canSpend(credits: number): boolean;

  /**
   * Spend credits from the budget.
   * @param credits - Number of credits to spend
   */
  spend(credits: number): void;

  /**
   * Get current budget state snapshot.
   * Used for /trace endpoint and diagnostics.
   */
  getState(): BudgetSnapshot;

  /**
   * Get budget state for API responses.
   * Excludes internal details, suitable for client.
   */
  getResponse(): BudgetResponse;

  /**
   * Reset budget counters (for testing only).
   */
  reset(): void;

  /**
   * Get the budget manager ID.
   * E.g., "twelvedata-shared", "marketstack-shared".
   */
  getId(): string;
}

// =============================================================================
// BUDGET TRACKING
// =============================================================================

/** Budget state snapshot */
export interface BudgetSnapshot {
  readonly dailyUsed: number;
  readonly dailyLimit: number;
  readonly dailyResetAt: number;
  readonly minuteUsed: number;
  readonly minuteLimit: number;
  readonly minuteResetAt: number;
  readonly state: BudgetState;
}

/** Budget response in API */
export interface BudgetResponse {
  readonly state: BudgetState;
  readonly dailyUsed: number;
  readonly dailyLimit: number;
  readonly minuteUsed: number;
  readonly minuteLimit: number;
}

// =============================================================================
// CIRCUIT BREAKER
// =============================================================================

/** Circuit breaker state snapshot */
export interface CircuitSnapshot {
  readonly state: CircuitState;
  readonly failureCount: number;
  readonly lastFailureAt: number | null;
  readonly resetAt: number | null;
}

// =============================================================================
// CACHE
// =============================================================================

/** Cache entry with TTL metadata */
export interface CacheEntry<T> {
  readonly data: T;
  readonly fetchedAt: number;
  readonly expiresAt: number;
}

/** Cache statistics */
export interface CacheStats {
  readonly hits: number;
  readonly misses: number;
  readonly size: number;
  readonly oldestEntry: number | null;
  readonly newestEntry: number | null;
}

// =============================================================================
// FX TYPES
// =============================================================================

/** FX pair from SSOT catalog */
export interface FxPair {
  readonly id: string;
  readonly base: string;
  readonly quote: string;
  readonly label?: string;
  readonly precision?: number;
  readonly isDefaultFree?: boolean;
  readonly isDefaultPaid?: boolean;
  readonly demoPrice?: number;
}

/** FX quote from API response */
export interface FxQuote {
  readonly id: string;
  readonly base: string;
  readonly quote: string;
  readonly symbol: string;
  readonly price: number | null;
  readonly change?: number | null;
  readonly percentChange?: number | null;
  readonly tick?: TickDirection;
  readonly timestamp?: number;
}

/** FX selection request (Pro users) */
export interface FxSelectionRequest {
  readonly pairIds: readonly string[];
  readonly tier: UserTier;
}

/** FX selection validation result */
export interface FxSelectionValidation {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly allowedPairIds: readonly string[];
}

// =============================================================================
// COMMODITIES TYPES
// =============================================================================

/** Commodity group */
export type CommodityGroup = 'energy' | 'agriculture' | 'metals';

/** Commodity from SSOT catalog */
export interface CommodityCatalogItem {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
  readonly symbol: string;
  readonly group: CommodityGroup | string;
  readonly quoteCurrency?: string;
  readonly isDefaultFree?: boolean;
  readonly isDefaultPaid?: boolean;
  readonly isActive?: boolean;
  readonly isSelectableInRibbon?: boolean;
  readonly demoPrice?: number;
}

/** Commodity quote from API response */
export interface CommodityQuote {
  readonly id: string;
  readonly symbol: string;
  readonly name: string;
  readonly shortName: string;
  readonly group: string;
  readonly price: number | null;
  readonly change?: number | null;
  readonly percentChange?: number | null;
  readonly tick?: TickDirection;
  readonly quoteCurrency?: string;
  readonly timestamp?: number;
}

/** Commodities selection request (Pro users) */
export interface CommoditiesSelectionRequest {
  readonly commodityIds: readonly string[];
  readonly tier: UserTier;
}

/** Commodities selection validation result */
export interface CommoditiesSelectionValidation {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly allowedCommodityIds: readonly string[];
}

// =============================================================================
// CRYPTO TYPES
// =============================================================================

/** Crypto asset from SSOT catalog */
export interface CryptoCatalogItem {
  readonly id: string;
  readonly symbol: string;
  readonly name: string;
  readonly rankHint?: number;
  readonly isActive?: boolean;
  readonly isSelectableInRibbon?: boolean;
  readonly demoPrice?: number;
}

/** Crypto quote from API response */
export interface CryptoQuote {
  readonly id: string;
  readonly symbol: string;
  readonly name: string;
  readonly price: number | null;
  readonly change?: number | null;
  readonly percentChange?: number | null;
  readonly tick?: TickDirection;
  readonly quoteCurrency: string;
  readonly timestamp?: number;
}

// =============================================================================
// INDICES TYPES
// =============================================================================

/** Index/Exchange from SSOT catalog */
export interface IndexCatalogItem {
  readonly id: string;
  readonly benchmark: string;
  readonly indexName: string;
  readonly city: string;
  readonly country: string;
  readonly tz: string;
}

/** Index quote from API response */
export interface IndexQuote {
  readonly id: string;
  readonly benchmark: string;
  readonly indexName: string;
  readonly price: number | null;
  readonly change: number | null;
  readonly percentChange: number | null;
  readonly tick?: TickDirection;
  readonly asOf: string | null;
}

/** Indices selection request (Pro users) */
export interface IndicesSelectionRequest {
  readonly exchangeIds: readonly string[];
  readonly tier: UserTier;
}

/** Indices selection validation result */
export interface IndicesSelectionValidation {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly allowedExchangeIds: readonly string[];
}

// =============================================================================
// GATEWAY RESPONSE TYPES
// =============================================================================

/** Base metadata for all gateway responses */
export interface BaseResponseMeta {
  readonly mode: DataMode;
  readonly cachedAt?: string;
  readonly expiresAt?: string;
  readonly provider: ProviderId;
  readonly ssotSource: SsotSource;
  /** SSOT version number (from frontend, or 0 for fallback) */
  readonly ssotVersion?: number;
  /** Deterministic SHA-256 hash of the parsed SSOT snapshot */
  readonly ssotHash?: string;
  /** Short fingerprint (first 12 chars of ssotHash) */
  readonly ssotFingerprint?: string;
  /** When the currently active SSOT snapshot was taken */
  readonly ssotSnapshotAt?: string;
  readonly budget: BudgetResponse;
}

/** FX gateway response */
export interface FxGatewayResponse {
  readonly meta: BaseResponseMeta & {
    readonly requestedPairs?: readonly string[];
  };
  readonly data: readonly FxQuote[];
}

/** Commodities gateway response */
export interface CommoditiesGatewayResponse {
  readonly meta: BaseResponseMeta & {
    readonly requestedCommodities?: readonly string[];
  };
  readonly data: readonly CommodityQuote[];
}

/** Crypto gateway response */
export interface CryptoGatewayResponse {
  readonly meta: BaseResponseMeta & {
    readonly requestedCrypto?: readonly string[];
  };
  readonly data: readonly CryptoQuote[];
}

/** Indices gateway response */
export interface IndicesGatewayResponse {
  readonly meta: BaseResponseMeta & {
    readonly requestedExchanges?: readonly string[];
  };
  readonly data: readonly IndexQuote[];
}

/** Union of all gateway responses */
export type GatewayResponse =
  | FxGatewayResponse
  | CommoditiesGatewayResponse
  | CryptoGatewayResponse
  | IndicesGatewayResponse;

// =============================================================================
// FEED HANDLER CONFIGURATION
// =============================================================================

/**
 * Configuration for creating a feed handler.
 * All required fields must be provided; optional fields have sensible defaults.
 */
export interface FeedConfig<TCatalog, TQuote> {
  /** Unique feed identifier */
  readonly id: FeedId;

  /** Provider for this feed */
  readonly provider: ProviderId;

  /** Cache TTL in seconds */
  readonly ttlSeconds: number;

  /** Daily API budget limit */
  readonly budgetDaily: number;

  /** Per-minute API budget limit */
  readonly budgetMinute: number;

  /** URL to fetch SSOT catalog from frontend */
  readonly ssotUrl: string;

  /** Cache key prefix */
  readonly cacheKey: string;

  /** Parse catalog response from SSOT */
  readonly parseCatalog: (data: unknown) => TCatalog[];

  /**
   * Get default item IDs.
   *
   * IMPORTANT: Defaults must come from the frontend SSOT payload (or flags
   * contained within it) and MUST preserve order.
   */
  readonly getDefaults: (catalog: TCatalog[], ssotPayload: unknown) => string[];

  /** Parse API response to quotes */
  readonly parseQuotes: (data: unknown, catalog: TCatalog[]) => TQuote[];

  /** Fetch quotes from provider API */
  readonly fetchQuotes: (symbols: string[], apiKey: string) => Promise<unknown>;

  /** Generate fallback data when no provider */
  readonly getFallback: (catalog: TCatalog[]) => TQuote[];

  /** Get item by ID from catalog */
  readonly getById: (catalog: TCatalog[], id: string) => TCatalog | undefined;

  /** Get symbol from catalog item for API call */
  readonly getSymbol: (item: TCatalog) => string;

  /**
   * Clock-aligned scheduler (optional).
   * If provided, background refresh uses clock-aligned slots instead of 90% TTL.
   */
  readonly scheduler?: FeedScheduler;
}

// =============================================================================
// FEED HANDLER INTERFACE
// =============================================================================

/** Feed trace information for /trace endpoint */
export interface FeedTraceInfo {
  readonly feedId: FeedId;
  readonly ssotSource: SsotSource;
  readonly ssotUrl: string;
  readonly ssotVersion?: number;
  readonly ssotHash?: string;
  readonly ssotFingerprint?: string;
  readonly ssotSnapshotAt?: string;
  readonly catalogCount: number;
  readonly defaultCount: number;
  readonly defaults: readonly string[];
  readonly budget: BudgetSnapshot;
  readonly circuit: CircuitSnapshot;
  readonly cache: {
    readonly hasData: boolean;
    readonly expiresAt: string | null;
  };
  readonly inFlightCount: number;
  /** Next scheduled refresh (clock-aligned) */
  readonly nextRefreshAt?: string;
  /** Slot minutes for this feed */
  readonly slotMinutes?: readonly number[];
}

/** Complete feed handler interface */
export interface FeedHandler<TCatalog, TQuote> {
  /** Initialize handler: fetch SSOT catalog */
  init(): Promise<void>;

  /** Start background refresh loop */
  startBackgroundRefresh(): void;

  /** Stop background refresh loop */
  stopBackgroundRefresh(): void;

  /** Get data for default items */
  getData(): Promise<{
    meta: BaseResponseMeta;
    data: TQuote[];
  }>;

  /** Get data for specific items (Pro users) */
  getDataForIds(ids: string[]): Promise<{
    meta: BaseResponseMeta;
    data: TQuote[];
  }>;

  /** Get catalog items */
  getCatalog(): readonly TCatalog[];

  /** Get default item IDs */
  getDefaults(): readonly string[];

  /** Get trace info for diagnostics */
  getTraceInfo(): FeedTraceInfo;

  /** Get budget state */
  getBudgetState(): BudgetSnapshot;

  /** Check if feed is ready */
  isReady(): boolean;
}

// =============================================================================
// HTTP TYPES
// =============================================================================

/** Rate limit info */
export interface RateLimitInfo {
  readonly remaining: number;
  readonly resetAt: number;
  readonly blocked: boolean;
}

/** CORS configuration */
export interface CorsConfig {
  readonly allowedOrigins: readonly string[];
  readonly allowedMethods: readonly string[];
  readonly allowedHeaders: readonly string[];
  readonly maxAge: number;
}

// =============================================================================
// VALIDATION UTILITIES
// =============================================================================

/** Type guard for checking if value is non-null */
export function isNonNull<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/** Type guard for checking if value is a string */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/** Type guard for checking if value is a number */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

/** Type guard for checking if value is an array */
export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

/** Type guard for checking if value is a plain object */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Selection limits per feed type */
export const SELECTION_LIMITS = {
  fx: { min: 6, max: 16 },
  commodities: { required: 7, energyCount: 2, agricultureCount: 3, metalsCount: 2 },
  crypto: { min: 6, max: 12 },
  indices: { min: 6, max: 16 },
} as const;

/** Default TTL values in seconds */
export const DEFAULT_TTL = {
  fx: 1800, // 30 minutes
  commodities: 1800,
  crypto: 1800,
  indices: 7200, // 2 hours
} as const;

/** Default budget limits */
export const DEFAULT_BUDGET = {
  twelvedata: { daily: 800, minute: 8 },
  marketstack: { daily: 250, minute: 3 },
} as const;

/**
 * Clock-aligned slot schedules per TwelveData feed.
 * FX and Crypto NEVER overlap to prevent rate limit violations.
 */
export const TWELVEDATA_SLOTS = {
  fx: [0, 30] as const, // Minutes :00 and :30
  crypto: [20, 50] as const, // Minutes :20 and :50
} as const;
