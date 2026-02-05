// src/components/ribbon/commodities-movers-grid.tsx
// ============================================================================
// COMMODITIES MOVERS GRID - PRESENTATIONAL
// ============================================================================
// Two side-by-side panels with 4 WINDOWS each that:
// - FILL available space (via aspect-ratio)
// - GROW with content if needed
// - SNAP to screen size (responsive)
// - Content STAYS INSIDE windows (proper overflow handling)
//
// SNAP-FIT FIX:
// - Measurer does NOT have overflow-hidden (so we can detect overflow)
// - Windows DO have overflow-hidden (to clip any edge cases)
// - Card is content-sized, not w-full h-full
//
// Authority: Compacted conversation 2026-02-04
// Existing features preserved: Yes
// ============================================================================

'use client';

import React from 'react';

import CommodityMoverCard, {
  CommodityMoverCardSkeleton,
} from '@/components/ribbon/commodity-mover-card';
import type { CommoditiesMoversGridProps } from '@/types/commodities-movers';

// ============================================================================
// LAYOUT CONSTANTS
// ============================================================================
const PANEL_ASPECT_RATIO = 1.3;

// ============================================================================
// SNAP-FIT FONT CONSTANTS
// ============================================================================
const MIN_FONT_PX = 12; // Floor - readable on small screens (was 18 - TOO BIG!)
const MAX_FONT_PX = 24; // Ceiling - matches exchange-card FitText range (was 32)
const STEP_PX = 1; // Step increments

function buildFontCandidates(maxPx: number, minPx: number, stepPx: number): number[] {
  const snap = (v: number) => Math.round(v / stepPx) * stepPx;
  const out: number[] = [];
  for (let px = snap(maxPx); px >= minPx - 1e-6; px -= stepPx) {
    out.push(Math.round(px / stepPx) * stepPx);
  }
  if (!out.includes(minPx)) out.push(minPx);
  return out;
}

// ============================================================================
// SECTION HEADER ICONS
// ============================================================================

function WinnerIcon(): React.ReactElement {
  return (
    <svg
      className="h-5 w-5 text-emerald-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
      />
    </svg>
  );
}

