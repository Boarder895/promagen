// src/app/prompt-lab/page.tsx
// ============================================================================
// PROMPT LAB (the product) — v9.0.0
// ============================================================================
// The Prompt Lab is the AI prompt builder: 40 platforms, the Bletchley
// Machine (Decoder, Switchboard, Alignment), human sentence conversion,
// tier generation.
//
// Route history:
//   v8.0.0: Lived at /studio/playground, then promoted to / (homepage).
//   v9.0.0: Moved from / to /prompt-lab. Inspire promoted to homepage.
//
// Redirects in place:
//   /studio/playground  → /prompt-lab  (back-compat for bookmarks)
//
// Authority: docs/authority/prompt-lab.md, docs/authority/homepage.md
//
// Existing features preserved: Yes
// - All Prompt Lab features untouched
// - PlaygroundPageClient unchanged at the feature level
// ============================================================================

import React from 'react';
import type { Metadata } from 'next';

// Force dynamic rendering — page needs live weather data
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
  title: 'Prompt Lab — Intelligent Prompt Builder for 40 AI Image Platforms',
  description:
    'Most prompts lose detail between what you imagine and what the platform receives. Promagen\'s Prompt Lab rebuilds your words in each platform\'s native language. 40 platforms. One click.',
  openGraph: {
    title: 'Prompt Lab — Promagen',
    description:
      'Promagen\'s Prompt Lab rebuilds your words in each platform\'s native language. 40 AI image platforms. One click.',
    type: 'website',
    siteName: 'Promagen',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Prompt Lab — Promagen',
    description:
      'Promagen\'s Prompt Lab rebuilds your words in each platform\'s native language. 40 AI image platforms. One click.',
  },
};

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default async function PromptLabPage() {
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
