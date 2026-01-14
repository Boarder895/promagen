// src/components/ribbon/commodities-ribbon.container.tsx
//
// Container/orchestrator for Commodities ribbon (API Brain compliant):
// - Polls /api/commodities via centralised hook.
// - Joins SSOT commodity metadata + API quotes.
// - Preserves SSOT order end-to-end (no re-sorting).
// - Passes tooltip data (year first traded, fact) + brand colour to ribbon.
// - Formats prices with currency and trading unit for clarity.
//
// Refresh schedule (coordinated with FX and Crypto):
// - FX:          :00, :30 (base)
// - Commodities: :10, :40 (10 min offset)
// - Crypto:      :20, :50 (20 min offset)
//
// Existing features preserved: Yes

'use client';

import React, { useMemo } from 'react';

import CommoditiesRibbon, {
  type CommoditiesRibbonChip,
} from '@/components/ribbon/commodities-ribbon';
import type { RichTooltipLine } from '@/components/ui/rich-tooltip';
import { useCommoditiesQuotes } from '@/hooks/use-commodities-quotes';
import { getDefaultFreeCommodities } from '@/lib/commodities/catalog';

// ============================================================================
// BRAND COLOURS - Vibrant and visible on dark backgrounds
// ============================================================================

const COMMODITY_BRAND_COLOURS: Record<string, string> = {
  // Energy - vibrant colours
  brent_crude: '#EF4444',       // Brent - red (was charcoal - invisible)
  wti_crude: '#F97316',         // WTI - orange (was dark - invisible)
  ttf_natural_gas: '#00CED1',   // TTF Gas - cyan
  henry_hub_gas: '#00B4D8',     // Henry Hub - sky cyan

  // Precious metals
  gold: '#FFD700',              // Gold
  silver: '#C0C0C0',            // Silver
  platinum: '#E5E4E2',          // Platinum
  palladium: '#CED0CE',         // Palladium

  // Base metals - more vibrant
  copper: '#F97316',            // Copper - orange (more visible)
  aluminum: '#94A3B8',          // Aluminum - slate
  zinc: '#A1A1AA',              // Zinc - warm grey
  nickel: '#84CC16',            // Nickel - lime green
  lead: '#78716C',              // Lead - stone
  tin: '#E2E8F0',               // Tin - bright silver

  // Agriculture - Grains
  wheat: '#F59E0B',             // Wheat - amber
  corn: '#FACC15',              // Corn - yellow
  soybeans: '#A3E635',          // Soybean - lime
  rice: '#FEF3C7',              // Rice - cream
  oats: '#D97706',              // Oats - orange

  // Agriculture - Softs - VIBRANT
  coffee: '#DC2626',            // Coffee - red (was brown - too muted)
  sugar: '#A855F7',             // Sugar - purple (was cream - invisible)
  cocoa: '#92400E',             // Cocoa - amber brown
  cotton: '#F8FAFC',            // Cotton - white
  orange_juice: '#FB923C',      // Orange juice - orange

  // Livestock
  live_cattle: '#B45309',       // Cattle - amber brown
  lean_hogs: '#EC4899',         // Pork - pink
  feeder_cattle: '#C2410C',     // Sienna

  // Industrial
  iron_ore: '#B7410E',          // Rust
  lumber: '#CA8A04',            // Wood - yellow
  rubber: '#475569',            // Dark slate
};

// Default fallback
const DEFAULT_COMMODITY_COLOUR = '#38BDF8'; // Cyan

// ============================================================================
// TRADING UNITS BY COMMODITY TYPE
// ============================================================================

