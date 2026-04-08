// src/app/page.tsx
// ============================================================================
// HOMEPAGE — Prompt Lab (the product)
// ============================================================================
// The Prompt Lab is now the homepage. When users hit promagen.com they see
// the AI prompt builder: 40 platforms, the Bletchley Machine (Decoder,
// Switchboard, Alignment), human sentence conversion, tier generation.
//
// The previous homepage (Scene Starters, POTM, Community Pulse) moved to
// /inspire. The original financial layout lives at /world-context.
//
// v8.0.0: Prompt Lab promoted from /studio/playground to /
//
// Authority: docs/authority/prompt-lab.md, docs/authority/homepage.md
//
// Existing features preserved: Yes
// - All Prompt Lab features untouched
// - PlaygroundPageClient unchanged (heading updated)
// ============================================================================

import React from 'react';
import type { Metadata } from 'next';

// Force dynamic rendering - page needs live weather data
export const dynamic = 'force-dynamic';

import PlaygroundPageClient from '@/app/studio/playground/playground-page-client';
import { getProvidersWithPromagenUsers, getIndexRatingsRecord } from '@/lib/providers/api';
import { env } from '@/lib/env';
import { getHomepageExchanges } from '@/lib/exchange-order';
import { getWeatherIndex } from '@/lib/weather/fetch-weather';

// ============================================================================
// METADATA (SEO)
// ============================================================================

export const metadata: Metadata = {
  title: 'Promagen: Intelligent Prompt Builder for 40 AI Image Platforms',
  description:
    'Most prompts lose detail between what you imagine and what the platform receives. Promagen rebuilds your words in each platform\'s native language. 40 platforms. One click.',
  openGraph: {
    title: 'Promagen — Intelligent Prompt Builder',
    description:
      'Promagen rebuilds your words in each platform\'s native language. 40 AI image platforms. One click.',
    type: 'website',
    siteName: 'Promagen',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Promagen — Intelligent Prompt Builder',
    description:
      'Promagen rebuilds your words in each platform\'s native language. 40 AI image platforms. One click.',
  },
};

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default async function HomePage() {
  const [providers, allExchanges, weatherIndex] = await Promise.all([
    getProvidersWithPromagenUsers(),
    Promise.resolve(getHomepageExchanges()),
    getWeatherIndex(),
  ]);

  const initialRatings = await getIndexRatingsRecord(providers.map((p) => p.id));
  const demoEnabled = env.publicFlags.demoJitterEnabled;

  return (
    <PlaygroundPageClient
      providers={providers}
      exchanges={allExchanges}
      weatherIndex={weatherIndex}
      initialRatings={initialRatings}
      demoEnabled={demoEnabled}
    />
  );
}
