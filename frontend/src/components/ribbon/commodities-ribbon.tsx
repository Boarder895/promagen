// src/components/ribbon/commodities-ribbon.tsx
//
// Presentational Commodities ribbon row (API Brain compliant).
// - Matches FX ribbon styling exactly (pill chips, snap-fit sizing).
// - Uses unified --fx-chip-font variable for consistent sizing.
// - Renders chips passed from container.
// - No polling, no upstream logic, no authority.
// - Rich tooltips with brand-specific glow colours.
//
// Snap-fit rules (same as FX):
// - Prefer 1 row if it can fit at >= 11.5px.
// - If it cannot fit even at 11.5px, allow exactly 2 rows.
// - Font snaps in 0.5px steps (largest that fits).
//
// Existing features preserved: Yes

'use client';

import React from 'react';

import { RichTooltip, type RichTooltipLine } from '@/components/ui/rich-tooltip';

export interface CommoditiesRibbonChip {
  id: string;
  label: React.ReactNode;
  priceText: string;
  tick: 'up' | 'down' | 'flat';
  deltaPct: number | null;
  // Tooltip data
  tooltipTitle?: string;
  tooltipLines?: RichTooltipLine[];
  /** Brand glow colour for tooltip (hex) */
  glowColour?: string;
}

export interface CommoditiesRibbonProps {
  chips: CommoditiesRibbonChip[];
}

// Snap-fit constants (same as FX)
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

export default function CommoditiesRibbon({ chips }: CommoditiesRibbonProps) {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const measurerRef = React.useRef<HTMLUListElement | null>(null);
  const rafRef = React.useRef<number | null>(null);

  const chipsKey = React.useMemo(
    () => chips.map((c) => `${c.id}:${c.priceText}`).join('|'),
    [chips],
  );

  const [snap, setSnap] = React.useState<SnapState>({ rows: 1, fontPx: MIN_FONT_PX });

  const columnsForTwoRows = React.useMemo(() => Math.max(1, Math.ceil(chips.length / 2)), [chips]);

  const scheduleReflow = React.useCallback(() => {
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

      // Try 1 row (flex, nowrap)
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

      // Fallback: 2 rows (grid)
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

      // Lock to 2 rows at minimum font if nothing fits
      setSnap((prev) => {
        const same = prev.rows === 2 && Math.abs(prev.fontPx - MIN_FONT_PX) < 0.001;
        return same ? prev : { rows: 2, fontPx: MIN_FONT_PX };
      });
    });
  }, [columnsForTwoRows]);

  React.useEffect(() => {
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
  }, [chipsKey, scheduleReflow]);

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

  const renderChip = (chip: CommoditiesRibbonChip, keyPrefix?: string) => {
    const priceClasses = [
      'tabular-nums',
      chip.tick === 'up' ? 'text-emerald-400' : chip.tick === 'down' ? 'text-red-400' : '',
    ]
      .filter(Boolean)
      .join(' ');

    const chipContent = (
      <span className="flex items-baseline gap-1">
        <span className="font-semibold">{chip.label}</span>
        <span aria-hidden="true" className="text-slate-500">·</span>
        <span className={priceClasses}>{chip.priceText}</span>
      </span>
    );

    const hasTooltip = chip.tooltipLines && chip.tooltipLines.length > 0;

    return (
      <li
        key={keyPrefix ? `${keyPrefix}-${chip.id}` : chip.id}
        className="flex shrink-0 items-baseline gap-1 whitespace-nowrap rounded-full bg-slate-900 px-3 py-1 text-[length:var(--fx-chip-font)] leading-none"
        data-chip-id={chip.id}
      >
        {hasTooltip ? (
          <RichTooltip
            title={chip.tooltipTitle}
            lines={chip.tooltipLines!}
            glowColour={chip.glowColour}
          >
            {chipContent}
          </RichTooltip>
        ) : (
          chipContent
        )}
      </li>
    );
  };

  return (
    <section
      aria-label="Commodities snapshot"
      data-testid="commodities-ribbon"
      className="w-full overflow-x-clip overflow-y-visible rounded-2xl bg-slate-950/55 px-3 py-2 text-xs text-slate-50 shadow-md ring-1 ring-slate-800"
    >
      <div ref={hostRef} className="relative w-full">
        <ul
          aria-label="Commodities prices"
          data-testid="commodities-row"
          className={rowClassName}
          style={rowStyle}
        >
          {chips.map((chip) => renderChip(chip))}
        </ul>

        {/* Offscreen measurer */}
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
    </section>
  );
}
