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
import { trackRibbonPause } from '@/lib/analytics/finance';
import type { FinanceRibbonChip } from '@/components/ribbon/finance-ribbon.container';

export interface FinanceRibbonProps {
  buildId: string;
  mode: FxApiMode;
  chips: FinanceRibbonChip[];
  isPaused: boolean;
  onPauseToggle: () => void;
}

export const FinanceRibbon: React.FC<FinanceRibbonProps> = ({
  buildId,
  mode,
  chips,
  isPaused,
  onPauseToggle,
}) => {
  const handlePause = () => {
    // Renderer-only rule: UI may toggle local polling state, but must never influence authority.
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

  return (
    <section
      aria-label="Foreign exchange snapshot"
      data-testid="finance-ribbon"
      data-mode={mode}
      data-build-id={buildId}
      className="w-full overflow-hidden rounded-2xl bg-slate-950 px-3 py-2 text-xs text-slate-50 shadow-md ring-1 ring-slate-800"
    >
      <div className="flex items-center justify-between gap-2">
        <ul
          aria-label="Foreign exchange pairs"
          data-testid="fx-row"
          className="flex flex-wrap items-center justify-center gap-2"
        >
          {chips.map((chip) => {
            const priceClasses = [
              'tabular-nums',
              'fx-price',
              chip.tick === 'up'
                ? 'fx-tick-up'
                : chip.tick === 'down'
                ? 'fx-tick-down'
                : 'fx-tick-flat',
              chip.isNeutral ? 'fx-neutral-breathe' : '',
              chip.tick === 'up' ? 'fx-whisper-up' : chip.tick === 'down' ? 'fx-whisper-down' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <li
                key={chip.id}
                className="flex items-baseline gap-1 rounded-full bg-slate-900 px-3 py-1 text-[11px] leading-none"
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
          })}
        </ul>

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
    </section>
  );
};

export default FinanceRibbon;
