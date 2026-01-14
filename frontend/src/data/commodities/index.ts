// src/data/commodities/index.ts

import commoditiesCatalogJson from './commodities.catalog.json';
import {
  commoditiesCatalogSchema,
  type CommoditiesCatalog,
  type Commodity,
} from './commodities.schema';
import countryCommodityMapJson from './country-commodities.map.json';
import type { CountryCommodityMapEntry } from './country-commodities.map';
import commodityExchangeMapJson from './exchange-commodities.map.json';
import exchangesCatalogJson from '../exchanges/exchanges.catalog.json';

export type CommodityTier = 'free' | 'paid';

export interface CountryCommodityChips {
  country: string;
  energy: string[];
  agriculture: string[];
  metals: string[];
}

export interface CountryHeadlineCommodities {
  country: string;
  energy: Commodity[];
  agriculture: Commodity[];
  metals: Commodity[];
}

/**
 * Commodity metadata catalogue.
 *
 * This is the single source of truth for all commodities that appear in Promagen:
 *  - homepage commodities belt
 *  - prompt-builder presets
 *  - any mini widgets
 *
 * It comes from a JSON file that is validated at build time using a Zod schema.
 */
export const commoditiesCatalog: CommoditiesCatalog =
  commoditiesCatalogSchema.parse(commoditiesCatalogJson);

const commodityById = new Map<string, Commodity>();

commoditiesCatalog.forEach((item: Commodity) => {
  commodityById.set(item.id, item);
});

/**
 * Exchange commodity mapping types.
 *
 * This describes which exchanges a given commodity can be shown on.
 * The JSON is validated by a separate schema test.
 */
export interface ExchangeCommodityMapping {
  commodityId: string;
  primaryExchangeId: string;
  secondaryExchangeIds: string[];
  extraExchangeIds: string[];
}

/**
 * Normalised mapping of commodity → exchanges.
 */
const commodityExchangeMap = commodityExchangeMapJson as ExchangeCommodityMapping[];

const exchangeMapByCommodityId: Map<string, ExchangeCommodityMapping> = new Map(
  commodityExchangeMap.map((row) => [row.commodityId, row]),
);

/**
 * Shape of contextual information that can influence how we rank venues.
 */
export interface CommodityRoutingContext {
  tier: CommodityTier;

  /**
   * Optional IANA time-zone such as "Europe/London".
   * Optional – if missing we will fall back to userRegionHint.
   */
  userTimeZone?: string;

  /**
   * Broad region hint such as "uk", "eu", "us", "latam", "apac", etc.
   * Free-form but treated case-insensitively.
   */
  userRegionHint?: string;

  /**
   * Optional "now" to use for routing decisions.
   * Useful for tests; defaults to new Date() at call time.
   */
  now?: Date;

  /**
   * Optional map of average latency (in milliseconds) per exchange id.
   * Used only for paid tier to break ties between otherwise equivalent venues.
   */
  latencyByExchangeId?: Record<string, number>;
}

/**
 * Coarse-grained session state for an exchange at a point in time.
 */
export type MarketSessionState = 'open' | 'closed' | 'preopen' | 'holiday' | 'unknown';

export interface ExchangeMarketStatus {
  exchangeId: string;
  sessionState: MarketSessionState;
}

/**
 * Function shape expected from the market-hours layer.
 * The implementation lives elsewhere; we only depend on this contract.
 */
export type GetExchangeMarketStatus = (
  exchangeId: string,
  at: Date,
) => ExchangeMarketStatus | undefined;

/**
 * Returned by the routing helpers.
 */
export interface CommodityExchangeSelection {
  commodityId: string;
  exchangeId: string;
  isPrimary: boolean;
}

/**
 * Utility: normalise a country display name into a simple key for matching.
 */
function normaliseCountryName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Look up the commodity chips configuration for a country.
 *
 * This is used as a building block for:
 *  - homepage commodities belt
 *  - prompt-builder chips ("show me key commodities for 🇧🇷 Brazil")
 */
