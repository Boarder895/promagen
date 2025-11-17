// src/app/page.tsx

import React from 'react';
import type { Metadata } from 'next';

import ProvidersTable from '@/components/providers/providers-table';
import { getProviders } from '@/lib/providers/api';
import { getRailsForHomepage, type Exchange } from '@/lib/exchange-order';
import { flag } from '@/lib/flags';
import RibbonPanel from '@/components/ribbon/ribbon-panel';
import { DEMO_EXCHANGE_WEATHER, type ExchangeWeather } from '@/lib/weather/exchange-weather';
import { resolveFeelsLike, resolveWeatherIcon } from '@/lib/weather/weather';

// ───────────────────────────────────────────────────────────────────────────────
// Route metadata (SEO/OG/Twitter/Canonical)
// ───────────────────────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: 'Promagen — Calm, data-rich market and AI overview',
  description:
    'Promagen’s home: east–west exchange rails, an AI providers leaderboard, and a focused Finance Ribbon. Calm, fast, and accessible.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Promagen — Calm, data-rich overview',
    description: 'East–west exchanges, AI providers leaderboard, and a focused Finance Ribbon.',
    url: 'https://promagen.example/',
    siteName: 'Promagen',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Promagen — Calm, data-rich overview',
    description: 'East–west exchanges, AI providers leaderboard, and a focused Finance Ribbon.',
  },
};

// ───────────────────────────────────────────────────────────────────────────────
// Page (server component)
// ───────────────────────────────────────────────────────────────────────────────
export default function HomePage(): JSX.Element {
  // Centre leaderboard data (20 items as per spec)
  const providers = getProviders(20);

  // East/West rails split per longitude rule (left = easterly half)
  const { left, right } = getRailsForHomepage();

  // Demo-weather index keyed by exchange id (e.g. "lse-london").
  const weatherIndex = new Map<string, ExchangeWeather>();
  for (const entry of DEMO_EXCHANGE_WEATHER) {
    weatherIndex.set(entry.exchange, entry);
  }

  const renderExchangeCard = (x: Exchange): JSX.Element => {
    const weather = weatherIndex.get(x.id) ?? null;
    const hasWeather = weather !== null;

    const feelsLike = weather !== null ? resolveFeelsLike(weather.tempC, weather.feelsLikeC) : null;

    const icon = weather !== null ? resolveWeatherIcon(weather) : null;

    const rawCondition = weather?.condition ?? '';
    const conditionLabel =
      rawCondition.length > 0 ? rawCondition.charAt(0).toUpperCase() + rawCondition.slice(1) : '';

    const longitudeLabel = x.longitude.toFixed(2);

    return (
      <article
        key={x.id}
        className="flex items-center justify-between rounded-2xl bg-white/80 p-3 ring-1 ring-slate-200 shadow-sm"
        aria-label={`${x.name} exchange`}
      >
        <span className="inline-flex items-center">
          <span className="mr-2" aria-hidden="true">
            {flag(x.country)}
          </span>
          <span className="font-medium">{x.name}</span>
        </span>

        <span className="flex flex-col items-end text-xs text-slate-500">
          {hasWeather && (
            <span className="mb-0.5 inline-flex items-center gap-1 leading-none">
              {icon && <span aria-hidden="true">{icon}</span>}
              {typeof feelsLike === 'number' && Number.isFinite(feelsLike) ? (
                <span className="tabular-nums">{Math.round(feelsLike)}°C</span>
              ) : (
                <span className="tabular-nums">{weather ? Math.round(weather.tempC) : '–'}°C</span>
              )}
            </span>
          )}

          <span className="tabular-nums" aria-label={`Longitude ${longitudeLabel} degrees`}>
            {longitudeLabel}°
          </span>

          {hasWeather && conditionLabel && (
            <span className="text-[11px] leading-tight text-slate-400">{conditionLabel}</span>
          )}
        </span>
      </article>
    );
  };

  return (
    <main
      role="main"
      aria-label="Promagen home"
      className="min-h-dvh bg-gradient-to-b from-slate-50 to-slate-100"
    >
      {/* Finance Ribbon block with pause control, reduced-motion respect, freshness stamp and live region */}
      <div className="mx-auto max-w-7xl px-4 pt-6">
        <RibbonPanel pairIds={['EURUSD', 'GBPUSD', 'EURGBP']} demo />
      </div>

      {/* Three-column homepage grid */}
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-3">
        {/* Eastern exchanges rail */}
        <section
          role="complementary"
          aria-label="Eastern exchanges"
          className="space-y-3"
          data-testid="rail-east"
        >
          {left.length > 0 ? (
            left.map((x: Exchange) => renderExchangeCard(x))
          ) : (
            <div className="rounded-2xl bg-white/60 p-4 ring-1 ring-slate-200" aria-live="polite">
              <p className="text-sm text-slate-600">
                No eastern exchanges selected yet. Choose markets to populate this rail.
              </p>
            </div>
          )}
        </section>

        {/* Centre: AI providers leaderboard */}
        <section
          aria-label="AI providers leaderboard"
          className="space-y-3"
          data-testid="rail-centre"
        >
          <header className="mb-2 text-center">
            <h1 className="text-2xl font-semibold">Promagen</h1>
            <p className="text-slate-600">Calm, data-rich overview.</p>
          </header>

          {providers.length > 0 ? (
            <ProvidersTable
              providers={providers}
              title="AI Providers Leaderboard"
              caption="Top providers ranked by Promagen score."
              limit={20}
              showRank
            />
          ) : (
            <div className="rounded-2xl bg-white/60 p-4 ring-1 ring-slate-200" aria-live="polite">
              <p className="text-sm text-slate-600">
                No providers to display right now. Adjust your filters or check back shortly.
              </p>
            </div>
          )}
        </section>

        {/* Western exchanges rail */}
        <section
          role="complementary"
          aria-label="Western exchanges"
          className="space-y-3"
          data-testid="rail-west"
        >
          {right.length > 0 ? (
            right.map((x: Exchange) => renderExchangeCard(x))
          ) : (
            <div className="rounded-2xl bg-white/60 p-4 ring-1 ring-slate-200" aria-live="polite">
              <p className="text-sm text-slate-600">
                No western exchanges selected yet. Choose markets to populate this rail.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
