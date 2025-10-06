// @/components/MarketsTicker.tsx
'use client';

import { useEffect, useState } from 'react';
import { MarketList, computeMarket, type MarketComputed } from '@/lib/markets';

export const MarketsTicker = () => {
  const [rows, setRows] = useState<MarketComputed[]>([]);

  useEffect(() => {
    setRows(MarketList.map((m) => computeMarket(m)));
  }, []);

  return (
    <section className="mt-4">
      <h2 className="text-sm font-semibold tracking-wide text-neutral-500 mb-2">Markets</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
        {rows.map((r) => (
          <article
            key={r.id}
            className="rounded-xl border border-neutral-200/70 dark:border-neutral-800 p-3 shadow-sm bg-white/60 dark:bg-neutral-900/40"
          >
            <header className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold tracking-widest text-neutral-500">
                  {r.symbol}
                </span>
                <span className="text-xs text-neutral-400">{r.localTime}</span>
              </div>
              <span
                className={[
                  'text-[10px] px-2 py-0.5 rounded-full border',
                  r.open
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-neutral-50 text-neutral-600 border-neutral-200',
                ].join(' ')}
              >
                {r.open ? 'Open' : 'Closed'}
              </span>
            </header>

            <div className="mt-2 text-[11px] text-neutral-700 dark:text-neutral-400">
              <div className="font-medium">{r.name}</div>
              <div className="opacity-80">Hours {r.hours}</div>
              <div className="opacity-60">{r.tz}</div>

              {!r.open && r.nextOpenMinutes != null && (
                <div className="mt-1 text-[10px] text-neutral-500">
                  Opens in{' '}
                  <span className="font-medium">
                    {Math.floor(r.nextOpenMinutes / 60)}h {r.nextOpenMinutes % 60}m
                  </span>
                </div>
              )}

              {r.holiday && <div className="mt-1 text-[10px] text-amber-600">Holiday</div>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};



