// src/components/ribbon/commodity-mover-card.tsx
// ============================================================================
// COMMODITY MOVER CARD
// ============================================================================
// Layout (v2.4):
//   Row 1: 🥈 Silver           (emoji + name side by side)
//   Row 2: 🇺🇸 $89.77/oz       (flag + base price with unit)
//   Row 3: ▲ +5.50%            (delta + arrow)
//   Row 4: 🇪🇺 €82.43           (first conversion with Flag component)
//   Row 5: 🇬🇧 £69.33           (second conversion with Flag component)
//   Row 6: 🇺🇸 $89.77           (third conversion - only for non-USD/EUR/GBP)
//
// Smart Currency Logic:
// - Base USD: Show EUR + GBP (2 lines)
// - Base EUR: Show USD + GBP (2 lines, avoids EUR→EUR)
// - Base GBP: Show USD + EUR (2 lines, avoids GBP→GBP)
// - Base other (INR, BRL, etc.): Show EUR + GBP + USD (3 lines)
//
// Uses CSS variable --commodity-font for snap-fit sizing.
// Uses Flag component (SVG with emoji fallback) for Windows compatibility.
//
// v2.4: Flag component for ALL flag displays (5 Feb 2026)
// v2.3: Flag emoji on base price + 3-line support (5 Feb 2026)
// v2.2: Stacked conversion lines with flag emojis (5 Feb 2026)
// v2.1: EUR/GBP Conversion Support (4 Feb 2026)
//
// Authority: Compacted conversation 2026-02-04
// Existing features preserved: Yes
// ============================================================================

'use client';

import React from 'react';

import type { CommodityMoverCardProps } from '@/types/commodities-movers';
import { Flag } from '@/components/ui/flag';

function formatDeltaPct(deltaPct: number): string {
  if (!Number.isFinite(deltaPct)) return '—';
  const sign = deltaPct >= 0 ? '+' : '';
  return `${sign}${deltaPct.toFixed(2)}%`.replace('-', '−');
}

export default function CommodityMoverCard({
  data,
  isStale = false,
}: CommodityMoverCardProps): React.ReactElement {
  const {
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
  } = data;

  const deltaColorClass = direction === 'winner' ? 'text-emerald-400' : 'text-red-400';

  const arrowIcon =
    direction === 'winner' ? (
      <svg
        className="text-emerald-400 flex-shrink-0"
        style={{ width: '1.2em', height: '1.2em' }}
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
        style={{ width: '1.2em', height: '1.2em' }}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
      </svg>
    );

  return (
    <div
      className="relative flex flex-col items-center justify-center text-center p-4"
      style={{ fontSize: 'var(--commodity-font, 18px)' }}
    >
      {/* ROW 1: Emoji + Name (side by side) */}
      <div className="flex items-center justify-center gap-2">
        <span
          className="leading-none"
          style={{ fontSize: '1.5em' }}
          aria-hidden="true"
        >
          {emoji}
        </span>
        <span
          className="font-semibold text-white leading-tight whitespace-nowrap"
          style={{ fontSize: '1em' }}
        >
          {shortName || name}
        </span>
      </div>

      {/* ROW 2: Flag + Base Price with Unit */}
      <div
        className="flex items-center justify-center gap-1.5 mt-2"
        data-testid="commodity-price"
      >
        {baseFlagCode && (
          <Flag countryCode={baseFlagCode} size={14} />
        )}
        <span
          className="text-white tabular-nums leading-tight whitespace-nowrap"
          style={{ fontSize: '0.9em' }}
        >
          {priceText || '—'}
        </span>
      </div>

      {/* ROW 3: Delta with arrow */}
      <span
        className={`flex items-center gap-1.5 font-bold tabular-nums whitespace-nowrap mt-2 ${deltaColorClass}`}
        style={{ fontSize: '0.9em' }}
        data-testid="commodity-delta"
      >
        {arrowIcon}
        {formatDeltaPct(deltaPct)}
      </span>

      {/* ROW 4-6: Currency conversions with Flag components (v2.4) */}
      <div
        className="flex flex-col items-center mt-2 space-y-0.5"
        data-testid="commodity-conversions"
        aria-label="Equivalent prices in other currencies"
      >
        {/* Line 1 */}
        <span
          className="flex items-center gap-1 text-slate-400 tabular-nums leading-tight whitespace-nowrap"
          style={{ fontSize: '0.7em' }}
        >
          <Flag countryCode={conversionLine1.countryCode} size={12} />
          <span>{conversionLine1.priceText}</span>
        </span>

        {/* Line 2 */}
        <span
          className="flex items-center gap-1 text-slate-400 tabular-nums leading-tight whitespace-nowrap"
          style={{ fontSize: '0.7em' }}
        >
          <Flag countryCode={conversionLine2.countryCode} size={12} />
          <span>{conversionLine2.priceText}</span>
        </span>

        {/* Line 3 - only for non-USD/EUR/GBP commodities */}
        {conversionLine3 && (
          <span
            className="flex items-center gap-1 text-slate-400 tabular-nums leading-tight whitespace-nowrap"
            style={{ fontSize: '0.7em' }}
          >
            <Flag countryCode={conversionLine3.countryCode} size={12} />
            <span>{conversionLine3.priceText}</span>
          </span>
        )}
      </div>

      {/* Stale indicator */}
      {isStale && (
        <span
          className="absolute top-1 right-1 text-amber-400/70 animate-pulse"
          style={{ fontSize: '0.5em' }}
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
      className="flex flex-col items-center justify-center p-4 animate-pulse"
      style={{ fontSize: 'var(--commodity-font, 18px)' }}
    >
      {/* Row 1: Emoji + Name skeleton */}
      <div className="flex items-center gap-2">
        <div className="rounded-full bg-white/10" style={{ width: '1.5em', height: '1.5em' }} />
        <div className="rounded bg-white/10" style={{ width: '3em', height: '1em' }} />
      </div>

      {/* Row 2: Flag + Base Price skeleton */}
      <div className="flex items-center gap-1.5 mt-2">
        <div className="rounded bg-white/10" style={{ width: '14px', height: '14px' }} />
        <div className="rounded bg-white/10" style={{ width: '4.5em', height: '0.9em' }} />
      </div>

      {/* Row 3: Delta skeleton */}
      <div className="flex items-center gap-1.5 mt-2">
        <div className="rounded bg-white/10" style={{ width: '1.2em', height: '1.2em' }} />
        <div className="rounded bg-white/10" style={{ width: '3em', height: '0.9em' }} />
      </div>

      {/* Row 4-5: Conversion lines skeleton (v2.4) */}
      <div className="flex flex-col items-center mt-2 space-y-0.5">
        <div className="flex items-center gap-1">
          <div className="rounded bg-white/10" style={{ width: '12px', height: '12px' }} />
          <div className="rounded bg-white/10" style={{ width: '3.5em', height: '0.7em' }} />
        </div>
        <div className="flex items-center gap-1">
          <div className="rounded bg-white/10" style={{ width: '12px', height: '12px' }} />
          <div className="rounded bg-white/10" style={{ width: '3.5em', height: '0.7em' }} />
        </div>
      </div>
    </div>
  );
}
