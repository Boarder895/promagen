// src/app/page.tsx
// ============================================================================
// NEW HOMEPAGE - Server Component (ISR)
// ============================================================================
// The prompt-focused homepage replaces the former financial-data-first layout.
// The original layout (exchange rails, FX ribbons, etc.) now lives at /world-context.
//
// Performance strategy:
// - ISR with 60s revalidation (not force-dynamic)
// - Providers + exchanges are sync JSON reads (instant)
// - Weather fetch is non-blocking with 2s timeout + empty fallback
//   (client-side useWeather() refreshes after hydration anyway)
// - ★ POTM generated SERVER-SIDE using SSR weather data — arrives in the
//   initial HTML, eliminating the 2-second client-fetch waterfall.
//   The client hook still handles 3-minute rotation refreshes.
//
// Authority: docs/authority/homepage.md
//
// Existing features preserved: Yes
// - Leaderboard table stays on new homepage
// - Engine Bay stays
// - Mission Control stays (+ World Context button)
// - All other pages untouched
// ============================================================================

import React from 'react';
import type { Metadata } from 'next';

// ISR: serve from cache, revalidate in background every 60 seconds.
export const revalidate = 60;

import NewHomepageClient from '@/components/home/new-homepage-client';
import { getProvidersWithPromagenUsers, getIndexRatingsRecord } from '@/lib/providers/api';
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
  title: 'Promagen: Prompt Builder for 40 Image Platforms',
  description:
    'Most prompts lose detail between what you imagine and what the platform receives. Promagen rebuilds your words in each platform\'s native language. 40 platforms. One click.',
};

// ============================================================================
// WEATHER CONVERSION HELPER
// ============================================================================

/**
 * Convert SSR ExchangeWeatherData → ExchangeWeatherFull for the POTM generator.
 * The SSR weatherIndex uses short field names (tempC, windKmh); the prompt
 * generator expects the full field names (temperatureC, windSpeedKmh).
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

/**
 * HomePage — Server component for the new prompt-focused homepage.
 *
 * Weather is fetched with a tight 2s timeout — if the gateway is slow,
 * the page renders immediately with an empty weather map. The client-side
 * useWeather() hook fills it in after hydration (~1-2s later). This means
 * weather tooltips may flash from empty to populated, but the page loads
 * instantly instead of waiting 5+ seconds for the gateway.
 *
 * ★ POTM is now generated server-side using the same weatherIndex,
 * so it appears in the initial HTML with zero client-side fetch latency.
 */
export default async function HomePage() {
  // Providers + Index Ratings: parallel async fetch from DB
  const providers = await getProvidersWithPromagenUsers();
  const allExchanges = getHomepageExchanges();

  // Index Ratings: server-side prefetch eliminates 10-20s client waterfall
  const initialRatings = await getIndexRatingsRecord(providers.map((p) => p.id));

  // Weather: non-blocking with 2s timeout. Empty map fallback.
  // Client-side useWeather() refreshes after hydration anyway.
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

  // ★ Generate POTM server-side using the SSR weather data.
  // This eliminates the 2-second client-fetch waterfall entirely.
  // If weather data is empty (timeout), demo weather is used — the
  // client hook will refresh with live data on the next 3-minute rotation.
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
    // If POTM generation fails during SSR, the client hook will fetch
    // from the API route as before — graceful degradation, not a crash.
    console.warn('[HomePage] SSR POTM generation failed, client will fetch:', err);
  }

  return (
    <NewHomepageClient
      exchanges={allExchanges}
      weatherIndex={weatherIndex}
      providers={providers}
      initialShowcaseData={initialShowcaseData}
      initialRatings={initialRatings}
    />
  );
}
