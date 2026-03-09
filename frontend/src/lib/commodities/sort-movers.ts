// src/lib/commodities/sort-movers.ts
// ============================================================================
// COMMODITIES MOVERS SORTER
// ============================================================================
// Utility to sort 78 commodities by % change and extract:
// - Top 4 winners (highest positive % change)
// - Top 4 losers (lowest/most negative % change)
//
// v2.6: Retail unit conversion system (8 Feb 2026)
// - Conversion lines now show consumer-friendly units (€2.63 / kg not €2,632.80)
// - Per-region retail factors: US (imperial), UK (mixed), EU (metric)
// - All prices strict 2 decimal places
//
// v2.5: Gold in ZAR via cross-rate (5 Feb 2026)
// - Gold displays ZAR as primary currency (converted from USD via GBP)
// - Cross-rate path: USD → GBP → ZAR using gbp-usd and gbp-zar pairs
// - Conversion lines show EUR, GBP, USD beneath Gold's ZAR price
//
// v2.1: EUR/GBP Conversion Support (4 Feb 2026)
// - Accepts FX rates from useFxQuotes
// - Converts all prices to EUR and GBP using live rates
// - Handles USD, INR, BRL, CNY, CAD, NOK, MYR, AUD, ZAR currencies
//
// Authority: Compacted conversation 2026-02-08
// Existing features preserved: Yes
// ============================================================================

import type { CommoditiesApiQuote } from '@/types/commodities-ribbon';
import type { CommodityMovementMap } from '@/hooks/use-commodities-quotes';
import type { CommodityMoverData, SortedCommodityMovers } from '@/types/commodities-movers';
import type { RichTooltipLine } from '@/components/ui/rich-tooltip';

import {
  type ConversionRates,
  convertCommodityPrice,
  formatEurGbpLine,
  formatZarPrice,
  getCurrencyCountryCode,
  usdToZarCrossRate,
} from '@/lib/commodities/convert';

import { getRetailConfigForRegion } from '@/lib/commodities/retail-units';

// ============================================================================
// BRAND COLOURS - Migrated from commodities-ribbon.container.tsx
// ============================================================================

const COMMODITY_BRAND_COLOURS: Record<string, string> = {
  // 8 bright colours, cycled. No slate, no near-white, no duplicates for
  // commodities that commonly appear together in winners/losers.
  // Red=#EF4444  Orange=#F97316  Gold=#EAB308  Green=#22C55E
  // Cyan=#06B6D4  Blue=#3B82F6  Purple=#A855F7  Pink=#EC4899

  // Energy
  gasoline: '#F97316',    // Orange

  // Precious metals
  gold: '#EAB308',        // Gold
  silver: '#06B6D4',      // Cyan
  platinum: '#3B82F6',    // Blue

  // Other
  lumber: '#22C55E',      // Green

  // Grains
  wheat: '#F97316',       // Orange
  corn: '#EAB308',        // Gold
  soybeans: '#22C55E',    // Green
  rice: '#A855F7',        // Purple
  oat: '#06B6D4',         // Cyan
  barley: '#3B82F6',      // Blue

  // Softs
  coffee: '#EF4444',      // Red
  sugar: '#A855F7',       // Purple
  cocoa: '#EC4899',       // Pink
  cotton: '#3B82F6',      // Blue
  orange_juice: '#F97316', // Orange
  tea: '#22C55E',         // Green

  // Dairy & Eggs
  milk: '#06B6D4',        // Cyan
  cheese: '#EAB308',      // Gold
  butter: '#EC4899',      // Pink
  eggs_us: '#A855F7',     // Purple
  eggs_ch: '#EF4444',     // Red

  // Livestock
  beef: '#EF4444',        // Red
  live_cattle: '#F97316', // Orange
  feeder_cattle: '#EC4899', // Pink
  lean_hogs: '#A855F7',   // Purple
  poultry: '#06B6D4',     // Cyan

  // Oils & other agriculture
  palm_oil: '#EAB308',    // Gold
  canola: '#22C55E',      // Green
  rapeseed: '#3B82F6',    // Blue
  sunflower_oil: '#F97316', // Orange
  potatoes: '#EC4899',    // Pink
  salmon: '#EF4444',      // Red
  wool: '#3B82F6',        // Blue
};

const DEFAULT_BRAND_COLOUR = '#38BDF8'; // Cyan fallback

