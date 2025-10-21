'use client';

import Image from 'next/image';
import type { RibbonMarket, MarketStatus } from '@/types/ribbon';

function WeatherGlyph({ code }: { code?: string }) {
  const c = (code ?? '').toLowerCase();
  const base = 'inline-block h-4 w-4 align-[-2px]';
  if (!c) return <span className={base} aria-hidden>·</span>;
  if (c.includes('clear') || c.includes('sun')) return <span className={base} aria-hidden>☀️</span>;
  if (c.includes('rain')) return <span className={base} aria-hidden>🌧️</span>;
  if (c.includes('snow')) return <span className={base} aria-hidden>❄️</span>;
  if (c.includes('night')) return <span className={base} aria-hidden>🌙</span>;
  return <span className={base} aria-hidden>⛅</span>;
}

function statusClasses(s: MarketStatus) {
  switch (s) {
    case 'open': return 'bg-emerald-600/90 text-white';
    case 'pre': return 'bg-amber-500/90 text-black';
    case 'post': return 'bg-indigo-600/90 text-white';
    case 'holiday': return 'bg-neutral-600 text-white';
    case 'closed': return 'bg-orange-500/90 text-black';
    default: return 'bg-slate-600 text-white';
  }
}

export interface ExchangeCardProps {
  m: RibbonMarket;
  onClick?: (m: RibbonMarket) => void;
}

export default function ExchangeCard({ m, onClick }: ExchangeCardProps) {
  const temp = m.weather?.tempC ?? null;
  const condition = m.weather?.condition ?? '';
  const status: MarketStatus = m.state?.status ?? 'unknown';

  // temperature → hue: cold=blue(220), hot=red(10)
  const t = typeof temp === 'number' ? temp : 12;
  const hue = (() => {
    const min = -20, max = 40;
    const clamped = Math.max(0, Math.min(1, (t - min) / (max - min)));
    return Math.round(220 + (10 - 220) * clamped);
  })();

  const localTime = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: m.exchange.tz,
  }).format(new Date());

  return (
    <button
      type="button"
      onClick={onClick ? () => onClick(m) : undefined}
      className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-neutral-900/50 p-4 text-left shadow-lg transition hover:border-white/20"
      style={{ backgroundImage: `linear-gradient(120deg, hsl(${hue} 70% 16% / .35), transparent 60%)` }}
      aria-label={`${m.exchange.city} ${m.exchange.exchange} market card`}
    >
      {/* Left: flag + city/exchange + time */}
      <div className="flex items-center gap-3">
        <Image
          src={`/flags/${m.exchange.iso2.toLowerCase()}.svg`}
          alt={`${m.exchange.country} flag`}
          width={32}
          height={24}
          className="rounded-sm border border-white/10 shadow-sm"
          priority={false}
        />
        <div>
          <div className="text-lg font-semibold leading-tight">
            {m.exchange.city} – {m.exchange.exchange}
          </div>
          <div className="text-xs opacity-70">{localTime}</div>
        </div>
      </div>

      {/* Middle: weather */}
      <div className="flex items-center gap-2 text-sm">
        <WeatherGlyph code={condition} />
        <span>{typeof temp === 'number' ? `${Math.round(temp)}°C` : '—'}</span>
      </div>

      {/* Right: status */}
      <div className="flex items-center gap-3">
        <span className={`rounded-xl px-3 py-1 text-xs font-semibold ${statusClasses(status)}`}>
          {status.toUpperCase()}
        </span>
      </div>
    </button>
  );
}







