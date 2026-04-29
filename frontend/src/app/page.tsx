// src/app/page.tsx
// ============================================================================
// HOMEPAGE — Pure Sentinel commercial homepage (v10.2.0)
// ============================================================================
// Renders the Sentinel-led commercial story. No leaderboard, no platform
// intelligence band, no Inspire grid, no Lab card. Anyone landing on
// promagen.com sees the Sentinel pitch immediately and nothing else
// commercial competes with it above the fold.
//
// Section order (all inside SentinelLedHomepage):
//   1. Hero
//   2. Pillars (Watch / Detect / Cite / Report)
//   3. Demo (page audit + Monday report side-by-side)
//   4. Proof (Promagen as live case study + verify-it-yourself link)
//   5. CTA (mailto until booking flow lands)
//   6. Footer (discreet Resources section preserves SEO internal links)
//
// Route history:
//   v8.0.0  /          → Prompt Lab
//   v9.0.0  /          → Inspire (Scene Starters / POTM / Leaderboard)
//   v10.0.0 /          → Sentinel-led shell wrapping the Inspire grid
//   v10.2.0 /          → Pure Sentinel; Inspire grid moved to /inspire only
//
// Performance: ISR 24h. The page no longer fetches providers, weather,
// exchanges, or POTM data — those concerns moved to /inspire.
//
// Authority: docs/authority/commercial-strategy.md
// Existing features preserved: Yes (the Inspire experience still lives at
// /inspire — see src/app/inspire/page.tsx).
// ============================================================================

import React from 'react';
import type { Metadata } from 'next';

import SentinelLedHomepage from '@/components/home/sentinel-led-homepage';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Promagen — AI Platform Intelligence and AI Visibility Intelligence',
  description:
    'Sentinel watches whether AI systems can find, read, cite and send traffic to your content — then tells you exactly what to fix next, every week. Built and proven on Promagen itself.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Promagen — AI Platform Intelligence and AI Visibility Intelligence',
    description:
      'Sentinel watches whether AI systems can find, read, cite and send traffic to your content. Snapshot, Audit, Fix Sprint and Monitor packages.',
    type: 'website',
    siteName: 'Promagen',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Promagen — AI Platform Intelligence and AI Visibility Intelligence',
    description:
      'Sentinel watches whether AI systems can find, read, cite and send traffic to your content. Live on Promagen as proof.',
  },
};

export default function HomePage() {
  return <SentinelLedHomepage />;
}
