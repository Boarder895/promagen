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
  title: 'Promagen — Calm, data-rich AI providers overview',
  description: 'Live exchange rails and an AI providers leaderboard.',
};

// Build a simple lookup so ExchangeRail can resolve weather quickly.
function buildWeatherIndex(rows: ReadonlyArray<ExchangeWeather>): Map<string, ExchangeWeather> {
  return new Map(rows.map((entry) => [entry.exchange, entry]));
}

export default function HomePage() {
  const providers = getProviders();
  const { left, right } = getRailsForHomepage();
  const weatherIndex = buildWeatherIndex(DEMO_EXCHANGE_WEATHER);

  const centreRail = (
    <section
      aria-label="AI providers leaderboard"
      className="rounded-3xl bg-slate-950/70 p-4 shadow-sm ring-1 ring-white/10"
      data-testid="rail-centre-inner"
    >
      <ProvidersTable
        providers={providers}
        title="AI Providers Leaderboard"
        caption="Scores and trends are illustrative while external APIs are being wired."
        showRank
      />
    </section>
  );

  const leftRail = (
    <ExchangeRail
      exchanges={left}
      weatherByExchange={weatherIndex}
      ariaLabel="Eastern exchanges"
      testId="rail-east"
      emptyMessage="No eastern exchanges selected yet. Choose markets to populate this rail."
    />
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
      showFinanceRibbon
    />
  );
}