export function getCountryCommodityChips(country: string): CountryCommodityChips | undefined {
  const wanted = normaliseCountryName(country);

  const rows = countryCommodityMapJson as CountryCommodityMapEntry[];

  // First try exact label match (emoji + name)
  const exact = rows.find((row) => row.country === country);
  if (exact) {
    return {
      country: exact.country,
      energy: exact.energy,
      agriculture: exact.agriculture,
      metals: exact.metals,
    };
  }

  // Fallback: normalised country name match
  const fallback = rows.find((row) => normaliseCountryName(row.country) === wanted);
  if (!fallback) {
    return undefined;
  }

  return {
    country: fallback.country,
    energy: fallback.energy,
    agriculture: fallback.agriculture,
    metals: fallback.metals,
  };
}

/**
 * Look up the headline commodities for a country, resolved to full Commodity objects.
 *
 * This is the high-level shape that the homepage and prompt-builder will usually consume.
 */
export function getCountryHeadlineCommodities(
  country: string,
): CountryHeadlineCommodities | undefined {
  const chips = getCountryCommodityChips(country);

  if (!chips) {
    return undefined;
  }

  const resolve = (ids: string[]): Commodity[] =>
    ids.map((id) => commodityById.get(id)).filter((item): item is Commodity => Boolean(item));

  return {
    country: chips.country,
    energy: resolve(chips.energy),
    agriculture: resolve(chips.agriculture),
    metals: resolve(chips.metals),
  };
}

/**
 * Look up the "importance" score for a commodity.
 *
 * Primary source is the priority field on the commodity itself.
 * If that ever goes missing for a given commodity, we fall back to
 * treating it as "least important".
 */
export function getCommodityImportance(commodityId: string): number | undefined {
  const commodity = commodityById.get(commodityId);
  return commodity?.priority;
}

/**
 * Return the default commodity set for a given subscription tier.
 *
 * SSOT rules:
 * - Membership is defined by isDefaultFree / isDefaultPaid flags in commodities.catalog.json.
 * - Order is preserved from commodities.catalog.json (NO sorting).
 * - We only include active commodities.
 */
export function getDefaultCommoditiesForTier(tier: CommodityTier): Commodity[] {
  const isDefault = (c: Commodity): boolean =>
    tier === 'free' ? c.isDefaultFree === true : c.isDefaultPaid === true;

  return commoditiesCatalog.filter((c) => c.isActive === true && isDefault(c));
}

/**
 * Return the default commodity ids for a given subscription tier.
 */
export function getDefaultCommoditiesForTierIds(tier: CommodityTier): string[] {
  return getDefaultCommoditiesForTier(tier).map((commodity: Commodity) => commodity.id);
}

/**
 * Return full Commodity objects (not just ids) for the headline
 * 3× energy, 3× agriculture, 3× metals for a given country.
 *
 * Perfect for:
 *  - country tooltips on the ribbon
 *  - a future "country view" page
 *  - prompt-builder chips ("show me key commodities for 🇧🇷 Brazil")
 */
export function getCountryHeadlineCommoditiesForTier(
  country: string,
  tier: CommodityTier,
): CountryHeadlineCommodities | undefined {
  const headline = getCountryHeadlineCommodities(country);

  if (!headline) {
    return undefined;
  }

  const defaultIds = new Set(getDefaultCommoditiesForTierIds(tier));

  const filterByDefaults = (items: Commodity[]): Commodity[] =>
    items.filter((item) => defaultIds.has(item.id));

  return {
    country: headline.country,
    energy: filterByDefaults(headline.energy),
    agriculture: filterByDefaults(headline.agriculture),
    metals: filterByDefaults(headline.metals),
  };
}

/**
 * Helper for API-budget logic: pick the top N commodities, by tier,
 * that should receive "real-time" treatment. Everything else can be
 * safely downshifted to slower refresh or delayed data if needed.
 */
