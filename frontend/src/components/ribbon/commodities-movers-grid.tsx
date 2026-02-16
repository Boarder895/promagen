// src/components/ribbon/commodities-movers-grid.tsx
// ============================================================================
// COMMODITIES MOVERS GRID — v4.0 (clamp() EVERYWHERE)
// ============================================================================
// Two side-by-side panels with up to 4 WINDOWS each that:
// - FILL available space (flex-1, no fixed aspect-ratio)
// - Auto-detect if bottom row fits — if not, snap to 2×1
// - SNAP font to screen size (responsive)
// - Content STAYS INSIDE windows (overflow-hidden on panel)
// - ALL gaps, padding, text via clamp() — no fixed px
//
// CONTENT-DRIVEN ROW DETECTION (v4.0):
// Reads actual grid dimensions from DOM (no magic constants for header/padding).
// Grid gap is clamp()-based — the algorithm reads the computed gap value.
//
// v4.0: clamp() on all gaps/padding/text, DOM-based measurement (16 Feb 2026)
// v3.0: Content-driven row detection (7 Feb 2026)
//
// Authority: commodities.md, code-standard.md
// Existing features preserved: Yes
// ============================================================================

'use client';

import React from 'react';

import CommodityMoverCard, {
  CommodityMoverCardSkeleton,
} from '@/components/ribbon/commodity-mover-card';
import type { CommoditiesMoversGridProps } from '@/types/commodities-movers';

// ============================================================================
// SNAP-FIT FONT CONSTANTS
// ============================================================================
const MIN_FONT_PX = 12; // Floor — readable on small screens
const MAX_FONT_PX = 24; // Ceiling — matches exchange-card FitText range
const STEP_PX = 1; // Step increments

// Breathing room (px) added around measured content height so nothing
// sits flush against the window edge. 4px top + 4px bottom.
const BREATHING_ROOM_PX = 8;

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
      className="text-emerald-400 flex-shrink-0"
      style={{ width: 'clamp(14px, 1.2vw, 22px)', height: 'clamp(14px, 1.2vw, 22px)' }}
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
      className="text-red-400 flex-shrink-0"
      style={{ width: 'clamp(14px, 1.2vw, 22px)', height: 'clamp(14px, 1.2vw, 22px)' }}
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
// clamp() TOKENS — used as inline styles throughout
// ============================================================================
const CLAMP = {
  /** Panel internal padding */
  panelPadding: 'clamp(6px, 0.6vw, 14px)',
  /** Grid gap between windows */
  gridGap: 'clamp(6px, 0.5vw, 12px)',
  /** Gap between the two panels */
  panelGap: 'clamp(8px, 0.7vw, 16px)',
  /** Header bottom padding */
  headerPb: 'clamp(4px, 0.4vw, 10px)',
  /** Header title font */
  headerTitle: 'clamp(11px, 0.9vw, 16px)',
  /** Header subtitle font */
  headerSubtitle: 'clamp(9px, 0.7vw, 14px)',
  /** Icon-to-title gap */
  headerGap: 'clamp(4px, 0.3vw, 8px)',
} as const;

// ============================================================================
// COMPONENT
// ============================================================================

