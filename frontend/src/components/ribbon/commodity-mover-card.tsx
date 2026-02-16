// src/components/ribbon/commodity-mover-card.tsx
// ============================================================================
// COMMODITY MOVER CARD — v4.0 (5-LINE UNIFORM LAYOUT)
// ============================================================================
// Layout:
//   Line 1 (20%): 🥈 Silver           (emoji + name)
//   Line 2 (20%): 🇺🇸 $89.77/oz       (flag + base price with unit)
//   Line 3 (20%): ▲ +5.50%            (delta + arrow)
//   Line 4 (20%): 🇪🇺 €82.43           (EUR conversion — amber branded)
//   Line 5 (20%): 🇬🇧 £69.33           (GBP conversion — purple branded)
//
// Every card is exactly 5 lines — no conditional 3rd conversion line,
// no divider. All content right-aligned within each row. All sizing
// via clamp() relative to --commodity-font CSS variable.
//
// Currency-Branded Colours (unchanged):
// - USD ($): text-cyan-400    — cool financial blue
// - EUR (€): text-amber-400   — warm gold tone
// - GBP (£): text-purple-400  — regal purple
// - Other:   text-slate-400   — neutral fallback
//
// v4.0: 5-line uniform grid, right-aligned, drop line3, drop divider (16 Feb 2026)
// v3.1: Per-flag tooltip (10–12 Feb 2026)
// v2.5: Currency-branded colours + divider (8 Feb 2026)
//
// Authority: commodities.md, code-standard.md
// Existing features preserved: Yes (tooltips, flags, branded colours, stale indicator)
// ============================================================================

'use client';

import React from 'react';

import type { CommodityMoverCardProps } from '@/types/commodities-movers';
import { Flag } from '@/components/ui/flag';
import { CommodityPromptTooltip } from '@/components/ribbon/commodity-prompt-tooltip';
import { useCommodityTooltipData } from '@/hooks/use-commodity-tooltip-data';
import { resolveWeather, deriveSeason } from '@/lib/commodities/country-weather-resolver';
import type { CommodityWeatherSlice } from '@/lib/commodities/commodity-prompt-types';

function formatDeltaPct(deltaPct: number): string {
  if (!Number.isFinite(deltaPct)) return '—';
  const sign = deltaPct >= 0 ? '+' : '';
  return `${sign}${deltaPct.toFixed(2)}%`.replace('-', '−');
}

/** Currency-branded colour class by country code */
function currencyColorClass(countryCode: string): string {
  switch (countryCode) {
    case 'US':
      return 'text-cyan-400';
    case 'EU':
      return 'text-amber-400';
    case 'GB':
      return 'text-purple-400';
    default:
      return 'text-slate-400';
  }
}

