'use client';

import { flag } from '@/lib/flags';
import { localTime } from '@/lib/time';
import type { Exchange } from '@/types/exchange';

type Props = { ex: Exchange };

export default function ExchangeCard({ ex }: Props) {
  const f = flag(ex.iso2);
  const time = localTime(ex.tz, { locale: 'en-GB' });
  const timeId = `xtime-${ex.id}`;

  return (
    <article
      className="rounded-2xl border border-white/10 bg-white/5 p-3 shadow-sm"
      role="listitem"
      aria-label={`${ex.exchange} in ${ex.city}`}
      data-testid={`exchange-${ex.id}`}
      data-analytics-id={`exchange-card:${ex.id}`}
    >
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">
          {f} {ex.exchange}
        </h3>
        <time
          id={timeId}
          className="font-mono text-xs text-white/70"
          dateTime={new Date().toISOString()}
          aria-label="Local time"
          title={`Local time for ${ex.city}`}
        >
          {time}
        </time>
      </header>
      <p className="mt-1 text-xs text-white/60">
        {ex.city} · {ex.tz}
      </p>
    </article>
  );
}