export default function CommoditiesMoversGrid({
  winners,
  losers,
  isLoading = false,
  isStale = false,
  weatherRecord,
}: CommoditiesMoversGridProps): React.ReactElement {
  // Refs for snap-fit measurement
  const gridRef = React.useRef<HTMLDivElement | null>(null);
  const measurerRef = React.useRef<HTMLDivElement | null>(null);
  const rafRef = React.useRef<number | null>(null);

  // CLS FIX: Start at midpoint (18px) instead of MAX (24px).
  const INITIAL_COMMODITY_FONT = 18;

  const [fontPx, setFontPx] = React.useState<number>(INITIAL_COMMODITY_FONT);
  const [showBottomRow, setShowBottomRow] = React.useState(true);
  const [settled, setSettled] = React.useState(false);

  const cardsPerPanel = showBottomRow ? 4 : 2;

  // Key for triggering reflow on data change
  const dataKey = React.useMemo(
    () => [...winners, ...losers].map((m) => `${m.id}:${m.priceText}`).join('|'),
    [winners, losers],
  );

  // --------------------------------------------------------------------------
  // UNIFIED CONTENT-DRIVEN REFLOW (v4.0)
  // --------------------------------------------------------------------------
  // Reads actual grid dimensions from DOM — no hardcoded header/padding px.
  // The grid div is flex-1 min-h-0, so its clientHeight IS the available
  // space for cards. Gap is read from computed style.
  // --------------------------------------------------------------------------
  const doReflow = React.useCallback(() => {
    const grid = gridRef.current;
    const measurer = measurerRef.current;

    if (!grid || !measurer) return;

    const gridHeight = grid.clientHeight;
    const gridWidth = grid.clientWidth;

    if (gridHeight <= 0 || gridWidth <= 0) return;

    // Read actual computed gap (tracks the clamp() value at current viewport)
    const computedGap = parseFloat(getComputedStyle(grid).gap) || 8;

    // Cell dimensions for both layouts
    const twoRowCellHeight = (gridHeight - computedGap) / 2;
    const oneRowCellHeight = gridHeight;
    const cellWidth = (gridWidth - computedGap) / 2;

    if (twoRowCellHeight <= 0) return;

    const candidates = buildFontCandidates(MAX_FONT_PX, MIN_FONT_PX, STEP_PX);

    for (const px of candidates) {
      measurer.style.setProperty('--commodity-font', `${px}px`);

      // Force reflow to get accurate measurements
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      measurer.offsetHeight;

      const contentWidth = measurer.scrollWidth;
      const contentHeight = measurer.scrollHeight;

      // Width must fit regardless of row count
      const widthFits = contentWidth <= cellWidth - 4;
      if (!widthFits) continue;

      // Prefer 2-row layout (shows 4 windows)
      if (contentHeight + BREATHING_ROOM_PX <= twoRowCellHeight) {
        setShowBottomRow((prev) => (prev === true ? prev : true));
        setFontPx((prev) => (Math.abs(prev - px) < 0.001 ? prev : px));
        setSettled(true);
        return;
      }

      // Fall back to 1-row layout (2 windows, more vertical space per card)
      if (contentHeight + BREATHING_ROOM_PX <= oneRowCellHeight) {
        setShowBottomRow((prev) => (prev === false ? prev : false));
        setFontPx((prev) => (Math.abs(prev - px) < 0.001 ? prev : px));
        setSettled(true);
        return;
      }
    }

    // Absolute fallback: minimum font, single row
    setShowBottomRow((prev) => (prev === false ? prev : false));
    setFontPx((prev) => (Math.abs(prev - MIN_FONT_PX) < 0.001 ? prev : MIN_FONT_PX));
    setSettled(true);
  }, []);

  // rAF-wrapped version for resize/data-change events
  const scheduleReflow = React.useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      doReflow();
    });
  }, [doReflow]);

  // CLS FIX: Initial measurement BEFORE browser paints
  React.useLayoutEffect(() => {
    doReflow();
  }, [doReflow]);

  // Resize observer + data-change reflow
  React.useEffect(() => {
    scheduleReflow();

    const grid = gridRef.current;

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => scheduleReflow());
      if (grid) ro.observe(grid);

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
  // RENDER HELPER: Single Panel
  // --------------------------------------------------------------------------
  const renderPanel = (items: typeof winners, type: 'winner' | 'loser', isFirst: boolean) => {
    const Icon = type === 'winner' ? WinnerIcon : LoserIcon;
    const colorClass = type === 'winner' ? 'text-emerald-400' : 'text-red-400';
    const title = type === 'winner' ? 'Biggest Winners' : 'Biggest Losers';
    const subtitle =
      type === 'winner'
        ? 'Largest gains in the last 2 hours'
        : 'Largest declines in the last 2 hours';

    const visibleCount = cardsPerPanel;

    return (
      <section
        className="flex-1 flex flex-col min-h-0 rounded-2xl bg-slate-950/55 shadow-md ring-1 ring-slate-800 overflow-hidden"
        style={{ padding: CLAMP.panelPadding }}
        aria-label={`Commodities with largest ${type === 'winner' ? 'gains' : 'declines'} today`}
      >
        {/* Header */}
        <div
          className="flex-shrink-0 flex flex-col items-center"
          style={{ gap: '2px', paddingBottom: CLAMP.headerPb }}
        >
          <div className="flex items-center" style={{ gap: CLAMP.headerGap }}>
            <Icon />
            <h3
              className={`font-semibold uppercase tracking-wider ${colorClass}`}
              style={{ fontSize: CLAMP.headerTitle }}
            >
              {title}
            </h3>
            {isStale && (
              <span
                className="text-amber-400/80 animate-pulse"
                style={{ fontSize: CLAMP.headerSubtitle }}
              >
                updating...
              </span>
            )}
          </div>
          <p className="text-amber-400/80" style={{ fontSize: CLAMP.headerSubtitle }}>
            {subtitle}
          </p>
        </div>

        {/* Grid of WINDOWS — 2×2 or 2×1 depending on measured content fit */}
        <div
          ref={isFirst ? gridRef : undefined}
          className="flex-1 min-h-0 grid"
          style={{
            gridTemplateColumns: '1fr 1fr',
            gridTemplateRows: showBottomRow ? '1fr 1fr' : '1fr',
            gap: CLAMP.gridGap,
            ['--commodity-font' as string]: `${fontPx}px`,
          }}
          role="list"
          aria-label={`Top commodity ${type}s`}
        >
          {Array.from({ length: visibleCount }).map((_, i) => {
            const mover = items[i];
            return (
              <div
                key={mover ? mover.id : `${type}-empty-${i}`}
                role="listitem"
                className="rounded-xl bg-slate-900/80 ring-1 ring-white/10 overflow-hidden transition-colors hover:ring-white/20 hover:bg-slate-800/80"
              >
                {mover ? (
                  <CommodityMoverCard
                    data={mover}
                    isStale={isStale}
                    weatherRecord={weatherRecord}
                  />
                ) : (
                  <span className="text-white/30" style={{ fontSize: CLAMP.headerTitle }}>
                    —
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Offscreen measurer — NO overflow-hidden so we can detect true content size */}
        {isFirst && (
          <div
            ref={measurerRef}
            aria-hidden="true"
            className="pointer-events-none absolute left-[-99999px] top-0 opacity-0"
            style={{
              ['--commodity-font' as string]: `${fontPx}px`,
              display: 'inline-block',
            }}
          >
            {items[0] && (
              <CommodityMoverCard data={items[0]} isStale={false} weatherRecord={weatherRecord} />
            )}
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
        className="flex flex-1 min-h-0 w-full"
        style={{ gap: CLAMP.panelGap }}
        aria-label="Commodities movers loading"
        aria-busy="true"
        data-testid="commodities-movers-grid"
      >
        {/* Winners skeleton */}
        <section
          className="flex-1 flex flex-col min-h-0 rounded-2xl bg-slate-950/55 shadow-md ring-1 ring-slate-800 overflow-hidden"
          style={{ padding: CLAMP.panelPadding }}
        >
          <div
            className="flex-shrink-0 flex flex-col items-center"
            style={{ gap: '2px', paddingBottom: CLAMP.headerPb }}
          >
            <div className="flex items-center" style={{ gap: CLAMP.headerGap }}>
              <div
                className="rounded bg-emerald-400/20 animate-pulse"
                style={{ width: 'clamp(14px, 1.2vw, 22px)', height: 'clamp(14px, 1.2vw, 22px)' }}
              />
              <div
                className="rounded bg-white/10 animate-pulse"
                style={{ width: 'clamp(80px, 7vw, 120px)', height: 'clamp(12px, 1vw, 18px)' }}
              />
            </div>
            <div
              className="rounded bg-white/5 animate-pulse"
              style={{ width: 'clamp(60px, 6vw, 100px)', height: 'clamp(10px, 0.8vw, 14px)' }}
            />
          </div>
          <div
            className="flex-1 min-h-0 grid"
            style={{
              gridTemplateColumns: '1fr 1fr',
              gridTemplateRows: '1fr 1fr',
              gap: CLAMP.gridGap,
            }}
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={`winner-skel-${i}`}
                className="rounded-xl bg-slate-900/80 ring-1 ring-white/10 overflow-hidden"
              >
                <CommodityMoverCardSkeleton />
              </div>
            ))}
          </div>
        </section>

        {/* Losers skeleton */}
        <section
          className="flex-1 flex flex-col min-h-0 rounded-2xl bg-slate-950/55 shadow-md ring-1 ring-slate-800 overflow-hidden"
          style={{ padding: CLAMP.panelPadding }}
        >
          <div
            className="flex-shrink-0 flex flex-col items-center"
            style={{ gap: '2px', paddingBottom: CLAMP.headerPb }}
          >
            <div className="flex items-center" style={{ gap: CLAMP.headerGap }}>
              <div
                className="rounded bg-red-400/20 animate-pulse"
                style={{ width: 'clamp(14px, 1.2vw, 22px)', height: 'clamp(14px, 1.2vw, 22px)' }}
              />
              <div
                className="rounded bg-white/10 animate-pulse"
                style={{ width: 'clamp(80px, 7vw, 120px)', height: 'clamp(12px, 1vw, 18px)' }}
              />
            </div>
            <div
              className="rounded bg-white/5 animate-pulse"
              style={{ width: 'clamp(60px, 6vw, 100px)', height: 'clamp(10px, 0.8vw, 14px)' }}
            />
          </div>
          <div
            className="flex-1 min-h-0 grid"
            style={{
              gridTemplateColumns: '1fr 1fr',
              gridTemplateRows: '1fr 1fr',
              gap: CLAMP.gridGap,
            }}
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={`loser-skel-${i}`}
                className="rounded-xl bg-slate-900/80 ring-1 ring-white/10 overflow-hidden"
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
      <div
        className="flex flex-1 min-h-0 w-full"
        style={{ gap: CLAMP.panelGap, opacity: 0 }}
        data-testid="commodities-movers-grid"
      >
        <section
          className="flex-1 min-h-0 rounded-2xl bg-slate-950/55 shadow-md ring-1 ring-slate-800 flex items-center justify-center overflow-hidden"
          style={{ padding: CLAMP.panelPadding }}
          aria-label="Commodities winners"
        >
          <span className="text-white/40" style={{ fontSize: CLAMP.headerTitle }}>
            Winners data loading...
          </span>
        </section>
        <section
          className="flex-1 min-h-0 rounded-2xl bg-slate-950/55 shadow-md ring-1 ring-slate-800 flex items-center justify-center overflow-hidden"
          style={{ padding: CLAMP.panelPadding }}
          aria-label="Commodities losers"
        >
          <span className="text-white/40" style={{ fontSize: CLAMP.headerTitle }}>
            Losers data loading...
          </span>
        </section>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // MAIN RENDER
  // --------------------------------------------------------------------------
  return (
    <div
      className="flex flex-1 min-h-0 w-full"
      style={{
        gap: CLAMP.panelGap,
        opacity: settled ? 1 : 0,
        transition: 'opacity 150ms ease-in',
      }}
      data-testid="commodities-movers-grid"
    >
      {renderPanel(winners, 'winner', true)}
      {renderPanel(losers, 'loser', false)}
    </div>
  );
}
