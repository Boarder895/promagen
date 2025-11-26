import commoditiesCatalogJson from './commodities.catalog.json';
import {
  commoditiesCatalogSchema,
  type CommoditiesCatalog,
  type Commodity,
} from './commodities.schema';
import countryCommodityMapJson from './country-commodities.map.json';
import type { CountryCommodityMapEntry } from './country-commodities.map';
import commodityExchangeMapJson from './exchange-commodities.map.json';

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
 * Return the default commodity set for a given subscription tier,
 * ordered from most to least important using the importance score.
 *
 * This is a great starting point for:
 *  - deciding which commodities appear in the ribbon for each tier
 *  - picking a subset for "headline" widgets
 */
const DEFAULT_FREE_COMMODITY_IDS: string[] = [
  'brent_crude',
  'gold',
  'wheat',
  'corn',
  'silver',
  'wti_crude',
  'soybeans',
  'coffee',
  'sugar',
];

const DEFAULT_PAID_COMMODITY_IDS: string[] = [
  'brent_crude',
  'gold',
  'wheat',
  'corn',
  'soybeans',
  'copper',
];

/**
 * Return the default commodity set for a given subscription tier.
 *
 * The order is curated to give a sensible "importance" ranking for
 * the homepage ribbon and prompt-builder defaults. The contract is
 * locked in by commodities.index.helpers.test.ts.
 */
export function getDefaultCommoditiesForTier(tier: CommodityTier): Commodity[] {
  const ids = tier === 'free' ? DEFAULT_FREE_COMMODITY_IDS : DEFAULT_PAID_COMMODITY_IDS;

  return ids
    .map((id) => commodityById.get(id))
    .filter((commodity): commodity is Commodity => Boolean(commodity));
}

/**
 * Simple helper to choose a primary exchange for a commodity,
 * with a hook for tier-aware routing.
 *
 * - Free tier: always use the primary exchange
 * - Paid tier: respect any preferred exchanges where possible
 */
export function getPrimaryExchangeForCommodity(
  commodityId: string,
  tier: CommodityTier,
  preferredExchangeIds?: string[],
):
  | {
      commodityId: string;
      exchangeId: string;
      isPrimary: boolean;
      secondaryCandidates: string[];
      extraCandidates: string[];
    }
  | undefined {
  const mapping = exchangeMapByCommodityId.get(commodityId);

  if (!mapping) {
    return undefined;
  }

  const { primaryExchangeId, secondaryExchangeIds, extraExchangeIds } = mapping;

  const candidates = [primaryExchangeId, ...secondaryExchangeIds, ...extraExchangeIds];

  if (tier === 'paid' && preferredExchangeIds && preferredExchangeIds.length > 0) {
    const preferredSet = new Set(preferredExchangeIds);

    const preferredMatch = candidates.find((exchangeId) => preferredSet.has(exchangeId));

    if (preferredMatch) {
      return {
        commodityId,
        exchangeId: preferredMatch,
        isPrimary: preferredMatch === primaryExchangeId,
        secondaryCandidates: secondaryExchangeIds,
        extraCandidates: extraExchangeIds,
      };
    }
  }

  return {
    commodityId,
    exchangeId: primaryExchangeId,
    isPrimary: true,
    secondaryCandidates: secondaryExchangeIds,
    extraCandidates: extraExchangeIds,
  };
}

/**
 * Given a coarse region / time-zone hint, return a set of exchanges
 * that should be preferred when routing for that user.
 *
 * This is intentionally heuristic – we just need something stable,
 * predictable and testable.
 */
export function getPreferredExchangeIdsForRegionOrTimeZone(
  regionOrTimeZoneHint?: string | null,
): string[] {
  if (!regionOrTimeZoneHint) {
    return [];
  }

  const value = regionOrTimeZoneHint.toLowerCase().replace(/[^a-z0-9_/+-]+/g, '_');

  // UK / London / GBP-centric
  if (
    value === 'uk' ||
    value === 'gb' ||
    value.includes('london') ||
    value.includes('europe/london')
  ) {
    return ['lse-london', 'ice-futures-europe', 'eurex-frankfurt'];
  }

  // US / NY / Chicago / Eastern / Central
  if (
    value === 'us' ||
    value === 'usa' ||
    value.includes('new_york') ||
    value.includes('new-york') ||
    value.includes('america/new_york') ||
    value.includes('chicago') ||
    value.includes('america/chicago')
  ) {
    return ['nyse-new-york', 'cme-chicago', 'cboe-chicago'];
  }

  // Continental Europe (non-UK)
  if (
    value === 'eu' ||
    value === 'europe' ||
    value === 'eurozone' ||
    value.includes('frankfurt') ||
    value.includes('paris') ||
    value.includes('amsterdam') ||
    value.includes('brussels') ||
    value.includes('europe/berlin') ||
    value.includes('europe/paris')
  ) {
    return ['eurex-frankfurt', 'euronext-paris', 'euronext-amsterdam', 'euronext-brussels'];
  }

  // Asia-Pacific: JP / HK / SG / AU / NZ
  if (
    value === 'apac' ||
    value === 'asia_pacific' ||
    value.includes('tokyo') ||
    value.includes('osaka') ||
    value.includes('hong_kong') ||
    value.includes('hong-kong') ||
    value.includes('singapore') ||
    value.includes('sydney') ||
    value.includes('melbourne') ||
    value.includes('australia') ||
    value.includes('new_zealand') ||
    value.includes('nz')
  ) {
    return [
      'tse-tokyo',
      'ose-osaka',
      'hkex-hong-kong',
      'sgx-singapore',
      'asx-sydney',
      'nzsx-new-zealand',
    ];
  }

  // Latin America
  if (
    value === 'latam' ||
    value === 'latin_america' ||
    value === 'latin-america' ||
    value === 'brazil' ||
    value === 'br' ||
    value === 'argentina' ||
    value === 'ar' ||
    value === 'chile' ||
    value === 'cl' ||
    value === 'peru' ||
    value === 'pe' ||
    value === 'mexico'
  ) {
    return [
      'b3-sao-paulo',
      'bcba-buenos-aires',
      'sse-santiago',
      'bvl-lima',
      'bmv-mexico-city',
      'biva-mexico-city',
    ];
  }

  // Middle East & North Africa
  if (
    value === 'mena' ||
    value === 'middle_east' ||
    value === 'me' ||
    value === 'sa' ||
    value === 'saudi_arabia' ||
    value === 'ae' ||
    value === 'uae' ||
    value === 'ma' ||
    value === 'morocco' ||
    value === 'tn' ||
    value === 'tunisia'
  ) {
    return ['dfm-dubai', 'tadawul-riyadh', 'cse-casablanca', 'casablanca-alt-cse', 'tunis-bvmt'];
  }

  // Sub-Saharan Africa
  if (
    value === 'africa' ||
    value === 'sub_saharan_africa' ||
    value === 'sub-saharan-africa' ||
    value === 'ng' ||
    value === 'nigeria' ||
    value === 'za' ||
    value === 'south_africa' ||
    value === 'ke' ||
    value === 'kenya'
  ) {
    return ['jse-johannesburg', 'nse-lagos', 'nairobi-securities-exchange'];
  }

  // Fall back to no strong preferences – primary venue will be used.
  return [];
}

