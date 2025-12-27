// frontend/src/components/ribbon/finance-ribbon.tsx
//
// Presentational FX ribbon row (API Brain compliant).
// - Renders chips passed from container (already SSOT-joined).
// - No demo, no synthetic fallbacks, no freshness logic, no polling.
// - UI cannot trigger upstream, cannot decide time, cannot mutate FX state.
//
// Enhancement:
// - Subtle “alive” micro-motion on price:
//   * neutral breath pulse
//   * tick nudge on update
//   * whisper tint (very faint)

'use client';

import React from 'react';

import type { FxApiMode } from '@/types/finance-ribbon';
import type { FinanceRibbonChip } from '@/components/ribbon/finance-ribbon.container';
import { trackRibbonPause } from '@/lib/analytics/finance';
import { getBudgetGuardEmoji } from '@/data/emoji/emoji';

type BudgetState = 'ok' | 'warning' | 'blocked';

export interface FinanceRibbonProps {
  buildId: string;
  mode: FxApiMode;
  chips: FinanceRibbonChip[];
  isPaused: boolean;
  onPauseToggle: () => void;
  budgetState?: BudgetState; // optional, renderer-only
}

function budgetEmoji(state: BudgetState): string {
  // SSOT: canonical mapping lives in Emoji Bank under budget_guard.
  // No hardcoded fallbacks here.
  return getBudgetGuardEmoji(state) ?? '';
}

// Snap-fit rules (UI-only; observational).
// - Prefer 1 row if it can fit at >= 11.5px.
// - If it cannot fit even at 11.5px, allow exactly 2 rows.
// - Font snaps in 0.5px steps (largest that fits).
const MIN_FONT_PX = 11.5;
const STEP_PX = 0.5;
// Conservative cap so ultra-wide screens don’t produce comically huge chips.
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