const COMMODITY_UNITS: Record<string, string> = {
  // Energy
  brent_crude: '/bbl',
  wti_crude: '/bbl',
  ttf_natural_gas: '/MWh',
  henry_hub_gas: '/MMBtu',

  // Precious metals (per troy ounce)
  gold: '/oz',
  silver: '/oz',
  platinum: '/oz',
  palladium: '/oz',

  // Base metals (per metric ton or pound)
  copper: '/lb',
  aluminum: '/MT',
  zinc: '/MT',
  nickel: '/MT',
  lead: '/MT',
  tin: '/MT',

  // Grains (per bushel)
  wheat: '/bu',
  corn: '/bu',
  soybeans: '/bu',
  rice: '/cwt',
  oats: '/bu',

  // Softs
  coffee: '/lb',
  sugar: '/lb',
  cocoa: '/MT',
  cotton: '/lb',
  orange_juice: '/lb',

  // Livestock
  live_cattle: '/lb',
  lean_hogs: '/lb',
  feeder_cattle: '/lb',

  // Industrial
  iron_ore: '/MT',
  lumber: '/MBF',
  rubber: '/kg',
};

// ============================================================================
// PRICE FORMATTING
// ============================================================================

/**
 * Format commodity price with currency and trading unit.
 * Example: "$74.30 /bbl" or "$2,630.50 /oz"
 */
function formatCommodityPrice(value: number, unit: string, quoteCurrency: string = 'USD'): string {
  if (!Number.isFinite(value)) return '—';

  // Determine currency symbol
  const currencySymbol = quoteCurrency === 'EUR' ? '€' : '$';

  // Format with appropriate decimals
  let formatted: string;

  if (value >= 1000) {
    // Large values: $2,630.50
    formatted = value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } else if (value >= 10) {
    // Medium values: $74.30
    formatted = value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } else if (value >= 1) {
    // Small values: $3.25
    formatted = value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 3,
    });
  } else {
    // Very small values: $0.1234
    formatted = value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  }

  return `${currencySymbol}${formatted} ${unit}`;
}

// ============================================================================
// TOOLTIP BUILDER
// ============================================================================

/**
 * Build tooltip lines for a commodity.
 * Returns structured data for the RichTooltip component.
 */
function buildCommodityTooltipLines(commodity: {
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
// COMPONENT
// ============================================================================

export default function CommoditiesRibbonContainer() {
  // DISABLED: Commodities feed is currently off to reduce API costs
  // Set enabled: true when ready to re-enable
  const { quotes, movementById } = useCommoditiesQuotes({
    enabled: false,
  });

  const ssot = useMemo(() => getDefaultFreeCommodities(), []);

  const chipData: CommoditiesRibbonChip[] = useMemo(() => {
    const byId = new Map<string, { value: number; prevClose: number }>();
    for (const q of quotes) {
      byId.set(q.id, { value: q.value, prevClose: q.prevClose });
    }

    return ssot.map((c) => {
      const q = byId.get(c.id);
      const movement = movementById[c.id];

      // Get unit for this commodity
      const unit = COMMODITY_UNITS[c.id] ?? '';

      // Get quote currency (default to USD)
      const quoteCurrency = (c as { quoteCurrency?: string }).quoteCurrency ?? 'USD';

      // Format price with currency and unit
      const priceText = q
        ? formatCommodityPrice(q.value, unit, quoteCurrency)
        : '—';

      // Use shortName which has descriptive labels
      const label = (
        <span className="inline-flex items-center gap-1">
          <span aria-hidden="true">{c.emoji}</span>
          <span className="font-medium">{c.shortName ?? c.name}</span>
        </span>
      );

      // Build tooltip data from catalog
      const tooltipLines = buildCommodityTooltipLines(c as {
        yearFirstTraded?: number;
        fact?: string;
      });

      // Get brand colour for this commodity
      const glowColour = COMMODITY_BRAND_COLOURS[c.id] ?? DEFAULT_COMMODITY_COLOUR;

      return {
        id: c.id,
        label,
        priceText,
        tick: movement?.tick ?? 'flat',
        deltaPct: movement?.deltaPct ?? null,
        tooltipTitle: c.name,
        tooltipLines,
        glowColour,
      };
    });
  }, [quotes, ssot, movementById]);

  return <CommoditiesRibbon chips={chipData} />;
}
