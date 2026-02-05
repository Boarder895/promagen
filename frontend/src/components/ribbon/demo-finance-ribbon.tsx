// src/components/ribbon/demo-finance-ribbon.tsx
// ============================================================================
// DEMO FINANCE RIBBON - Static Preview Mode (Matches Live Ribbon)
// ============================================================================
// Renders FX pairs with static demo prices from pairs.json catalog.
// Used on /pro-promagen page to preview selected pairs without API calls.
//
// MATCHES LIVE RIBBON:
// - Same chip structure and CSS styling
// - Same snap-fit font sizing algorithm
// - Uses FxPairLabel with flags
// - Shows "Demo" badge instead of pause button
//
// Authority: docs/authority/paid_tier.md §5.10
// ============================================================================

'use client';

import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import FxPairLabel from '@/components/ribbon/fx-pair-label';
import { deriveCountryCodes, type FxPairCatalogEntry } from '@/lib/pro-promagen/types';

export interface DemoFinanceRibbonProps {
  /** FX pairs with demo data from catalog */
  pairs: FxPairCatalogEntry[];
}

// ============================================================================
// SNAP-FIT ALGORITHM (Same as live ribbon)
// ============================================================================

const MIN_FONT_PX = 11.5;
const STEP_PX = 0.5;
const MAX_FONT_PX = 16.5;

type SnapRows = 1 | 2;
type SnapState = { rows: SnapRows; fontPx: number };

function buildFontCandidates(maxPx: number, minPx: number, stepPx: number): number[] {
  const snap = (v: number) => Math.round(v / stepPx) * stepPx;
  const out: number[] = [];
  for (let px = snap(maxPx); px >= minPx - 1e-6; px -= stepPx) {
    out.push(Math.round(px / stepPx) * stepPx);
  }
  if (!out.includes(minPx)) out.push(minPx);
  return out;
}

