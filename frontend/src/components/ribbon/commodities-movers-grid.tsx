// src/components/ribbon/commodities-movers-grid.tsx
// ============================================================================
// COMMODITIES MOVERS GRID - PRESENTATIONAL
// ============================================================================
// Two side-by-side panels with up to 4 WINDOWS each that:
// - FILL available space (flex-1, no fixed aspect-ratio)
// - Auto-detect if bottom row fits — if not, hide it cleanly
// - SNAP font to screen size (responsive)
// - Content STAYS INSIDE windows (overflow-hidden on panel)
//
// CONTENT-DRIVEN ROW DETECTION (v3.0):
// Instead of a magic MIN_CARD_HEIGHT_PX number, the offscreen measurer
// determines the actual content height at each font candidate. The unified
// reflow pass tries the largest font first:
//   1. Measure real content at this font
//   2. Does it fit in a 2-row cell (with breathing room)? → 2 rows, done
//   3. Does it fit in a 1-row cell? → drop bottom row, done
//   4. Neither → try smaller font
// Result: content is NEVER clipped. If it can't fit in 2 rows the bottom
// row gracefully disappears and the top row gets the full height.
//
// SNAP-FIT:
// - Measurer does NOT have overflow-hidden (so we can detect overflow)
// - Windows DO have overflow-hidden (safety net for sub-pixel rounding)
// - Card is content-sized, not w-full h-full
//
// Authority: commodities.md, compacted conversation 2026-02-07
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

// Header (title + subtitle) approximate height in px (flex-shrink-0 section).
// Used for available-grid-height calculation.
const HEADER_APPROX_PX = 48;

// Panel vertical padding (p-3 = 12px top + 12px bottom)
const PANEL_PADDING_PX = 24;

// Grid gap (gap-3 = 12px)
const GRID_GAP_PX = 12;

