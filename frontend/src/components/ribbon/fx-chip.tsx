'use client';

import React, { useMemo, useState } from 'react';
import { formatMoney } from '@/lib/format/number';
import { computeDailyArrow } from '@/lib/fx/compute-daily-arrow';
import { useFxSelectionStore } from '@/lib/fx/selection.store';
import flags from '@/data/flags.json';

export type FxChipData = {
  id: string;
  base: string;   // GBP
  quote: string;  // USD
  label: string;  // "GBP / USD"
  value: number;      // live value
  prevClose: number;  // yesterday close
  asOf: string;       // ISO
  precision: number;  // unused in UI (2dp site rule)
};

function ageMinutes(iso: string) {
  const t = new Date(iso).getTime();
  return Math.max(0, Math.round((Date.now() - t) / 60000));
}

export default function FxChip({ data, paused }: { data: FxChipData; paused: boolean }) {
  const { invertMap, setInvert } = useFxSelectionStore();
  const [hover, setHover] = useState(false);

  const inverted = !!invertMap[data.id];

  const view = useMemo(() => {
    const base = inverted ? data.quote : data.base;
    const quote = inverted ? data.base : data.quote;

    const value = inverted && data.value ? 1 / data.value : data.value;
    const prevClose = inverted && data.prevClose ? 1 / data.prevClose : data.prevClose;

    const arrow = computeDailyArrow(prevClose, value); // 'up' | 'none'
    const label = `${base} / ${quote}`;
    const formatted = formatMoney(value, base);

    return { base, quote, value, prevClose, arrow, label, formatted };
  }, [data, inverted]);

  const minutes = ageMinutes(data.asOf);
  const stale =
    !flags.fx.staleBadge ? 'fresh' :
    minutes <= 60 ? 'fresh' :
    minutes <= 90 ? 'aging' : 'delayed';

  const showLeftArrow = view.arrow === 'up'; // base strengthened vs prior close

  return (
    <div
      role="listitem"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={[
        'group relative inline-flex items-center gap-2',
        'rounded-xl border border-white/10 bg-white/5 px-3 py-2',
        'backdrop-blur-md shadow-sm hover:shadow transition-shadow',
      ].join(' ')}
      aria-label={`${view.label}, ${view.formatted}, as of ${new Date(data.asOf).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })} local time`}
    >
      {/* Left arrow (base up) */}
      <span
        aria-hidden="true"
        className={[
          'text-emerald-400 text-sm',
          showLeftArrow ? 'opacity-100' : 'opacity-0',
          'transition-opacity duration-200',
          paused ? '!opacity-0' : '',
          'motion-reduce:transition-none',
        ].join(' ')}
      >
        ↑
      </span>

      {/* Label + value */}
      <div className="flex items-baseline gap-2">
        <span className="text-sm text-neutral-200">{view.label}</span>
        <span className="font-medium tabular-nums text-neutral-50">{view.formatted}</span>
      </div>

      {/* Right placeholder to keep symmetry */}
      <span aria-hidden="true" className="opacity-0">↑</span>

      {/* Invert */}
      <button
        type="button"
        className="ml-2 rounded-md px-1 py-0.5 text-xs text-neutral-300/80 ring-1 ring-white/10 hover:ring-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        aria-pressed={inverted}
        aria-label={`View ${view.quote} per ${view.base}`}
        onClick={() => setInvert(data.id, !inverted)}
        title={`Toggle to view ${view.quote} per ${view.base}`}
      >
        ⇄
      </button>

      {/* Micro-details popover */}
      {hover && (
        <div
          role="tooltip"
          className="absolute z-20 top-full mt-2 left-1/2 -translate-x-1/2 rounded-lg bg-neutral-900 px-3 py-2 text-xs text-neutral-200 ring-1 ring-white/10 shadow-lg"
        >
          <div className="flex justify-between gap-6">
            <span>Prior close:</span>
            <span className="tabular-nums">{formatMoney(view.prevClose, view.base)}</span>
          </div>
          <div className="flex justify-between gap-6">
            <span>Move vs close:</span>
            <span className="tabular-nums">
              {((view.value - view.prevClose) / view.prevClose * 100).toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between gap-6">
            <span>Last refresh:</span>
            <span className="tabular-nums">
              {new Date(data.asOf).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      )}

      {/* Stale badge (nuanced) */}
      {flags.fx.staleBadge && stale !== 'fresh' && (
        <span
          className={[
            'absolute -top-1 -left-1 rounded-md px-1.5 py-0.5 text-[10px] ring-1',
            stale === 'aging'
              ? 'bg-amber-400/20 text-amber-300 ring-amber-300/30'
              : 'bg-rose-400/20 text-rose-300 ring-rose-300/30'
          ].join(' ')}
          aria-label={stale === 'aging' ? 'Data aging' : 'Data delayed'}
        >
          {stale === 'aging' ? 'aging' : 'delayed'}
        </span>
      )}
    </div>
  );
}