function LoserIcon(): React.ReactElement {
  return (
    <svg
      className="h-5 w-5 text-red-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6"
      />
    </svg>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function CommoditiesMoversGrid({
  winners,
  losers,
  isLoading = false,
  isStale = false,
}: CommoditiesMoversGridProps): React.ReactElement {
  // Refs for snap-fit measurement
  const gridRef = React.useRef<HTMLDivElement | null>(null);
  const measurerRef = React.useRef<HTMLDivElement | null>(null);
  const rafRef = React.useRef<number | null>(null);

  // Snap-fit font state - start at max, will scale down if needed
  const [fontPx, setFontPx] = React.useState<number>(MAX_FONT_PX);

  // Key for triggering reflow on data change
  const dataKey = React.useMemo(
    () => [...winners, ...losers].map((m) => `${m.id}:${m.priceText}`).join('|'),
    [winners, losers],
  );

  // --------------------------------------------------------------------------
  // SNAP-FIT MEASUREMENT LOGIC
  // --------------------------------------------------------------------------
  const scheduleReflow = React.useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;

      const grid = gridRef.current;
      const measurer = measurerRef.current;
      if (!grid || !measurer) return;

      // Get single cell dimensions (grid is 2×2 with gap-3 = 12px)
      const cellWidth = (grid.clientWidth - 12) / 2;
      const cellHeight = (grid.clientHeight - 12) / 2;

      if (!Number.isFinite(cellWidth) || cellWidth <= 0) return;
      if (!Number.isFinite(cellHeight) || cellHeight <= 0) return;

      const candidates = buildFontCandidates(MAX_FONT_PX, MIN_FONT_PX, STEP_PX);

      // Try each font size, largest first
      for (const px of candidates) {
        measurer.style.setProperty('--commodity-font', `${px}px`);

        // Force reflow to get accurate measurements
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        measurer.offsetHeight;

        // Measure content size (NOT container size)
        const contentWidth = measurer.scrollWidth;
        const contentHeight = measurer.scrollHeight;

        // Check if content fits within cell (with small tolerance)
        const fits = contentWidth <= cellWidth - 4 && contentHeight <= cellHeight - 4;

        if (fits) {
          setFontPx((prev) => (Math.abs(prev - px) < 0.001 ? prev : px));
          return;
        }
      }

      // Fallback to minimum
      setFontPx((prev) => (Math.abs(prev - MIN_FONT_PX) < 0.001 ? prev : MIN_FONT_PX));
    });
  }, []);

  // Trigger reflow on mount, data change, and resize
  React.useEffect(() => {
    scheduleReflow();

    const grid = gridRef.current;
    if (!grid) return () => undefined;

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => scheduleReflow());
      ro.observe(grid);

      return () => {
        ro.disconnect();
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      };
    }

    const onResize = () => scheduleReflow();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [dataKey, scheduleReflow]);

  // --------------------------------------------------------------------------
  // PANEL STYLE
  // --------------------------------------------------------------------------
  const panelStyle: React.CSSProperties = {
    aspectRatio: `${PANEL_ASPECT_RATIO}`,
    minHeight: 'fit-content',
  };

  // --------------------------------------------------------------------------
  // RENDER HELPER: Single Panel
  // --------------------------------------------------------------------------
  const renderPanel = (items: typeof winners, type: 'winner' | 'loser', isFirst: boolean) => {
    const Icon = type === 'winner' ? WinnerIcon : LoserIcon;
    const colorClass = type === 'winner' ? 'text-emerald-400' : 'text-red-400';
    const title = type === 'winner' ? 'Biggest Winners' : 'Biggest Losers';
    const subtitle = type === 'winner' ? 'Largest gains today' : 'Largest declines today';

    return (
      <section
        className="flex-1 flex flex-col rounded-2xl bg-slate-950/55 p-3 shadow-md ring-1 ring-slate-800"
        style={panelStyle}
        aria-label={`Commodities with largest ${type === 'winner' ? 'gains' : 'declines'} today`}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex flex-col items-center gap-0.5 pb-2">
          <div className="flex items-center gap-2">
            <Icon />
            <h3 className={`text-sm font-semibold uppercase tracking-wider ${colorClass}`}>
              {title}
            </h3>
            {isStale && (
              <span className="text-xs text-amber-400/70 animate-pulse">updating...</span>
            )}
          </div>
          <p className="text-xs text-white/40">{subtitle}</p>
        </div>

        {/* 2×2 Grid of WINDOWS */}
        <div
          ref={isFirst ? gridRef : undefined}
          className="flex-1 grid gap-3"
          style={{
            gridTemplateColumns: '1fr 1fr',
            gridTemplateRows: '1fr 1fr',
            ['--commodity-font' as string]: `${fontPx}px`,
          }}
          role="list"
          aria-label={`Top commodity ${type}s`}
        >
          {Array.from({ length: 4 }).map((_, i) => {
            const mover = items[i];
            return (
              <div
                key={mover ? mover.id : `${type}-empty-${i}`}
                role="listitem"
                className="rounded-xl bg-slate-900/80 ring-1 ring-white/10 flex items-center justify-center overflow-hidden transition-all hover:ring-white/20 hover:bg-slate-800/80"
              >
                {mover ? (
                  <CommodityMoverCard data={mover} isStale={isStale} />
                ) : (
                  <span className="text-white/30 text-lg">—</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Offscreen measurer - NO overflow-hidden so we can detect overflow! */}
        {isFirst && (
          <div
            ref={measurerRef}
            aria-hidden="true"
            className="pointer-events-none absolute left-[-99999px] top-0 opacity-0"
            style={{
              ['--commodity-font' as string]: `${fontPx}px`,
              // Let content determine size - no constraints
              display: 'inline-block',
            }}
          >
            {items[0] && <CommodityMoverCard data={items[0]} isStale={false} />}
          </div>
        )}
      </section>
    );
  };

  // --------------------------------------------------------------------------
  // LOADING STATE
  // --------------------------------------------------------------------------
  if (isLoading) {
    return (
      <div
        className="flex w-full gap-4"
        aria-label="Commodities movers loading"
        aria-busy="true"
        data-testid="commodities-movers-grid"
      >
        {/* Winners skeleton */}
        <section
          className="flex-1 flex flex-col rounded-2xl bg-slate-950/55 p-3 shadow-md ring-1 ring-slate-800"
          style={panelStyle}
        >
          <div className="flex-shrink-0 flex flex-col items-center gap-1 pb-2">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded bg-emerald-400/20 animate-pulse" />
              <div className="h-4 w-28 rounded bg-white/10 animate-pulse" />
            </div>
            <div className="h-3 w-24 rounded bg-white/5 animate-pulse" />
          </div>
          <div
            className="flex-1 grid gap-3"
            style={{ gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }}
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={`winner-skel-${i}`}
                className="rounded-xl bg-slate-900/80 ring-1 ring-white/10 flex items-center justify-center"
              >
                <CommodityMoverCardSkeleton />
              </div>
            ))}
          </div>
        </section>

        {/* Losers skeleton */}
        <section
          className="flex-1 flex flex-col rounded-2xl bg-slate-950/55 p-3 shadow-md ring-1 ring-slate-800"
          style={panelStyle}
        >
          <div className="flex-shrink-0 flex flex-col items-center gap-1 pb-2">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded bg-red-400/20 animate-pulse" />
              <div className="h-4 w-28 rounded bg-white/10 animate-pulse" />
            </div>
            <div className="h-3 w-24 rounded bg-white/5 animate-pulse" />
          </div>
          <div
            className="flex-1 grid gap-3"
            style={{ gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }}
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={`loser-skel-${i}`}
                className="rounded-xl bg-slate-900/80 ring-1 ring-white/10 flex items-center justify-center"
              >
                <CommodityMoverCardSkeleton />
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // EMPTY STATE
  // --------------------------------------------------------------------------
  if (winners.length === 0 && losers.length === 0) {
    return (
      <div className="flex w-full gap-4" data-testid="commodities-movers-grid">
        <section
          className="flex-1 rounded-2xl bg-slate-950/55 p-3 shadow-md ring-1 ring-slate-800 flex items-center justify-center"
          style={panelStyle}
          aria-label="Commodities winners"
        >
          <span className="text-base text-white/40">Winners data loading...</span>
        </section>
        <section
          className="flex-1 rounded-2xl bg-slate-950/55 p-3 shadow-md ring-1 ring-slate-800 flex items-center justify-center"
          style={panelStyle}
          aria-label="Commodities losers"
        >
          <span className="text-base text-white/40">Losers data loading...</span>
        </section>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // MAIN RENDER
  // --------------------------------------------------------------------------
  return (
    <div className="flex w-full gap-4" data-testid="commodities-movers-grid">
      {renderPanel(winners, 'winner', true)}
      {renderPanel(losers, 'loser', false)}
    </div>
  );
}