// Breathing room (px) added around measured content height so nothing
// sits flush against the window edge. 4px top + 4px bottom.
const BREATHING_ROOM_PX = 8;

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
  weatherRecord,
}: CommoditiesMoversGridProps): React.ReactElement {
  // Refs for snap-fit measurement
  const gridRef = React.useRef<HTMLDivElement | null>(null);
  const measurerRef = React.useRef<HTMLDivElement | null>(null);
  const panelRef = React.useRef<HTMLElement | null>(null);
  const rafRef = React.useRef<number | null>(null);

  // CLS FIX: Start at midpoint (18px) instead of MAX (24px).
  // Starting at MAX causes a guaranteed downward snap on every load. A midpoint
  // reduces the visual jump in either direction to ≤ 6px instead of ≥ 12px.
  const INITIAL_COMMODITY_FONT = 18;

  // Snap-fit font state - start at midpoint, will adjust up or down
  const [fontPx, setFontPx] = React.useState<number>(INITIAL_COMMODITY_FONT);

  // Whether bottom row of cards has enough space to render completely
  const [showBottomRow, setShowBottomRow] = React.useState(true);

  // CLS FIX: Content starts invisible (opacity: 0). After first reflow
  // settles font + row count, we fade in. Per CLS spec, elements at
  // opacity: 0 do not contribute to layout shift scoring.
  const [settled, setSettled] = React.useState(false);

  // How many cards per panel
  const cardsPerPanel = showBottomRow ? 4 : 2;

  // Key for triggering reflow on data change
  const dataKey = React.useMemo(
    () => [...winners, ...losers].map((m) => `${m.id}:${m.priceText}`).join('|'),
    [winners, losers],
  );

  // --------------------------------------------------------------------------
  // UNIFIED CONTENT-DRIVEN REFLOW
  // --------------------------------------------------------------------------
  // Single pass that decides BOTH font size AND row count together.
  // For each font candidate (largest → smallest):
  //   1. Render a real card in the offscreen measurer at that font
  //   2. Read its natural content height and width
  //   3. Calculate cell dimensions for 2-row layout
  //   4. Content fits with breathing room? → 2 rows at this font ✓
  //   5. Doesn't fit 2 rows? Calculate 1-row cell dimensions
  //   6. Content fits 1 row? → drop bottom row, use this font ✓
  //   7. Neither? → try next smaller font
  // Fallback: MIN_FONT_PX, single row.
  //
  // No magic numbers — decisions are driven by what the content
  // actually measures at each font size.
  // --------------------------------------------------------------------------
  // ---- CLS FIX: Synchronous measurement body (no rAF wrapper) ----
  // Extracted so it can be called from useLayoutEffect (before paint)
  // AND from scheduleReflow (after resize, via rAF).
  const doReflow = React.useCallback(() => {
    const grid = gridRef.current;
    const measurer = measurerRef.current;
    const panel = panelRef.current;

    if (!grid || !measurer || !panel) return;

    // Panel height is our hard constraint (set by the parent layout).
    // It does NOT change when we toggle row count, so no oscillation.
    const panelHeight = panel.clientHeight;
    const availableGridHeight = panelHeight - HEADER_APPROX_PX - PANEL_PADDING_PX;
    const cellWidth = (grid.clientWidth - GRID_GAP_PX) / 2;

    if (!Number.isFinite(cellWidth) || cellWidth <= 0) return;
    if (availableGridHeight <= 0) return;

    // Pre-calculate cell heights for both layouts
    const twoRowCellHeight = (availableGridHeight - GRID_GAP_PX) / 2;
    const oneRowCellHeight = availableGridHeight;

    const candidates = buildFontCandidates(MAX_FONT_PX, MIN_FONT_PX, STEP_PX);

    for (const px of candidates) {
      measurer.style.setProperty('--commodity-font', `${px}px`);

      // Force reflow to get accurate measurements
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      measurer.offsetHeight;

      // Measure actual content size (NOT container size)
      const contentWidth = measurer.scrollWidth;
      const contentHeight = measurer.scrollHeight;

      // Width must fit regardless of row count
      const widthFits = contentWidth <= cellWidth - 4;
      if (!widthFits) continue; // Too wide at this font, try smaller

      // Prefer 2-row layout (shows more data)
      if (contentHeight + BREATHING_ROOM_PX <= twoRowCellHeight) {
        setShowBottomRow((prev) => (prev === true ? prev : true));
        setFontPx((prev) => (Math.abs(prev - px) < 0.001 ? prev : px));
        setSettled(true);
        return;
      }

      // Fall back to 1-row layout (more vertical space per card)
      if (contentHeight + BREATHING_ROOM_PX <= oneRowCellHeight) {
        setShowBottomRow((prev) => (prev === false ? prev : false));
        setFontPx((prev) => (Math.abs(prev - px) < 0.001 ? prev : px));
        setSettled(true);
        return;
      }

      // Content too tall even for 1 row at this font → try smaller
    }

    // Absolute fallback: minimum font, single row
    setShowBottomRow((prev) => (prev === false ? prev : false));
    setFontPx((prev) => (Math.abs(prev - MIN_FONT_PX) < 0.001 ? prev : MIN_FONT_PX));
    setSettled(true);
  }, []);

  // rAF-wrapped version for resize/data-change events (non-blocking)
  const scheduleReflow = React.useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      doReflow();
    });
  }, [doReflow]);

  // ---- CLS FIX: Initial measurement BEFORE browser paints ----
  // useLayoutEffect runs synchronously after DOM update but before paint.
  // The setState inside triggers a synchronous re-render, so the browser
  // only ever paints the correctly-measured layout. CLS = 0 for this component.
  React.useLayoutEffect(() => {
    doReflow();
  }, [doReflow]);

  // Resize observer + data-change reflow (user-initiated, no CLS impact)
  React.useEffect(() => {
    // Re-measure when data changes (e.g. commodity prices update)
    scheduleReflow();

    const panel = panelRef.current;
    const grid = gridRef.current;

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => scheduleReflow());
      // Observe BOTH panel (for height constraint) and grid (for width)
      if (panel) ro.observe(panel);
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
        : 'Largest declines in the last 2 hours ';

    // Only show as many cards as we have room for
    const visibleCount = cardsPerPanel;

    return (
      <section
        ref={isFirst ? panelRef : undefined}
        className="flex-1 flex flex-col min-h-0 rounded-2xl bg-slate-950/55 p-3 shadow-md ring-1 ring-slate-800 overflow-hidden"
        aria-label={`Commodities with largest ${type === 'winner' ? 'gains' : 'declines'} today`}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex flex-col items-center gap-0.5 pb-2">
          <div className="flex items-center gap-2">
            <Icon />
            <h3 className={`text-base font-semibold uppercase tracking-wider ${colorClass}`}>
              {title}
            </h3>
            {isStale && (
              <span className="text-xs text-amber-400/80 animate-pulse">updating...</span>
            )}
          </div>
          <p className="text-sm text-amber-400/80">{subtitle}</p>
        </div>

        {/* Grid of WINDOWS — 2×2 or 2×1 depending on measured content fit */}
        <div
          ref={isFirst ? gridRef : undefined}
          className="flex-1 min-h-0 grid gap-3"
          style={{
            gridTemplateColumns: '1fr 1fr',
            gridTemplateRows: showBottomRow ? '1fr 1fr' : '1fr',
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
                className="rounded-xl bg-slate-900/80 ring-1 ring-white/10 flex items-center justify-center overflow-hidden transition-colors hover:ring-white/20 hover:bg-slate-800/80"
              >
                {mover ? (
                  <CommodityMoverCard data={mover} isStale={isStale} weatherRecord={weatherRecord} />
                ) : (
                  <span className="text-white/30 text-lg">—</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Offscreen measurer - NO overflow-hidden so we can detect true content size */}
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
            {items[0] && <CommodityMoverCard data={items[0]} isStale={false} weatherRecord={weatherRecord} />}
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
        className="flex flex-1 min-h-0 w-full gap-4"
        aria-label="Commodities movers loading"
        aria-busy="true"
        data-testid="commodities-movers-grid"
      >
        {/* Winners skeleton */}
        <section className="flex-1 flex flex-col min-h-0 rounded-2xl bg-slate-950/55 p-3 shadow-md ring-1 ring-slate-800 overflow-hidden">
          <div className="flex-shrink-0 flex flex-col items-center gap-1 pb-2">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded bg-emerald-400/20 animate-pulse" />
              <div className="h-4 w-28 rounded bg-white/10 animate-pulse" />
            </div>
            <div className="h-3 w-24 rounded bg-white/5 animate-pulse" />
          </div>
          <div
            className="flex-1 min-h-0 grid gap-3"
            style={{ gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }}
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={`winner-skel-${i}`}
                className="rounded-xl bg-slate-900/80 ring-1 ring-white/10 flex items-center justify-center overflow-hidden"
              >
                <CommodityMoverCardSkeleton />
              </div>
            ))}
          </div>
        </section>

        {/* Losers skeleton */}
        <section className="flex-1 flex flex-col min-h-0 rounded-2xl bg-slate-950/55 p-3 shadow-md ring-1 ring-slate-800 overflow-hidden">
          <div className="flex-shrink-0 flex flex-col items-center gap-1 pb-2">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded bg-red-400/20 animate-pulse" />
              <div className="h-4 w-28 rounded bg-white/10 animate-pulse" />
            </div>
            <div className="h-3 w-24 rounded bg-white/5 animate-pulse" />
          </div>
          <div
            className="flex-1 min-h-0 grid gap-3"
            style={{ gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }}
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={`loser-skel-${i}`}
                className="rounded-xl bg-slate-900/80 ring-1 ring-white/10 flex items-center justify-center overflow-hidden"
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
        className="flex flex-1 min-h-0 w-full gap-4"
        data-testid="commodities-movers-grid"
        style={{ opacity: 0 }}
      >
        <section
          className="flex-1 min-h-0 rounded-2xl bg-slate-950/55 p-3 shadow-md ring-1 ring-slate-800 flex items-center justify-center overflow-hidden"
          aria-label="Commodities winners"
        >
          <span className="text-base text-white/40">Winners data loading...</span>
        </section>
        <section
          className="flex-1 min-h-0 rounded-2xl bg-slate-950/55 p-3 shadow-md ring-1 ring-slate-800 flex items-center justify-center overflow-hidden"
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
    <div
      className="flex flex-1 min-h-0 w-full gap-4"
      data-testid="commodities-movers-grid"
      style={{
        // CLS FIX: Invisible until font reflow settles. Per CLS spec,
        // elements at opacity: 0 don't contribute to shift scoring.
        opacity: settled ? 1 : 0,
        transition: 'opacity 150ms ease-in',
      }}
    >
      {renderPanel(winners, 'winner', true)}
      {renderPanel(losers, 'loser', false)}
    </div>
  );
}
