// src/lib/commodities/sort-movers.ts
// ============================================================================
// COMMODITIES MOVERS SORTER
// ============================================================================
// Utility to sort 78 commodities by % change and extract:
// - Top 4 winners (highest positive % change)
// - Top 4 losers (lowest/most negative % change)
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
// Design decisions:
// - Only commodities with valid price data are considered
// - Ties broken by absolute magnitude (bigger move wins)
// - Stale data (null deltaPct) excluded from ranking
// - Units extracted from catalog's ribbonSubtext field (e.g., "USD/BBL" → "/bbl")
//
// Authority: Compacted conversation 2026-02-04
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
  formatSmartConversionLines,
  formatZarPrice,
  getCurrencyCountryCode,
  usdToZarCrossRate,
} from '@/lib/commodities/convert';

// ============================================================================
// BRAND COLOURS - Migrated from commodities-ribbon.container.tsx
// ============================================================================

const COMMODITY_BRAND_COLOURS: Record<string, string> = {
  // Energy - vibrant colours
  brent_crude: '#EF4444',
  brent: '#EF4444',
  wti_crude: '#F97316',
  wti: '#F97316',
  ttf_natural_gas: '#00CED1',
  henry_hub_gas: '#00B4D8',

  // Precious metals
  gold: '#FFD700',
  silver: '#C0C0C0',
  platinum: '#E5E4E2',
  palladium: '#CED0CE',

  // Base metals - more vibrant
  copper: '#F97316',
  aluminum: '#94A3B8',
  zinc: '#A1A1AA',
  nickel: '#84CC16',
  lead: '#78716C',
  tin: '#E2E8F0',

  // Agriculture - Grains
  wheat: '#F59E0B',
  corn: '#FACC15',
  soybeans: '#A3E635',
  rice: '#FEF3C7',
  oats: '#D97706',

  // Agriculture - Softs - VIBRANT
  coffee: '#DC2626',
  sugar: '#A855F7',
  cocoa: '#92400E',
  cotton: '#F8FAFC',
  orange_juice: '#FB923C',

  // Livestock
  live_cattle: '#B45309',
  lean_hogs: '#EC4899',
  feeder_cattle: '#C2410C',

  // Industrial
  iron_ore: '#B7410E',
  lumber: '#CA8A04',
  rubber: '#475569',
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

  // Return with leading slash for price display (e.g., "$63.34/bbl")
  return `/${unitPart.toLowerCase()}`;
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

  let formatted: string;

  if (value >= 1000) {
    formatted = value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } else if (value >= 10) {
    formatted = value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } else if (value >= 1) {
    formatted = value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 3,
    });
  } else {
    formatted = value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  }

  // Format: "$63.34/bbl" (no space between price and unit)
  return `${currencySymbol}${formatted}${unit}`;
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
      const converted = convertCommodityPrice(
        item.quote.value,
        quoteCurrency,
        conversionRates,
      );
      priceEur = converted.eur;
      priceGbp = converted.gbp;
      priceUsd = converted.usd;
      eurGbpText = formatEurGbpLine(priceEur, priceGbp);

      if (isGold) {
        // ====================================================================
        // GOLD: ZAR as primary, EUR/GBP/USD as conversion lines
        // ====================================================================
        // Gold API price is in USD, convert to ZAR via cross-rate
        priceZar = usdToZarCrossRate(item.quote.value, conversionRates);
        
        // Primary display is ZAR
        if (priceZar !== null) {
          primaryPriceText = `${formatZarPrice(priceZar)}${unit}`;
        }
        
        // Conversion lines: EUR, GBP, USD (original price)
        conversionLine1 = {
          countryCode: 'EU',
          priceText: priceEur !== null ? `€${priceEur.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—',
        };
        conversionLine2 = {
          countryCode: 'GB',
          priceText: priceGbp !== null ? `£${priceGbp.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—',
        };
        conversionLine3 = {
          countryCode: 'US',
          priceText: `$${item.quote.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        };
      } else {
        // ====================================================================
        // ALL OTHER COMMODITIES: Standard smart conversion lines
        // ====================================================================
        const smartLines = formatSmartConversionLines(
          quoteCurrency,
          priceEur,
          priceGbp,
          priceUsd,
        );
        conversionLine1 = smartLines.line1;
        conversionLine2 = smartLines.line2;
        conversionLine3 = smartLines.line3;
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