/**
 * Rank candidate venues for a commodity, combining:
 *  - market session state (open / preopen / closed / holiday / unknown)
 *  - region / time-zone preferences
 *  - primary vs non-primary
 *  - optional latency information (paid tier only)
 */
export function selectBestExchangeForCommodity(
  commodityId: string,
  context: CommodityRoutingContext,
  getExchangeMarketStatus: GetExchangeMarketStatus,
):
  | {
      exchangeId: string;
      isPrimary: boolean;
    }
  | undefined {
  const mapping = exchangeMapByCommodityId.get(commodityId);

  if (!mapping) {
    return undefined;
  }

  const { primaryExchangeId, secondaryExchangeIds, extraExchangeIds } = mapping;
  const now = context.now ?? new Date();

  const candidateExchangeIds = [primaryExchangeId, ...secondaryExchangeIds, ...extraExchangeIds];

  const preferredExchangeIds = new Set(
    getPreferredExchangeIdsForRegionOrTimeZone(context.userTimeZone ?? context.userRegionHint),
  );

  const scores = candidateExchangeIds.map((exchangeId) => {
    const status = getExchangeMarketStatus(exchangeId, now) ?? {
      exchangeId,
      sessionState: 'unknown' as MarketSessionState,
    };

    const rawLatency = context.latencyByExchangeId?.[exchangeId];
    const latency = typeof rawLatency === 'number' && rawLatency >= 0 ? rawLatency : undefined;

    let score = 0;

    // Market session weighting – lower is better
    switch (status.sessionState) {
      case 'open':
        score += 0;
        break;
      case 'preopen':
        score += 2;
        break;
      case 'closed':
        score += 5;
        break;
      case 'holiday':
        score += 7;
        break;
      case 'unknown':
      default:
        score += 10;
        break;
    }

    // Region preference
    if (!preferredExchangeIds.has(exchangeId) && preferredExchangeIds.size > 0) {
      score += 3;
    }

    const isPrimary = exchangeId === primaryExchangeId;

    // Prefer primary if all else equal
    if (!isPrimary) {
      score += 1;
    }

    // For paid tier, fold in latency where available.
    if (context.tier === 'paid' && typeof latency === 'number') {
      const clampedLatency = Math.max(0, Math.min(latency, 2000));
      score += clampedLatency / 200; // 0–10 range
    }

    return {
      exchangeId,
      isPrimary,
      score,
    };
  });

  // Pick the lowest score; stable across runs.
  scores.sort((a, b) => {
    if (a.score !== b.score) {
      return a.score - b.score;
    }

    if (a.isPrimary !== b.isPrimary) {
      return a.isPrimary ? -1 : 1;
    }

    return a.exchangeId.localeCompare(b.exchangeId);
  });

  const best = scores[0];

  if (!best) {
    return undefined;
  }

  return {
    exchangeId: best.exchangeId,
    isPrimary: best.isPrimary,
  };
}

/**
 * Convenience: given a commodity ID and region/time-zone hint,
 * route to the best primary exchange for that user.
 */
export function getPrimaryExchangeForCommodityWithUserLocation(
  commodityId: string,
  tier: CommodityTier,
  regionOrTimeZoneHint?: string | null,
):
  | {
      commodityId: string;
      exchangeId: string;
      isPrimary: boolean;
      secondaryCandidates: string[];
      extraCandidates: string[];
    }
  | undefined {
  const preferredExchangeIds = getPreferredExchangeIdsForRegionOrTimeZone(regionOrTimeZoneHint);
  return getPrimaryExchangeForCommodity(commodityId, tier, preferredExchangeIds);
}

/**
 * Return the list of commodities appropriate for the given tier.
 */
export function getDefaultCommoditiesForTierIds(tier: CommodityTier): string[] {
  return getDefaultCommoditiesForTier(tier).map((commodity) => commodity.id);
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