// ============================================================================
// UNIT EXTRACTION FROM RIBBONSUBTEXT
// ============================================================================
// The catalog's ribbonSubtext has format: "{CURRENCY}/{UNIT}"
// Examples:
//   "USD/BBL"       → "/bbl"
//   "EUR/MWH"       → "/MWh"
//   "USD/T.OZ"      → "/t.oz"
//   "CNY/KG"        → "/kg"
//   "USD/1000 BOARD FEET" → "/1000 board feet"
//
// We extract everything after the first "/" and format it for display.
// ============================================================================

/**
 * Extract unit from ribbonSubtext field.
 * @param ribbonSubtext - e.g., "USD/BBL", "EUR/MWH"
 * @returns Unit string with leading slash, e.g., "/bbl", "/MWh", or empty string
 */
function extractUnit(ribbonSubtext?: string): string {
  if (!ribbonSubtext) return '';

  const slashIndex = ribbonSubtext.indexOf('/');
  if (slashIndex === -1) return '';

  // Extract unit part and format it
  const unitPart = ribbonSubtext.slice(slashIndex + 1).trim();
  if (!unitPart) return '';

  // Return with spaced slash for price display (e.g., "$63.34 / bbl")
  return ` / ${unitPart.toLowerCase()}`;
}

// ============================================================================
// CURRENCY SYMBOL MAPPING
// ============================================================================

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CNY: '¥',
  JPY: '¥',
  INR: '₹',
  AUD: 'A$',
  CAD: 'C$',
  BRL: 'R$',
  MYR: 'RM',
  NOK: 'kr',
  ZAR: 'R',
};

function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency.toUpperCase()] ?? currency;
}

// ============================================================================
// PRICE FORMATTING
// ============================================================================

function formatCommodityPrice(value: number, unit: string, quoteCurrency: string = 'USD'): string {
  if (!Number.isFinite(value)) return '—';

  const currencySymbol = getCurrencySymbol(quoteCurrency);

  const formatted = value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Format: "$ 63.34/bbl" (thin space between symbol and price for readability)
  return `${currencySymbol}\u2009${formatted}${unit}`;
}

// ============================================================================
// RETAIL UNIT PRICE FORMATTING (v2.6)
// ============================================================================
// Applies per-region retail conversion factors to the converted currency
// prices, producing consumer-friendly units like "€2.63 / kg" instead of
// industrial units like "€2,632.80".
// ============================================================================

const COUNTRY_SYMBOL: Record<string, string> = { US: '$', GB: '£', EU: '€' };

/**
 * Format a price with retail unit for a specific region.
 * Applies the retail factor and appends the unit label.
 *
 * @param rawPrice - Price in target currency at industrial unit scale
 * @param countryCode - Region code: "US", "GB", or "EU"
 * @param commodityId - Catalog ID for retail unit lookup
 * @returns Formatted string like "€2.63 / kg" or "—"
 */