export function pickTopCommoditiesForRealTimeQuotes(
  tier: CommodityTier,
  limit: number,
): Commodity[] {
  if (limit <= 0) {
    return [];
  }

  const defaults = getDefaultCommoditiesForTier(tier);
  return defaults.slice(0, limit);
}

// ─────────────────────────────────────────────────────────────────────────────
// Exchange routing helpers (used by tests and API selection logic)
// ─────────────────────────────────────────────────────────────────────────────

type ExchangeCatalogLite = {
  id: string;
  iso2: string;
  tz: string;
  country: string;
};

const exchangeCatalog: ExchangeCatalogLite[] = exchangesCatalogJson as ExchangeCatalogLite[];

function normaliseHint(input: string): string {
  return input.trim().toLowerCase();
}

function uniqueInOrder(ids: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function allowedExchangeIdsForCommodity(mapping: ExchangeCommodityMapping): string[] {
  return uniqueInOrder([
    mapping.primaryExchangeId,
    ...mapping.secondaryExchangeIds,
    ...mapping.extraExchangeIds,
  ]);
}

/**
 * Derive a sensible list of preferred exchanges from either:
 * - an IANA time-zone string (e.g. "Europe/London")
 * - a region hint (e.g. "uk", "us", "eu")
 *
 * Returned order is stable and taken from exchanges.catalog.json.
 */
export function getPreferredExchangeIdsForRegionOrTimeZone(regionOrTimeZone: string): string[] {
  const hint = normaliseHint(regionOrTimeZone);
  if (!hint) return [];

  // If it looks like an IANA tz, try direct tz matches first.
  if (hint.includes('/')) {
    const tzMatches = exchangeCatalog
      .filter((ex) => ex.tz.toLowerCase() === hint)
      .map((ex) => ex.id);
    if (tzMatches.length > 0) return uniqueInOrder(tzMatches);
  }

  // Common region synonyms → ISO2
  const iso2 =
    hint === 'uk' || hint === 'gb' || hint.includes('united kingdom') || hint.includes('britain')
      ? 'GB'
      : hint === 'us' || hint === 'usa' || hint.includes('united states')
      ? 'US'
      : hint === 'eu' || hint.includes('europe') || hint === 'emea'
      ? 'EU'
      : '';

  if (iso2 === 'EU') {
    // Coarse EU/Europe hint: include Europe/* exchanges first.
    const europe = exchangeCatalog
      .filter((ex) => ex.tz.toLowerCase().startsWith('europe/'))
      .map((ex) => ex.id);

    // Ensure London appears in the set if present.
    return uniqueInOrder(europe);
  }

  if (iso2) {
    return uniqueInOrder(exchangeCatalog.filter((ex) => ex.iso2 === iso2).map((ex) => ex.id));
  }

  // Last resort: if someone passes "london" / "new york" etc, do a light match.
  const fuzzy = exchangeCatalog
    .filter((ex) => ex.id.toLowerCase().includes(hint) || ex.country.toLowerCase().includes(hint))
    .map((ex) => ex.id);

  return uniqueInOrder(fuzzy);
}

/**
 * Return the "primary" exchange for a commodity.
 *
 * Paid tier can optionally override to a preferred exchange id, but only if
 * that exchange is allowed for that commodity.
 */
export function getPrimaryExchangeForCommodity(
  commodityId: string,
  tier: CommodityTier,
  preferredExchangeIds?: string[],
): CommodityExchangeSelection | undefined {
  const mapping = exchangeMapByCommodityId.get(commodityId);
  if (!mapping) return undefined;

  // Free tier: always primary.
  if (tier === 'free') {
    return {
      commodityId,
      exchangeId: mapping.primaryExchangeId,
      isPrimary: true,
    };
  }

  // Paid tier: honour preferred exchanges if they are valid for this commodity.
  const preferred = (preferredExchangeIds ?? []).filter((id) => id && id.length > 0);
  if (preferred.length > 0) {
    const allowed = new Set(allowedExchangeIdsForCommodity(mapping));
    const chosen = preferred.find((id) => allowed.has(id));
    if (chosen) {
      return {
        commodityId,
        exchangeId: chosen,
        isPrimary: chosen === mapping.primaryExchangeId,
      };
    }
  }

  return {
    commodityId,
    exchangeId: mapping.primaryExchangeId,
    isPrimary: true,
  };
}

/**
 * Convenience wrapper: derive preferred exchanges from user location hints and route.
 */
export function getPrimaryExchangeForCommodityWithUserLocation(
  commodityId: string,
  tier: CommodityTier,
  userRegionOrTimeZoneHint?: string,
): CommodityExchangeSelection | undefined {
  const preferred = userRegionOrTimeZoneHint
    ? getPreferredExchangeIdsForRegionOrTimeZone(userRegionOrTimeZoneHint)
    : [];

  return getPrimaryExchangeForCommodity(commodityId, tier, preferred);
}

function sessionScore(state: MarketSessionState): number {
  switch (state) {
    case 'open':
      return 3;
    case 'preopen':
      return 2;
    case 'unknown':
      return 1;
    case 'closed':
    case 'holiday':
    default:
      return 0;
  }
}

/**
 * Best-effort exchange selection for a commodity.
 *
 * Rules (simple + test-driven):
 * - Free tier: always primary.
 * - Paid tier: consider preferred venues first (region/timezone hint).
 * - Prefer "open" over "closed" even if the open venue is secondary.
 * - Break ties with latencyByExchangeId when supplied (paid tier only).
 */
export function selectBestExchangeForCommodity(
  commodityId: string,
  context: CommodityRoutingContext,
  getExchangeMarketStatus?: GetExchangeMarketStatus,
): CommodityExchangeSelection | undefined {
  const mapping = exchangeMapByCommodityId.get(commodityId);
  if (!mapping) return undefined;

  if (context.tier === 'free') {
    return {
      commodityId,
      exchangeId: mapping.primaryExchangeId,
      isPrimary: true,
    };
  }

  const now = context.now ?? new Date();

  const preferredFromUser =
    context.userTimeZone && context.userTimeZone.length > 0
      ? getPreferredExchangeIdsForRegionOrTimeZone(context.userTimeZone)
      : context.userRegionHint && context.userRegionHint.length > 0
      ? getPreferredExchangeIdsForRegionOrTimeZone(context.userRegionHint)
      : [];

  const allowed = allowedExchangeIdsForCommodity(mapping);
  const allowedSet = new Set(allowed);

  const preferredAllowed = preferredFromUser.filter((id) => allowedSet.has(id));

  const candidates = uniqueInOrder([
    ...preferredAllowed,
    mapping.primaryExchangeId,
    ...mapping.secondaryExchangeIds,
    ...mapping.extraExchangeIds,
  ]);

  // If no market-hours function is provided, just return the best candidate in order.
  if (!getExchangeMarketStatus) {
    const top = candidates[0] ?? mapping.primaryExchangeId;
    return {
      commodityId,
      exchangeId: top,
      isPrimary: top === mapping.primaryExchangeId,
    };
  }

  let best: { id: string; score: number; latency: number } | undefined;

  for (const id of candidates) {
    const status = getExchangeMarketStatus(id, now);
    const score = sessionScore(status?.sessionState ?? 'unknown');

    const latency =
      context.latencyByExchangeId && typeof context.latencyByExchangeId[id] === 'number'
        ? context.latencyByExchangeId[id]
        : Number.POSITIVE_INFINITY;

    if (!best) {
      best = { id, score, latency };
      continue;
    }

    if (score > best.score) {
      best = { id, score, latency };
      continue;
    }

    if (score === best.score && latency < best.latency) {
      best = { id, score, latency };
    }
  }

  const chosen = best?.id ?? mapping.primaryExchangeId;

  return {
    commodityId,
    exchangeId: chosen,
    isPrimary: chosen === mapping.primaryExchangeId,
  };
}