export const FinanceRibbon: React.FC<FinanceRibbonProps> = ({
  buildId,
  mode,
  chips,
  isPaused,
  onPauseToggle,
  budgetState,
}) => {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const measurerRef = React.useRef<HTMLUListElement | null>(null);
  const rafRef = React.useRef<number | null>(null);

  const chipsKey = React.useMemo(
    () => chips.map((c) => `${c.id}:${c.priceText}`).join('|'),
    [chips],
  );

  const [snap, setSnap] = React.useState<SnapState>({ rows: 1, fontPx: MIN_FONT_PX });

  const handlePause = () => {
    const nextPaused = !isPaused;

    // Always toggle first; analytics must never block behaviour.
    onPauseToggle();

    // Analytics is observational only; never allow it to throw or affect UX.
    try {
      trackRibbonPause({ isPaused: nextPaused, source: 'homepage_ribbon' });
    } catch {
      // no-op
    }
  };

  const pauseLabel = isPaused ? 'Resume live FX updates' : 'Pause live FX updates';

  const showBudget = typeof budgetState === 'string';
  const budgetStateSafe: BudgetState =
    budgetState === 'warning' || budgetState === 'blocked' ? budgetState : 'ok';
  const emoji = showBudget ? budgetEmoji(budgetStateSafe) : '';

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

      // Set the measurer width to exactly the chips host width (controls are outside this host).
      measurer.style.width = `${hostWidth}px`;

      const candidates = buildFontCandidates(MAX_FONT_PX, MIN_FONT_PX, STEP_PX);

      // ---- Try 1 row (flex, nowrap) ----
      measurer.style.display = 'flex';
      measurer.style.flexWrap = 'nowrap';
      measurer.style.justifyContent = 'center';

      for (const px of candidates) {
        measurer.style.setProperty('--fx-chip-font', `${px}px`);
        // Read after write (in this RAF) – contained to the offscreen measurer.
        if (measurer.scrollWidth <= hostWidth + 0.5) {
          setSnap((prev) => {
            const same = prev.rows === 1 && Math.abs(prev.fontPx - px) < 0.001;
            return same ? prev : { rows: 1, fontPx: px };
          });
          return;
        }
      }

      // ---- Fallback: 2 rows (grid, exactly 2 rows) ----
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

      // If nothing fits (extremely narrow), lock to 2 rows at minimum font.
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
          // CSS var drives exact 0.5px snapping without needing Tailwind arbitrary values everywhere.
          ['--fx-chip-font' as unknown as string]: `${snap.fontPx}px`,
        } as React.CSSProperties)
      : ({
          ['--fx-chip-font' as unknown as string]: `${snap.fontPx}px`,
          gridTemplateRows: 'repeat(2, max-content)',
          gridTemplateColumns: `repeat(${columnsForTwoRows}, max-content)`,
        } as React.CSSProperties);

  const renderChip = (chip: FinanceRibbonChip, keyPrefix?: string) => {
    const priceClasses = [
      'tabular-nums',
      'fx-price',
      chip.tick === 'up' ? 'fx-tick-up' : chip.tick === 'down' ? 'fx-tick-down' : 'fx-tick-flat',
      chip.isNeutral ? 'fx-neutral-breathe' : '',
      chip.tick === 'up' ? 'fx-whisper-up' : chip.tick === 'down' ? 'fx-whisper-down' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <li
        key={keyPrefix ? `${keyPrefix}-${chip.id}` : chip.id}
        className="flex shrink-0 items-baseline gap-1 whitespace-nowrap rounded-full bg-slate-900 px-3 py-1 text-[length:var(--fx-chip-font)] leading-none"
        data-chip-id={chip.id}
      >
        <span data-testid={`fx-${chip.id}`} className="flex items-baseline gap-1">
          <span className="font-semibold" data-testid="fx-label">
            {chip.label}
          </span>
          <span aria-hidden="true" className="text-slate-500">
            ·
          </span>

          {/* Price gets the motion (not the label) */}
          <span className={priceClasses} data-testid="fx-mid">
            {chip.priceText}
          </span>
        </span>
      </li>
    );
  };

  return (
    <section
      aria-label="Foreign exchange snapshot"
      data-testid="finance-ribbon"
      data-mode={mode}
      data-build-id={buildId}
      className="w-full overflow-hidden rounded-2xl bg-slate-950/55 px-3 py-2 text-xs text-slate-50 shadow-md ring-1 ring-slate-800"
    >
      {/* IMPORTANT: chips host is flex-1 min-w-0, controls are shrink-0, so budget/pause never get clipped */}
      <div className="flex items-center gap-2">
        {/* Chips host: takes available width (excluding right-side controls) */}
        <div ref={hostRef} className="relative min-w-0 flex-1 overflow-hidden">
          <ul
            aria-label="Foreign exchange pairs"
            data-testid="fx-row"
            className={rowClassName}
            style={rowStyle}
          >
            {chips.map((chip) => renderChip(chip))}
          </ul>

          {/* Offscreen measurer: same markup, used to compute best-fit without visible thrash */}
          <ul
            ref={measurerRef}
            aria-hidden="true"
            className="pointer-events-none absolute left-[-99999px] top-0 gap-2 opacity-0"
            style={{
              // Width + display/layout mode + font var are applied imperatively during measurement.
              ['--fx-chip-font' as unknown as string]: `${snap.fontPx}px`,
            }}
          >
            {chips.map((chip) => renderChip(chip, 'measure'))}
          </ul>
        </div>

        <div className="shrink-0 flex items-center gap-1">
          {showBudget ? (
            <span
              data-testid="finance-ribbon-budget"
              data-budget-state={budgetStateSafe}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 bg-slate-900/70 text-[12px]"
              aria-label="FX upstream budget state"
            >
              <span className="sr-only">
                {budgetStateSafe === 'blocked'
                  ? 'Blocked'
                  : budgetStateSafe === 'warning'
                  ? 'Warning'
                  : 'OK'}
              </span>
              <span aria-hidden="true">{emoji}</span>
            </span>
          ) : null}

          <button
            type="button"
            data-testid="finance-ribbon-pause"
            aria-label={pauseLabel}
            aria-pressed={isPaused}
            onClick={handlePause}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 bg-slate-900/70 text-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <span aria-hidden="true">{isPaused ? '▶' : 'Ⅱ'}</span>
          </button>
        </div>
      </div>
    </section>
  );
};

export default FinanceRibbon;
