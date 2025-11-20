// src/app/page.tsx

import React from 'react';
import type { Metadata } from 'next';

import ProvidersTable from '@/components/providers/providers-table';
import ExchangeRail from '@/components/ribbon/exchange-rail';
import HomepageGrid from '@/components/layout/homepage-grid';
import { getProviders } from '@/lib/providers/api';
import { getRailsForHomepage } from '@/lib/exchange-order';
import { DEMO_EXCHANGE_WEATHER, type ExchangeWeather } from '@/lib/weather/exchange-weather';

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
  // Centre leaderboard data (20 items as per spec).
  const providers = getProviders(20);

  // East/West rails split per longitude rule (left = easterly half).
  const { left, right } = getRailsForHomepage();

  // Demo-weather index keyed by exchange id (e.g. "lse-london").
  const weatherIndex = new Map<string, ExchangeWeather>();
  for (const entry of DEMO_EXCHANGE_WEATHER) {
    weatherIndex.set(entry.exchange, entry);
  }

  const leftRail = (
    <ExchangeRail
      exchanges={left}
      weatherByExchange={weatherIndex}
      ariaLabel="Eastern exchanges"
      testId="rail-east"
      emptyMessage="No eastern exchanges selected yet. Choose markets to populate this rail."
    />
  );

  const centreRail = (
    <section
      aria-label="AI providers leaderboard"
      className="order-first space-y-3 md:order-none"
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
  );

  const rightRail = (
    <ExchangeRail
      exchanges={right}
      weatherByExchange={weatherIndex}
      ariaLabel="Western exchanges"
      testId="rail-west"
      emptyMessage="No western exchanges selected yet. Choose markets to populate this rail."
    />
  );

  return (
    <HomepageGrid
      mainLabel="Promagen home"
      left={leftRail}
      centre={centreRail}
      right={rightRail}
      // These IDs drive the Finance Ribbon (via HomepageGrid → RibbonPanel).
      // Order here = order of chips in the FX row.
      pairIds={['EURUSD', 'GBPUSD', 'EURGBP', 'USDJPY', 'USDCNY']}
      demo
    />
  );
}