function formatPrice(price: number, precision: number): string {
  const digits = Math.max(0, Math.min(8, precision));
  return price.toLocaleString('en-GB', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

// ============================================================================
// CHIP TYPE (Simplified - no animation state needed for demo)
// ============================================================================

interface DemoChip {
  id: string;
  label: React.ReactNode;
  priceText: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function DemoFinanceRibbon({ pairs }: DemoFinanceRibbonProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const measurerRef = useRef<HTMLUListElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Prevent hydration mismatch by only running snap-fit after mount
  const [mounted, setMounted] = useState(false);
  const [snap, setSnap] = useState<SnapState>({ rows: 1, fontPx: MIN_FONT_PX });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Build chips with FxPairLabel (includes flags)
  const chips: DemoChip[] = useMemo(() => {
    return pairs.map((pair) => {
      // Get country codes - use explicit if available, otherwise derive
      const { baseCountryCode, quoteCountryCode } = pair.baseCountryCode && pair.quoteCountryCode
        ? { baseCountryCode: pair.baseCountryCode, quoteCountryCode: pair.quoteCountryCode }
        : deriveCountryCodes(pair.base, pair.quote);

      const price = pair.demo?.value ?? 0;

      return {
        id: pair.id,
        label: (
          <FxPairLabel
            base={pair.base}
            baseCountryCode={baseCountryCode}
            quote={pair.quote}
            quoteCountryCode={quoteCountryCode}
          />
        ),
        priceText: formatPrice(price, pair.precision),
      };
    });
  }, [pairs]);

  const chipsKey = useMemo(
    () => chips.map((c) => `${c.id}:${c.priceText}`).join('|'),
    [chips],
  );

  const columnsForTwoRows = useMemo(() => Math.max(1, Math.ceil(chips.length / 2)), [chips]);

  // Snap-fit reflow algorithm (same as live ribbon)
  const scheduleReflow = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;

      const host = hostRef.current;
      const measurer = measurerRef.current;
      if (!host || !measurer) return;

      const hostWidth = host.clientWidth;
      if (!Number.isFinite(hostWidth) || hostWidth <= 0) return;

      measurer.style.width = `${hostWidth}px`;

      const candidates = buildFontCandidates(MAX_FONT_PX, MIN_FONT_PX, STEP_PX);

      // Try 1 row
      measurer.style.display = 'flex';
      measurer.style.flexWrap = 'nowrap';
      measurer.style.justifyContent = 'center';

      for (const px of candidates) {
        measurer.style.setProperty('--fx-chip-font', `${px}px`);
        if (measurer.scrollWidth <= hostWidth + 0.5) {
          setSnap((prev) => {
            const same = prev.rows === 1 && Math.abs(prev.fontPx - px) < 0.001;
            return same ? prev : { rows: 1, fontPx: px };
          });
          return;
        }
      }

      // Fallback: 2 rows
      measurer.style.display = 'grid';
      measurer.style.justifyContent = 'center';
      measurer.style.gridTemplateRows = 'repeat(2, max-content)';
      measurer.style.gridTemplateColumns = `repeat(${columnsForTwoRows}, max-content)`;

      for (const px of candidates) {
        measurer.style.setProperty('--fx-chip-font', `${px}px`);
        if (measurer.scrollWidth <= hostWidth + 0.5) {
          setSnap((prev) => {
            const same = prev.rows === 2 && Math.abs(prev.fontPx - px) < 0.001;
            return same ? prev : { rows: 2, fontPx: px };
          });
          return;
        }
      }

      // Lock to 2 rows at minimum font
      setSnap((prev) => {
        const same = prev.rows === 2 && Math.abs(prev.fontPx - MIN_FONT_PX) < 0.001;
        return same ? prev : { rows: 2, fontPx: MIN_FONT_PX };
      });
    });
  }, [columnsForTwoRows]);

  // Run reflow on mount and resize (only after client mount)
  useEffect(() => {
    if (!mounted) return;
    
    scheduleReflow();

    const host = hostRef.current;
    if (!host) return () => undefined;

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => scheduleReflow());
      ro.observe(host);

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
  }, [mounted, chipsKey, scheduleReflow]);

  // Row styling (same as live ribbon)
  const rowClassName =
    snap.rows === 1
      ? 'flex w-full flex-nowrap items-center justify-center gap-2'
      : 'grid w-full items-center justify-center gap-2';

  const rowStyle: React.CSSProperties =
    snap.rows === 1
      ? ({
          ['--fx-chip-font' as unknown as string]: `${snap.fontPx}px`,
        } as React.CSSProperties)
      : ({
          ['--fx-chip-font' as unknown as string]: `${snap.fontPx}px`,
          gridTemplateRows: 'repeat(2, max-content)',
          gridTemplateColumns: `repeat(${columnsForTwoRows}, max-content)`,
        } as React.CSSProperties);

  // Chip renderer (matches live ribbon exactly)
  const renderChip = (chip: DemoChip, keyPrefix?: string) => {
    return (
      <li
        key={keyPrefix ? `${keyPrefix}-${chip.id}` : chip.id}
        className="flex shrink-0 items-baseline gap-1 whitespace-nowrap rounded-full bg-slate-900 px-3 py-1 text-[length:var(--fx-chip-font)] leading-none"
        data-chip-id={chip.id}
      >
        <span data-testid={`fx-demo-${chip.id}`} className="flex items-baseline gap-1">
          <span className="font-semibold" data-testid="fx-label">
            {chip.label}
          </span>
          <span aria-hidden="true" className="text-slate-500">
            ·
          </span>
          <span className="tabular-nums" data-testid="fx-mid">
            {chip.priceText}
          </span>
        </span>
      </li>
    );
  };

  // Empty state
  if (pairs.length === 0) {
    return (
      <section
        aria-label="Foreign exchange preview"
        data-testid="demo-finance-ribbon"
        className="w-full overflow-hidden rounded-2xl bg-slate-950/55 px-3 py-2 text-xs text-slate-50 shadow-md ring-1 ring-slate-800"
      >
        <div className="text-center text-slate-500 py-1">
          No FX pairs selected
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Foreign exchange preview (demo data)"
      data-testid="demo-finance-ribbon"
      data-mode="demo"
      className="w-full overflow-hidden rounded-2xl bg-slate-950/55 px-3 py-2 text-xs text-slate-50 shadow-md ring-1 ring-slate-800"
    >
      <div className="flex items-center gap-2">
        {/* Chips host (same structure as live ribbon) */}
        <div ref={hostRef} className="relative min-w-0 flex-1 overflow-hidden">
          <ul
            aria-label="Foreign exchange pairs (demo)"
            data-testid="fx-row-demo"
            className={rowClassName}
            style={rowStyle}
          >
            {chips.map((chip) => renderChip(chip))}
          </ul>

          {/* Offscreen measurer (same as live ribbon) */}
          <ul
            ref={measurerRef}
            aria-hidden="true"
            className="pointer-events-none absolute left-[-99999px] top-0 gap-2 opacity-0"
            style={{
              ['--fx-chip-font' as unknown as string]: `${snap.fontPx}px`,
            }}
          >
            {chips.map((chip) => renderChip(chip, 'measure'))}
          </ul>
        </div>

        {/* Demo indicator (replaces pause button) */}
        <div className="shrink-0 flex items-center gap-1">
          <span
            data-testid="demo-finance-ribbon-indicator"
            className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Demo
          </span>
        </div>
      </div>
    </section>
  );
}

export default DemoFinanceRibbon;