function formatRetailPrice(
  rawPrice: number | null,
  countryCode: string,
  commodityId: string,
): string {
  if (rawPrice === null || !Number.isFinite(rawPrice)) return '—';

  const symbol = COUNTRY_SYMBOL[countryCode] ?? '$';
  const retailConfig = getRetailConfigForRegion(commodityId, countryCode);

  if (retailConfig) {
    const retailPrice = rawPrice * retailConfig.factor;
    const formatted = retailPrice.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${symbol}\u2009${formatted} / ${retailConfig.unit}`;
  }

  // Fallback: no retail config, format raw price at 2dp
  const formatted = rawPrice.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}\u2009${formatted}`;
}

/**
 * Build conversion lines with retail unit factors applied.
 * Handles line ordering based on base currency (same logic as
 * formatSmartConversionLines) but with retail-aware prices.
 */
function buildRetailConversionLines(
  commodityId: string,
  quoteCurrency: string,
  priceEur: number | null,
  priceGbp: number | null,
  priceUsd: number | null,
): {
  line1: { countryCode: string; priceText: string };
  line2: { countryCode: string; priceText: string };
  line3: { countryCode: string; priceText: string } | null;
} {
  const currency = quoteCurrency.toUpperCase();

  const eurLine = { countryCode: 'EU', priceText: formatRetailPrice(priceEur, 'EU', commodityId) };
  const gbpLine = { countryCode: 'GB', priceText: formatRetailPrice(priceGbp, 'GB', commodityId) };
  const usdLine = { countryCode: 'US', priceText: formatRetailPrice(priceUsd, 'US', commodityId) };

  switch (currency) {
    case 'EUR':
      return { line1: usdLine, line2: gbpLine, line3: null };
    case 'GBP':
      return { line1: usdLine, line2: eurLine, line3: null };
    case 'USD':
      return { line1: eurLine, line2: gbpLine, line3: null };
    default:
      // Non-major (INR, BRL, CNY, etc.) → show all three
      return { line1: eurLine, line2: gbpLine, line3: usdLine };
  }
}

// ============================================================================
// TOOLTIP BUILDER
// ============================================================================

function buildTooltipLines(commodity: {
  yearFirstTraded?: number;
  fact?: string;
}): RichTooltipLine[] {
  const lines: RichTooltipLine[] = [];

  if (commodity.yearFirstTraded) {
    lines.push({ label: 'First traded', value: String(commodity.yearFirstTraded) });
  }
  if (commodity.fact) {
    lines.push({ label: 'Fact', value: commodity.fact });
  }

  return lines;
}

// ============================================================================
// COMMODITY CATALOG ENTRY TYPE (subset of full catalog)
// ============================================================================

export interface CommodityCatalogEntry {
  id: string;
  name: string;
  shortName?: string;
  emoji?: string;
  quoteCurrency?: string;
  ribbonSubtext?: string; // e.g., "USD/BBL" - contains unit info
  yearFirstTraded?: number;
  fact?: string;
  group?: string; // 'energy' | 'agriculture' | 'metals'
}

// ============================================================================
// SORTING FUNCTION
// ============================================================================

/**
 * Sort commodities by % change and extract top 4 winners and losers.
 * Now includes EUR/GBP conversions using live FX rates.
 *
 * @param quotes - Array of commodity quotes from API
 * @param movementById - Map of commodity ID to movement data (tick, deltaPct)
 * @param catalog - Commodity catalog for metadata (name, emoji, etc.)
 * @param topN - Number of winners/losers to return (default: 4)
 * @param conversionRates - Optional FX rates for EUR/GBP conversions
 * @returns Object with winners, losers, and sortedAt timestamp
 */
export function sortCommoditiesIntoMovers(
  quotes: CommoditiesApiQuote[],
  movementById: CommodityMovementMap,
  catalog: CommodityCatalogEntry[],
  topN: number = 4,
  conversionRates?: ConversionRates | null,
): SortedCommodityMovers {
  // Build lookup maps for efficiency
  const catalogById = new Map<string, CommodityCatalogEntry>();
  for (const c of catalog) {
    catalogById.set(c.id, c);
  }

  const quoteById = new Map<string, CommoditiesApiQuote>();
  for (const q of quotes) {
    quoteById.set(q.id, q);
  }

  // Build array of commodities with valid delta percentages
  const withDelta: Array<{
    id: string;
    deltaPct: number;
    quote: CommoditiesApiQuote;
    catalog: CommodityCatalogEntry;
  }> = [];

  for (const [id, movement] of Object.entries(movementById)) {
    if (movement.deltaPct == null || !Number.isFinite(movement.deltaPct)) {
      continue; // Skip commodities without valid delta
    }

    const quote = quoteById.get(id);
    const catalogEntry = catalogById.get(id);

    if (!quote || !catalogEntry) {
      continue; // Skip if missing quote or catalog data
    }

    withDelta.push({
      id,
      deltaPct: movement.deltaPct,
      quote,
      catalog: catalogEntry,
    });
  }

  // Sort by deltaPct descending (highest positive first)
  const sortedByDelta = [...withDelta].sort((a, b) => b.deltaPct - a.deltaPct);

  // Extract winners (top N with positive delta)
  const winnersRaw = sortedByDelta.filter((item) => item.deltaPct > 0).slice(0, topN);

  // Extract losers (bottom N with negative delta, sorted by most negative first)
  const losersRaw = sortedByDelta
    .filter((item) => item.deltaPct < 0)
    .slice(-topN)
    .reverse(); // Most negative first

  // Convert to CommodityMoverData format
  const mapToMoverData = (
    item: (typeof withDelta)[0],
    direction: 'winner' | 'loser',
  ): CommodityMoverData => {
    // Extract unit from catalog's ribbonSubtext (e.g., "USD/BBL" → "/bbl")
    const unit = extractUnit(item.catalog.ribbonSubtext);
    const quoteCurrency = item.catalog.quoteCurrency ?? 'USD';

    // ========================================================================
    // GOLD SPECIAL HANDLING (v2.5)
    // ========================================================================
    // Gold displays in ZAR as primary currency (special request).
    // Uses cross-rate conversion: USD → GBP → ZAR
    // Conversion lines show EUR, GBP, USD beneath.
    // ========================================================================
    const isGold = item.id === 'gold';

    // Get country code for base currency flag (v2.3)
    // Gold overrides to ZA (South Africa) for ZAR display
    const baseFlagCode = isGold ? 'ZA' : getCurrencyCountryCode(quoteCurrency);

    // Compute EUR/GBP/USD conversions if rates are available
    let priceEur: number | null = null;
    let priceGbp: number | null = null;
    let priceUsd: number | null = null;
    let priceZar: number | null = null;
    let eurGbpText = '—';
    let conversionLine1 = { countryCode: 'EU', priceText: '—' };
    let conversionLine2 = { countryCode: 'GB', priceText: '—' };
    let conversionLine3: { countryCode: string; priceText: string } | null = null;

    // Primary price text (will be overridden for Gold)
    let primaryPriceText = formatCommodityPrice(item.quote.value, unit, quoteCurrency);

    if (conversionRates && Number.isFinite(item.quote.value) && item.quote.value > 0) {
      const converted = convertCommodityPrice(item.quote.value, quoteCurrency, conversionRates);
      priceEur = converted.eur;
      priceGbp = converted.gbp;
      priceUsd = converted.usd;
      eurGbpText = formatEurGbpLine(priceEur, priceGbp);

      if (isGold) {
        // ====================================================================
        // GOLD: ZAR as primary, EUR/GBP/USD as conversion lines (retail units)
        // ====================================================================
        priceZar = usdToZarCrossRate(item.quote.value, conversionRates);

        if (priceZar !== null) {
          primaryPriceText = `${formatZarPrice(priceZar)}${unit}`;
        }

        // Conversion lines with retail unit factors applied
        conversionLine1 = {
          countryCode: 'EU',
          priceText: formatRetailPrice(priceEur, 'EU', item.id),
        };
        conversionLine2 = {
          countryCode: 'GB',
          priceText: formatRetailPrice(priceGbp, 'GB', item.id),
        };
        conversionLine3 = {
          countryCode: 'US',
          priceText: formatRetailPrice(item.quote.value, 'US', item.id),
        };
      } else {
        // ====================================================================
        // ALL OTHER COMMODITIES: Retail unit conversion lines (v2.6)
        // ====================================================================
        const retailLines = buildRetailConversionLines(
          item.id,
          quoteCurrency,
          priceEur,
          priceGbp,
          priceUsd,
        );
        conversionLine1 = retailLines.line1;
        conversionLine2 = retailLines.line2;
        conversionLine3 = retailLines.line3;
      }
    }

    return {
      id: item.id,
      name: item.catalog.name,
      shortName: item.catalog.shortName ?? item.catalog.name,
      emoji: item.catalog.emoji ?? '📊',
      priceText: primaryPriceText,
      deltaPct: item.deltaPct,
      direction,
      brandColor: COMMODITY_BRAND_COLOURS[item.id] ?? DEFAULT_BRAND_COLOUR,
      group: item.catalog.group ?? 'metals',
      fact: item.catalog.fact ?? null,
      yearFirstTraded: item.catalog.yearFirstTraded ?? null,
      tooltipTitle: item.catalog.name,
      tooltipLines: buildTooltipLines(item.catalog),
      // v2.3: Currency conversion fields with flag support
      priceEur,
      priceGbp,
      priceUsd,
      eurGbpText,
      quoteCurrency: isGold ? 'ZAR' : quoteCurrency, // Gold reports as ZAR base
      conversionLine1,
      conversionLine2,
      conversionLine3,
      baseFlagCode,
    };
  };

  return {
    winners: winnersRaw.map((item) => mapToMoverData(item, 'winner')),
    losers: losersRaw.map((item) => mapToMoverData(item, 'loser')),
    sortedAt: Date.now(),
  };
}

// ============================================================================
// EMPTY STATE HELPERS
// ============================================================================

/**
 * Returns empty movers result for loading/error states.
 */
export function getEmptyMovers(): SortedCommodityMovers {
  return {
    winners: [],
    losers: [],
    sortedAt: 0,
  };
}
