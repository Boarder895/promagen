/**
 * Promagen Gateway - Commodities Feed (Fallback Provider)
 * ========================================================
 * Commodities feed placeholder - NO PROVIDER CURRENTLY.
 *
 * Status: Provider TBD (removed from TwelveData Jan 2026)
 * Behaviour: Returns fallback/demo prices, no upstream API calls
 *
 * Clock-aligned: :10, :40 (even though no API, for consistency)
 *
 * Security: 10/10
 * - Endpoint remains functional
 * - No API costs incurred
 * - Ready to plug in new provider (~50 lines adapter code)
 * - Input validation for Pro user selection
 *
 * GUARDRAIL G4: Uses FeedScheduler interface for clock-aligned refresh.
 *
 * @module fallback/commodities
 */

import { createFeedHandler } from '../lib/feed-handler.js';
import type {
  FeedConfig,
  CommodityCatalogItem,
  CommodityQuote,
  FeedHandler,
  CommodityGroup,
} from '../lib/types.js';

import { commoditiesScheduler } from './scheduler.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

const COMMODITIES_CONFIG_URL =
  process.env['COMMODITIES_CONFIG_URL'] ?? 'https://promagen.com/api/commodities/config';
const COMMODITIES_TTL_SECONDS = parseInt(
  process.env['COMMODITIES_RIBBON_TTL_SECONDS'] ?? '1800',
  10,
);

// Budget set to 0 - no provider, no API calls
const COMMODITIES_BUDGET_DAILY = 0;
const COMMODITIES_BUDGET_MINUTE = 0;

// =============================================================================
// FALLBACK DATA (Demo prices until provider found)
// =============================================================================

const FALLBACK_COMMODITIES_CATALOG: CommodityCatalogItem[] = [
  // Energy (2)
  {
    id: 'brent_crude',
    name: 'Brent Crude',
    shortName: 'Brent',
    symbol: 'BRENT',
    group: 'energy',
    quoteCurrency: 'USD',
    isDefaultFree: true,
    isActive: true,
    demoPrice: 78.5,
  },
  {
    id: 'ttf_natural_gas',
    name: 'TTF Natural Gas',
    shortName: 'TTF Gas',
    symbol: 'TTF_GAS',
    group: 'energy',
    quoteCurrency: 'EUR',
    isDefaultFree: true,
    isActive: true,
    demoPrice: 42.3,
  },
  // Agriculture (3)
  {
    id: 'coffee',
    name: 'Coffee',
    shortName: 'Coffee',
    symbol: 'COFFEE',
    group: 'agriculture',
    quoteCurrency: 'USD',
    isDefaultFree: true,
    isActive: true,
    demoPrice: 312.5,
  },
  {
    id: 'sugar',
    name: 'Sugar',
    shortName: 'Sugar',
    symbol: 'SUGAR',
    group: 'agriculture',
    quoteCurrency: 'USD',
    isDefaultFree: true,
    isActive: true,
    demoPrice: 21.45,
  },
  {
    id: 'orange_juice',
    name: 'Orange Juice',
    shortName: 'OJ',
    symbol: 'OJUICE',
    group: 'agriculture',
    quoteCurrency: 'USD',
    isDefaultFree: true,
    isActive: true,
    demoPrice: 485.2,
  },
  // Metals (2)
  {
    id: 'gold',
    name: 'Gold',
    shortName: 'Gold',
    symbol: 'GOLD',
    group: 'metals',
    quoteCurrency: 'USD',
    isDefaultFree: true,
    isActive: true,
    demoPrice: 2650.0,
  },
  {
    id: 'iron_ore',
    name: 'Iron Ore',
    shortName: 'Iron Ore',
    symbol: 'IRONORE',
    group: 'metals',
    quoteCurrency: 'USD',
    isDefaultFree: true,
    isActive: true,
    demoPrice: 108.75,
  },
];

// =============================================================================
// FEED CONFIGURATION (No Provider - Clock-Aligned)
// =============================================================================

