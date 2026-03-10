// src/components/ribbon/commodity-mover-card.tsx
// ============================================================================
// COMMODITY MOVER CARD — v8.0 (FACT TOOLTIP + CENTRED LAYOUT)
// ============================================================================
//
// Layout:
//   Line 1 (1fr): 🥈 Silver                        (emoji + centred name, coloured by group)
//   Line 2 (1fr): 🇺🇸 $ 30.18/oz     ▲ +1.85%       (flag + price left, delta right double-sized)
//   Line 3 (1fr): 🇪🇺 € 27.83 / g  ↔  🇬🇧 £ 25.44 / g (alternating conversion, 8s crossfade)
//
// v7.0 changes:
//   - Hover glow matching exchange-card.tsx (ethereal radial gradients + boxShadow)
//   - Each commodity glows its own brandColor (Gold=gold, Brent=red, etc.)
//   - Name centred and coloured by group: energy=red, metals=sky, agriculture=lime
//   - Flag rendering matches exchange-card: Flag size={20}, no inline size override
//   - Font size bumped +1 via grid constants
//
// Human factors:
//   §6  Temporal Compression — 8s crossfade feels like breathing
//   §12 Von Restorff — magnitude brightness makes big movers glow
//   §17 Dark Interface Colour — brightness scaling within green/red
//
// Currency-Branded Colours:
//   USD ($): text-cyan-400   — cool financial blue
//   EUR (€): text-amber-400  — warm gold tone
//   GBP (£): text-purple-400 — regal purple
//   Other:   text-slate-400  — neutral fallback
//
// v7.0: Glow + group colour + centred name + flag match (8 Mar 2026)
// v6.0: 3-line clean (8 Mar 2026) — stripped sparklines, fake data, guessed maps
// v5.0: Human factors overreach (8 Mar 2026) — REVERTED
// v4.0: 5-line uniform grid (16 Feb 2026)
//
// Authority: commodities.md, code-standard.md, human-factors.md
// Existing features preserved: Yes (tooltips, flags, branded colours, stale, crossfade)
// ============================================================================

'use client';

import React, { useState } from 'react';

import type { CommodityMoverCardProps } from '@/types/commodities-movers';
import { Flag } from '@/components/ui/flag';
import { CommodityPromptTooltip } from '@/components/ribbon/commodity-prompt-tooltip';
import { CommodityFactTooltip } from '@/components/ribbon/commodity-fact-tooltip';
import { useCommodityTooltipData } from '@/hooks/use-commodity-tooltip-data';
import { useGlobalPromptTier } from '@/hooks/use-global-prompt-tier';
import { resolveWeather, deriveSeason } from '@/lib/commodities/country-weather-resolver';
import type { CommodityWeatherSlice } from '@/lib/commodities/commodity-prompt-types';

// ============================================================================
// HELPERS
// ============================================================================

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

/** Brightness multiplier based on delta magnitude (Von Restorff §12) */
function deltaBrightness(deltaPct: number): string {
  const abs = Math.abs(deltaPct);
  if (abs >= 5) return 'brightness(1.5)';
  if (abs >= 3) return 'brightness(1.35)';
  if (abs >= 1.5) return 'brightness(1.2)';
  if (abs >= 0.5) return 'brightness(1.05)';
  return 'brightness(0.8)';
}

// ── Glow utilities (same pattern as exchange-card.tsx) ─────────────────

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const FALLBACK_HEX = '#38BDF8';

function safeHex(color: string | undefined): string {
  if (!color) return FALLBACK_HEX;
  return HEX_RE.test(color) ? color : FALLBACK_HEX;
}

