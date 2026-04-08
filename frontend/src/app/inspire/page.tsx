// src/app/inspire/page.tsx
// ============================================================================
// INSPIRE PAGE - Server Component (ISR)
// ============================================================================
// The prompt-showcase/discovery page. Scene Starters, Prompt of the Moment,
// Community Pulse, and the 40-platform leaderboard.
//
// This was formerly the homepage (/). The Prompt Lab now lives at /.
// The Inspire page is where users browse creative scenes, see live AI prompts,
// and discover what the community is building — before jumping into the tool.
//
// Performance strategy: identical to former homepage (ISR 60s, SSR POTM).
//
// Authority: docs/authority/homepage.md
//
// Existing features preserved: Yes
// - All Scene Starters, POTM, Community Pulse, Leaderboard untouched
// - NewHomepageClient component unchanged (receives isInspirePage prop)
// ============================================================================

import React from 'react';
import type { Metadata } from 'next';

// ISR: serve from cache, revalidate in background every 60 seconds.
export const revalidate = 60;

import NewHomepageClient from '@/components/home/new-homepage-client';
import { getProvidersWithPromagenUsers, getIndexRatingsRecord } from '@/lib/providers/api';
import { env } from '@/lib/env';
import { getHomepageExchanges } from '@/lib/exchange-order';
import { getWeatherIndex } from '@/lib/weather/fetch-weather';
import type { ExchangeWeatherData } from '@/components/exchanges/types';
import type { ExchangeWeatherFull } from '@/lib/weather/weather-types';
import type { PromptOfTheMoment } from '@/types/homepage';
import { generatePotmData } from '@/lib/homepage/generate-potm-data';

// ============================================================================
// METADATA (SEO)
// ============================================================================

export const metadata: Metadata = {
  title: 'Inspire — Scene Starters, Live Prompts & Community | Promagen',
  description:
    'Browse 200 creative scenes, see AI prompts generated from live weather data, and discover what the community is building. Find your next image idea.',
};

// ============================================================================
// WEATHER CONVERSION HELPER
// ============================================================================

/**
 * Convert SSR ExchangeWeatherData → ExchangeWeatherFull for the POTM generator.
 */
function toWeatherFull(w: ExchangeWeatherData): ExchangeWeatherFull {
  return {
    temperatureC: w.tempC ?? 15,
    temperatureF: w.tempF ?? 59,
    conditions: w.condition ?? 'Unknown',
    description: w.description ?? w.condition ?? '',
    humidity: w.humidity ?? 50,
    windSpeedKmh: w.windKmh ?? w.windSpeedKmh ?? 5,
    emoji: w.emoji ?? '🌤️',
    sunriseUtc: w.sunriseUtc ?? null,
    sunsetUtc: w.sunsetUtc ?? null,
    timezoneOffset: w.timezoneOffset ?? null,
    isDayTime: w.isDayTime ?? null,
    cloudCover: null,
    visibility: w.visibility ?? null,
    pressure: null,
    rainMm1h: null,
    snowMm1h: null,
    windDegrees: w.windDegrees ?? null,
    windGustKmh: w.windGustKmh ?? null,
    weatherId: null,
  };
}

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default async function InspirePage() {
  const providers = await getProvidersWithPromagenUsers();
  const allExchanges = getHomepageExchanges();
  const initialRatings = await getIndexRatingsRecord(providers.map((p) => p.id));
  const demoEnabled = env.publicFlags.demoJitterEnabled;

  let weatherIndex: Map<string, ExchangeWeatherData>;
  try {
    weatherIndex = await Promise.race([
      getWeatherIndex(),
      new Promise<Map<string, ExchangeWeatherData>>((resolve) =>
        setTimeout(() => resolve(new Map()), 2000),
      ),
    ]);
  } catch {
    weatherIndex = new Map();
  }

  let initialShowcaseData: PromptOfTheMoment | null = null;
  try {
    const weatherFullMap = new Map<string, ExchangeWeatherFull>();
    for (const [id, w] of weatherIndex) {
      weatherFullMap.set(id, toWeatherFull(w));
    }
    const result = generatePotmData({
      weatherLookup: (exchangeId) => weatherFullMap.get(exchangeId) ?? null,
    });
    initialShowcaseData = result.data;
  } catch (err) {
    console.warn('[InspirePage] SSR POTM generation failed, client will fetch:', err);
  }

  return (
    <NewHomepageClient
      exchanges={allExchanges}
      weatherIndex={weatherIndex}
      providers={providers}
      initialShowcaseData={initialShowcaseData}
      initialRatings={initialRatings}
      demoEnabled={demoEnabled}
      isInspirePage
    />
  );
}