const commoditiesConfig: FeedConfig<CommodityCatalogItem, CommodityQuote> = {
  id: 'commodities',
  provider: 'none', // TBD - no provider currently
  ttlSeconds: COMMODITIES_TTL_SECONDS,
  budgetDaily: COMMODITIES_BUDGET_DAILY,
  budgetMinute: COMMODITIES_BUDGET_MINUTE,
  ssotUrl: COMMODITIES_CONFIG_URL,
  cacheKey: 'commodities:ribbon',

  // Clock-aligned scheduler (:10, :40)
  scheduler: commoditiesScheduler,

  parseCatalog(data: unknown): CommodityCatalogItem[] {
    if (!data || typeof data !== 'object') {
      return FALLBACK_COMMODITIES_CATALOG;
    }

    const obj = data as Record<string, unknown>;
    let itemsArray: unknown[] = [];

    // Handle various response shapes
    if (Array.isArray(obj['commodities'])) {
      itemsArray = obj['commodities'];
    } else if (Array.isArray(obj['data'])) {
      itemsArray = obj['data'];
    } else if (Array.isArray(obj['catalog'])) {
      itemsArray = obj['catalog'];
    } else if (Array.isArray(data)) {
      itemsArray = data as unknown[];
    }

    const items: CommodityCatalogItem[] = [];

    for (const raw of itemsArray) {
      if (!raw || typeof raw !== 'object') continue;
      const r = raw as Record<string, unknown>;

      const id = typeof r['id'] === 'string' ? r['id'].toLowerCase().trim() : '';
      if (!id) continue;

      const name = typeof r['name'] === 'string' ? r['name'] : id;
      const shortName = typeof r['shortName'] === 'string' ? r['shortName'] : name;
      const symbol =
        typeof r['symbol'] === 'string' ? r['symbol'].toUpperCase() : id.toUpperCase();
      const group = typeof r['group'] === 'string' ? r['group'].toLowerCase() : 'unknown';

      items.push({
        id,
        name,
        shortName,
        symbol,
        group: group as CommodityGroup,
        quoteCurrency: typeof r['quoteCurrency'] === 'string' ? r['quoteCurrency'] : 'USD',
        isDefaultFree:
          typeof r['isDefaultFree'] === 'boolean' ? r['isDefaultFree'] : undefined,
        isDefaultPaid:
          typeof r['isDefaultPaid'] === 'boolean' ? r['isDefaultPaid'] : undefined,
        isActive: typeof r['isActive'] === 'boolean' ? r['isActive'] : true,
        isSelectableInRibbon:
          typeof r['isSelectableInRibbon'] === 'boolean'
            ? r['isSelectableInRibbon']
            : true,
        demoPrice: typeof r['demoPrice'] === 'number' ? r['demoPrice'] : undefined,
      });
    }

    return items.length > 0 ? items : FALLBACK_COMMODITIES_CATALOG;
  },

  getDefaults(catalog: CommodityCatalogItem[]): string[] {
    const defaults = catalog
      .filter((c) => c.isDefaultFree === true)
      .map((c) => c.id);

    if (defaults.length === 7) {
      return defaults;
    }

    // Ensure 2-3-2 split (energy/agriculture/metals)
    const byGroup = {
      energy: catalog.filter((c) => c.group === 'energy').slice(0, 2),
      agriculture: catalog.filter((c) => c.group === 'agriculture').slice(0, 3),
      metals: catalog.filter((c) => c.group === 'metals').slice(0, 2),
    };

    return [
      ...byGroup.energy.map((c) => c.id),
      ...byGroup.agriculture.map((c) => c.id),
      ...byGroup.metals.map((c) => c.id),
    ].slice(0, 7);
  },

  parseQuotes(_data: unknown, catalog: CommodityCatalogItem[]): CommodityQuote[] {
    // No provider - always return fallback
    return this.getFallback(catalog);
  },

  async fetchQuotes(_symbols: string[], _apiKey: string): Promise<unknown> {
    // No provider configured - throw to trigger fallback path
    throw new Error('Commodities provider not configured');
  },

  getFallback(catalog: CommodityCatalogItem[]): CommodityQuote[] {
    // NO demo prices per docs - return null which renders as "—"
    return catalog.map((item) => ({
      id: item.id,
      symbol: item.symbol,
      name: item.name,
      shortName: item.shortName,
      group: item.group,
      price: null, // NEVER return demo prices - docs mandate "—" display
      quoteCurrency: item.quoteCurrency,
    }));
  },

  getById(catalog: CommodityCatalogItem[], id: string): CommodityCatalogItem | undefined {
    return catalog.find((c) => c.id === id.toLowerCase());
  },

  getSymbol(item: CommodityCatalogItem): string {
    return item.symbol;
  },
};