export default function CommodityMoverCard({
  data,
  isStale = false,
  weatherRecord,
}: CommodityMoverCardProps): React.ReactElement {
  const {
    id,
    name,
    shortName,
    emoji,
    priceText,
    conversionLine1,
    conversionLine2,
    // conversionLine3 intentionally ignored — uniform 5-line layout
    baseFlagCode,
    deltaPct,
    direction,
  } = data;

  // Resolve group + availability from catalog (shared across all flags)
  const tooltipData = useCommodityTooltipData(id, deltaPct);

  // ---- Per-flag weather resolution helper ----
  function buildWeatherSlice(countryCode: string): CommodityWeatherSlice | null {
    if (!weatherRecord) return null;
    const resolution = resolveWeather(countryCode);
    if (!resolution) return null;
    const wx = weatherRecord[resolution.exchangeId];
    if (!wx) return null;
    return { temperatureC: wx.temperatureC, description: wx.description };
  }

  // ---- Per-flag tooltip props builder ----
  function buildTooltipProps(flagCountryCode: string, flagIndex: number) {
    return {
      commodityId: id,
      commodityName: name,
      group: tooltipData.group,
      deltaPct,
      sceneCountryCode: flagCountryCode,
      season: deriveSeason(flagCountryCode) ?? ('summer' as const),
      weather: buildWeatherSlice(flagCountryCode),
      disabled: !tooltipData.available,
      verticalPosition: 'below' as const,
      flagIndex,
    };
  }

  const deltaColorClass = direction === 'winner' ? 'text-emerald-400' : 'text-red-400';

  const arrowIcon =
    direction === 'winner' ? (
      <svg
        className="text-emerald-400 flex-shrink-0"
        style={{ width: '1em', height: '1em' }}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg
        className="text-red-400 flex-shrink-0"
        style={{ width: '1em', height: '1em' }}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
      </svg>
    );

  // Flag size scales with the font — em-based so it tracks --commodity-font
  const flagSizeStyle = { width: '1.1em', height: '0.8em' };

  return (
    <div
      className="relative grid h-full w-full"
      style={{
        fontSize: 'var(--commodity-font, 18px)',
        gridTemplateRows: 'repeat(5, 1fr)',
        padding: 'clamp(2px, 0.3vw, 6px) clamp(6px, 0.8vw, 14px)',
      }}
    >
      {/* LINE 1 — Emoji + Name */}
      <div className="flex items-center justify-start gap-1 min-w-0">
        <span
          className="leading-none flex-shrink-0"
          style={{ fontSize: '0.85em' }}
          aria-hidden="true"
        >
          {emoji}
        </span>
        <span
          className="font-semibold text-white leading-tight whitespace-nowrap truncate"
          style={{ fontSize: 'clamp(9px, 0.65em, 18px)' }}
        >
          {shortName || name}
        </span>
      </div>

      {/* LINE 2 — Flag + Base Price with Unit */}
      <div
        className="flex items-center justify-start gap-1.5 min-w-0"
        data-testid="commodity-price"
      >
        {baseFlagCode && (
          <CommodityPromptTooltip {...buildTooltipProps(tooltipData.sceneCountryCode, 0)}>
            <span className="flex-shrink-0 inline-flex" style={flagSizeStyle}>
              <Flag countryCode={baseFlagCode} size={20} />
            </span>
          </CommodityPromptTooltip>
        )}
        <span
          className="text-white tabular-nums leading-tight whitespace-nowrap truncate"
          style={{ fontSize: 'clamp(8px, 0.55em, 15px)' }}
        >
          {priceText || '—'}
        </span>
      </div>

      {/* LINE 3 — Delta with arrow */}
      <div
        className={`flex items-center justify-start gap-1 min-w-0 ${deltaColorClass}`}
        data-testid="commodity-delta"
      >
        {arrowIcon}
        <span
          className="font-bold tabular-nums whitespace-nowrap"
          style={{ fontSize: 'clamp(8px, 0.55em, 15px)' }}
        >
          {formatDeltaPct(deltaPct)}
        </span>
      </div>

      {/* LINE 4 — Conversion 1 (typically EUR) */}
      <div
        className={`flex items-center justify-start gap-1.5 min-w-0 ${currencyColorClass(conversionLine1.countryCode)}`}
        aria-label={`Price in ${conversionLine1.countryCode}`}
      >
        <CommodityPromptTooltip {...buildTooltipProps(conversionLine1.countryCode, 1)}>
          <span className="flex-shrink-0 inline-flex" style={flagSizeStyle}>
            <Flag countryCode={conversionLine1.countryCode} size={20} />
          </span>
        </CommodityPromptTooltip>
        <span
          className="tabular-nums leading-tight whitespace-nowrap truncate"
          style={{ fontSize: 'clamp(8px, 0.55em, 15px)' }}
        >
          {conversionLine1.priceText}
        </span>
      </div>

      {/* LINE 5 — Conversion 2 (typically GBP) */}
      <div
        className={`flex items-center justify-start gap-1.5 min-w-0 ${currencyColorClass(conversionLine2.countryCode)}`}
        aria-label={`Price in ${conversionLine2.countryCode}`}
      >
        <CommodityPromptTooltip {...buildTooltipProps(conversionLine2.countryCode, 2)}>
          <span className="flex-shrink-0 inline-flex" style={flagSizeStyle}>
            <Flag countryCode={conversionLine2.countryCode} size={20} />
          </span>
        </CommodityPromptTooltip>
        <span
          className="tabular-nums leading-tight whitespace-nowrap truncate"
          style={{ fontSize: 'clamp(8px, 0.55em, 15px)' }}
        >
          {conversionLine2.priceText}
        </span>
      </div>

      {/* Stale indicator */}
      {isStale && (
        <span
          className="absolute top-0.5 right-1 text-amber-400/70 animate-pulse"
          style={{ fontSize: 'clamp(7px, 0.45em, 12px)' }}
          aria-label="Updating prices"
        >
          ⟳
        </span>
      )}
    </div>
  );
}

// ============================================================================
// SKELETON
// ============================================================================

export function CommodityMoverCardSkeleton(): React.ReactElement {
  return (
    <div
      className="grid h-full w-full animate-pulse"
      style={{
        fontSize: 'var(--commodity-font, 18px)',
        gridTemplateRows: 'repeat(5, 1fr)',
        padding: 'clamp(2px, 0.3vw, 6px) clamp(6px, 0.8vw, 14px)',
      }}
    >
      {/* Line 1: Emoji + Name */}
      <div className="flex items-center justify-start gap-1">
        <div className="rounded-full bg-white/10" style={{ width: '1em', height: '1em' }} />
        <div className="rounded bg-white/10" style={{ width: '3em', height: '0.7em' }} />
      </div>
      {/* Line 2: Flag + Price */}
      <div className="flex items-center justify-start gap-1">
        <div className="rounded bg-white/10" style={{ width: '0.9em', height: '0.7em' }} />
        <div className="rounded bg-white/10" style={{ width: '4em', height: '0.6em' }} />
      </div>
      {/* Line 3: Delta */}
      <div className="flex items-center justify-start gap-1">
        <div className="rounded bg-white/10" style={{ width: '0.8em', height: '0.8em' }} />
        <div className="rounded bg-white/10" style={{ width: '2.5em', height: '0.6em' }} />
      </div>
      {/* Line 4: Conversion 1 */}
      <div className="flex items-center justify-start gap-1">
        <div className="rounded bg-white/10" style={{ width: '0.9em', height: '0.7em' }} />
        <div className="rounded bg-white/10" style={{ width: '3em', height: '0.5em' }} />
      </div>
      {/* Line 5: Conversion 2 */}
      <div className="flex items-center justify-start gap-1">
        <div className="rounded bg-white/10" style={{ width: '0.9em', height: '0.7em' }} />
        <div className="rounded bg-white/10" style={{ width: '3em', height: '0.5em' }} />
      </div>
    </div>
  );
}