function hexToRgba(hex: string, alpha: number): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(56, 189, 248, ${alpha})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CommodityMoverCard({
  data,
  isStale = false,
  weatherRecord,
  currencyTick = 0,
}: CommodityMoverCardProps): React.ReactElement {
  const {
    id,
    name,
    shortName,
    emoji,
    priceText,
    conversionLine1,
    conversionLine2,
    conversionLine3,
    baseFlagCode,
    deltaPct,
    direction,
    brandColor,
    fact,
    yearFirstTraded,
  } = data;

  const [isHovered, setIsHovered] = useState(false);

  // ── Global prompt tier (user's Pro selection) ──────────────────────
  const { tier: globalTier, isPro } = useGlobalPromptTier();

  // ── Tooltip resolution (shared across all flags) ────────────────────
  const tooltipData = useCommodityTooltipData(id, deltaPct);

  function buildWeatherSlice(countryCode: string): CommodityWeatherSlice | null {
    if (!weatherRecord) return null;
    const resolution = resolveWeather(countryCode);
    if (!resolution) return null;
    const wx = weatherRecord[resolution.exchangeId];
    if (!wx) return null;
    return { temperatureC: wx.temperatureC, description: wx.description };
  }

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
      tier: globalTier,
      isPro,
    };
  }

  // ── Currency alternation ────────────────────────────────────────────
  const conversions = conversionLine3
    ? [conversionLine1, conversionLine2, conversionLine3]
    : [conversionLine1, conversionLine2];
  const phase = currencyTick % conversions.length;

  // ── Styling ─────────────────────────────────────────────────────────
  const deltaColorClass = direction === 'winner' ? 'text-emerald-400' : 'text-red-400';
  const arrowChar = direction === 'winner' ? '▲' : '▼';

  // ── Hover glow (matches exchange-card.tsx pattern) ──────────────────
  const hoverHex = safeHex(brandColor);
  const glowRgba = hexToRgba(hoverHex, 0.5);
  const glowSoft = hexToRgba(hoverHex, 0.3);

  const cardStyle: React.CSSProperties = {
    fontSize: 'var(--commodity-font, 18px)',
    gridTemplateRows: 'repeat(3, 1fr)',
    padding: 'clamp(2px, 0.3vw, 6px) clamp(6px, 0.8vw, 14px)',
    background: isHovered ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.05)',
    borderRadius: 'clamp(8px, 0.6vw, 12px)',
    border: `2px solid ${hoverHex}`,
    boxShadow: isHovered
      ? `0 0 30px 6px ${glowRgba}, 0 0 60px 12px ${glowSoft}, inset 0 0 20px 2px ${glowRgba}`
      : 'none',
    transition: 'box-shadow 200ms ease-out, background 200ms ease-out',
  };

  return (
    <div
      className="relative grid h-full w-full"
      style={cardStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Ethereal glow — top radial (matches exchange-card) */}
      {isHovered && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at 50% 0%, ${glowRgba} 0%, transparent 70%)`,
            opacity: 0.6,
            borderRadius: 'inherit',
          }}
        />
      )}
      {/* Ethereal glow — bottom radial */}
      {isHovered && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at 50% 100%, ${glowSoft} 0%, transparent 60%)`,
            opacity: 0.4,
            borderRadius: 'inherit',
          }}
        />
      )}

      {/* LINE 1 — Emoji (fact tooltip) + Name (white, centred) */}
      <div className="flex items-center justify-center gap-1 min-w-0 relative z-10">
        <CommodityFactTooltip
          name={name}
          fact={fact}
          yearFirstTraded={yearFirstTraded}
          brandColor={brandColor}
        >
          <span
            className="leading-none flex-shrink-0"
            style={{ fontSize: '0.85em' }}
            aria-hidden="true"
          >
            {emoji}
          </span>
        </CommodityFactTooltip>
        <span
          className="font-semibold text-white leading-tight whitespace-nowrap truncate"
          style={{ fontSize: 'clamp(9px, 0.75em, 23px)' }}
        >
          {shortName || name}
        </span>
      </div>

      {/* LINE 2 — Flag + Base Price + Delta (centred, 3ch gaps, 🔥 ≥3%) */}
      <div
        className="flex items-center justify-center min-w-0 relative z-10"
        style={{ gap: '3ch' }}
        data-testid="commodity-price"
      >
        <span className="flex items-center shrink-0" style={{ gap: 'clamp(6px, 0.6vw, 10px)' }}>
          {baseFlagCode && (
            <CommodityPromptTooltip {...buildTooltipProps(tooltipData.sceneCountryCode, 0)}>
              <span title="" className="shrink-0 inline-flex">
                <Flag countryCode={baseFlagCode} size={24} decorative={false} className="shrink-0 cursor-pointer" />
              </span>
            </CommodityPromptTooltip>
          )}
          <span
            className="text-white tabular-nums leading-tight whitespace-nowrap"
            style={{ fontSize: 'clamp(8px, 0.6em, 15px)' }}
          >
            {priceText || '—'}
          </span>
        </span>
        <span
          className={`font-bold tabular-nums whitespace-nowrap flex-shrink-0 ${deltaColorClass}`}
          style={{
            fontSize: 'clamp(10px, 0.9em, 20px)',
            filter: deltaBrightness(deltaPct),
          }}
          data-testid="commodity-delta"
        >
          {arrowChar} {formatDeltaPct(deltaPct)}{Math.abs(deltaPct) >= 3 ? ' 🔥' : ''}
        </span>
      </div>

      {/* LINE 3 — Alternating Currency Conversion (only active phase gets tooltip) */}
      <div className="relative flex items-center justify-center min-w-0 overflow-hidden z-10">
        {conversions.map((conv, idx) => {
          const isActive = idx === phase;
          return (
            <div
              key={conv.countryCode}
              className={`absolute inset-0 flex items-center justify-center min-w-0 ${currencyColorClass(conv.countryCode)}`}
              style={{
                gap: 'clamp(16px, 1.5vw, 30px)',
                opacity: isActive ? 1 : 0,
                transition: 'opacity 200ms ease',
                pointerEvents: isActive ? 'auto' : 'none',
              }}
              aria-hidden={!isActive}
              aria-label={isActive ? `Price in ${conv.countryCode}` : undefined}
            >
              {isActive ? (
                <CommodityPromptTooltip {...buildTooltipProps(conv.countryCode, idx + 1)}>
                  <span title="" className="shrink-0 inline-flex">
                    <Flag countryCode={conv.countryCode} size={24} decorative={false} className="shrink-0 cursor-pointer" />
                  </span>
                </CommodityPromptTooltip>
              ) : (
                <span className="shrink-0 inline-flex">
                  <Flag countryCode={conv.countryCode} size={24} decorative className="shrink-0" />
                </span>
              )}
              <span
                className="tabular-nums leading-tight whitespace-nowrap truncate"
                style={{ fontSize: 'clamp(10px, 0.8em, 18px)' }}
              >
                {conv.priceText}
              </span>
            </div>
          );
        })}
      </div>

      {/* Stale indicator */}
      {isStale && (
        <span
          className="absolute top-0.5 right-1 text-amber-400/70 animate-pulse z-20"
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
        gridTemplateRows: 'repeat(3, 1fr)',
        padding: 'clamp(2px, 0.3vw, 6px) clamp(6px, 0.8vw, 14px)',
      }}
    >
      {/* Line 1: Emoji + Name */}
      <div className="flex items-center justify-start gap-1">
        <div className="rounded-full bg-white/10" style={{ width: '1em', height: '1em' }} />
        <div className="rounded bg-white/10" style={{ width: '3em', height: '0.7em' }} />
      </div>
      {/* Line 2: Flag + Price + Delta */}
      <div className="flex items-center justify-start gap-1">
        <div className="rounded bg-white/10" style={{ width: '0.9em', height: '0.7em' }} />
        <div className="rounded bg-white/10" style={{ width: '4em', height: '0.6em' }} />
        <div className="ml-auto rounded bg-white/10" style={{ width: '3em', height: '0.8em' }} />
      </div>
      {/* Line 3: Conversion */}
      <div className="flex items-center justify-start gap-1">
        <div className="rounded bg-white/10" style={{ width: '0.9em', height: '0.7em' }} />
        <div className="rounded bg-white/10" style={{ width: '3em', height: '0.5em' }} />
      </div>
    </div>
  );
}