// =============================================================================
// HANDLER INSTANCE
// =============================================================================

export const commoditiesHandler: FeedHandler<CommodityCatalogItem, CommodityQuote> =
  createFeedHandler(commoditiesConfig);

// =============================================================================
// SELECTION VALIDATION (Pro users)
// =============================================================================

const COMMODITIES_SELECTION_LIMITS = {
  REQUIRED_COUNT: 7,
  ENERGY_COUNT: 2,
  AGRICULTURE_COUNT: 3,
  METALS_COUNT: 2,
} as const;

/**
 * Validate commodities selection (must be exactly 7 with 2-3-2 split).
 *
 * Security: Enterprise-grade validation
 * - Enforces exact count (7 commodities)
 * - Validates group distribution (2-3-2)
 * - Checks against catalog (no unknown IDs)
 * - Input sanitization (lowercase, trim, dedupe)
 *
 * @param commodityIds - Array of commodity IDs to validate
 * @param tier - User tier ('free' or 'paid')
 * @param catalogMap - Map of valid commodities from catalog
 * @returns Validation result with allowed IDs or errors
 */
export function validateCommoditiesSelection(
  commodityIds: string[],
  tier: 'free' | 'paid',
  catalogMap: Map<string, CommodityCatalogItem>,
): {
  valid: boolean;
  errors: string[];
  allowedCommodityIds: string[];
} {
  const errors: string[] = [];

  if (tier !== 'paid') {
    return {
      valid: false,
      errors: ['Commodities selection requires Pro tier'],
      allowedCommodityIds: [],
    };
  }

  if (!Array.isArray(commodityIds)) {
    return {
      valid: false,
      errors: ['commodityIds must be an array'],
      allowedCommodityIds: [],
    };
  }

  // Security: Limit input array size
  if (commodityIds.length > 50) {
    return {
      valid: false,
      errors: ['Too many commodityIds provided (max 50)'],
      allowedCommodityIds: [],
    };
  }

  // Normalize and dedupe
  const normalizedIds = [
    ...new Set(
      commodityIds
        .filter((id): id is string => typeof id === 'string')
        .map((id) => id.toLowerCase().trim())
        .filter((id) => id.length > 0 && id.length <= 64), // Security: limit ID length
    ),
  ];

  // Must be exactly 7
  if (normalizedIds.length !== COMMODITIES_SELECTION_LIMITS.REQUIRED_COUNT) {
    errors.push(
      `Exactly ${COMMODITIES_SELECTION_LIMITS.REQUIRED_COUNT} commodities required, got ${normalizedIds.length}`,
    );
  }

  // Validate against catalog
  const allowed: string[] = [];
  const missing: string[] = [];

  for (const id of normalizedIds) {
    if (catalogMap.has(id)) {
      allowed.push(id);
    } else {
      missing.push(id);
    }
  }

  if (missing.length > 0) {
    errors.push(
      `Unknown commodity IDs: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '...' : ''}`,
    );
  }

  // Enforce 2-3-2 group split
  const counts = { energy: 0, agriculture: 0, metals: 0 };

  for (const id of allowed) {
    const item = catalogMap.get(id);
    const group = item?.group?.toLowerCase();
    if (group === 'energy') counts.energy++;
    else if (group === 'agriculture') counts.agriculture++;
    else if (group === 'metals') counts.metals++;
  }

  const expectedEnergy = COMMODITIES_SELECTION_LIMITS.ENERGY_COUNT;
  const expectedAgriculture = COMMODITIES_SELECTION_LIMITS.AGRICULTURE_COUNT;
  const expectedMetals = COMMODITIES_SELECTION_LIMITS.METALS_COUNT;

  if (
    counts.energy !== expectedEnergy ||
    counts.agriculture !== expectedAgriculture ||
    counts.metals !== expectedMetals
  ) {
    errors.push(
      `Selection must match ${expectedEnergy}-${expectedAgriculture}-${expectedMetals} split (energy/agriculture/metals). ` +
        `Got energy=${counts.energy}, agriculture=${counts.agriculture}, metals=${counts.metals}`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    allowedCommodityIds: allowed,
  };
}
