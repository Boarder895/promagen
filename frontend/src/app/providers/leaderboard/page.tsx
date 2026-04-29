// src/app/providers/leaderboard/page.tsx
// ============================================================================
// AI PROVIDERS LEADERBOARD — Consumer hero (cosmetic upgrade, v10.4.0)
// ============================================================================
// Pass 3d (Pass 4 prelude): replaces the bare `<main className="p-6">` wrapper
// with a properly designed dark-themed page that matches the Sentinel-side
// aesthetic. Uses the existing ProvidersTable component (unchanged) inside a
// styled card container, with a hero header, affiliate disclosure strip and
// the global footer.
//
// What's NOT in this pass (deferred to Pass 4):
//   - Cost data column per platform
//   - Filtering by budget / use-case / prompt format / negative-prompt support
//   - Tier divisions (Top picks / Best for X / Niche / Budget)
//   - Prominent "Try [Platform]" affiliate CTA per row
//   - Editorial cost-data collection
//
// Authority: docs/authority/commercial-strategy.md §2.2
// ============================================================================

import React from 'react';
import type { Metadata } from 'next';

import ProvidersTable from '@/components/providers/providers-table';
import Footer from '@/components/layout/footer';
import { env } from '@/lib/env';
import { getProvidersWithPromagenUsers, getIndexRatingsRecord } from '@/lib/providers/api';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'AI Image Generator Leaderboard — 40 Platforms Ranked | Promagen',
  description:
    'Independent leaderboard of 40 AI image generation platforms. Compare quality, prompt format, capability, and value. Updated daily.',
  alternates: { canonical: '/providers/leaderboard' },
  openGraph: {
    title: 'AI Image Generator Leaderboard — Promagen',
    description:
      'Independent leaderboard of 40 AI image platforms. Compare quality, prompt format, capability, and value.',
    type: 'website',
    siteName: 'Promagen',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Image Generator Leaderboard — Promagen',
    description:
      'Independent leaderboard of 40 AI image platforms. Compare quality, prompt format, capability, and value.',
  },
  robots: { index: true, follow: true },
};

export default async function ProvidersLeaderboardPage(): Promise<JSX.Element> {
  const providers = await getProvidersWithPromagenUsers();
  const initialRatings = await getIndexRatingsRecord(providers.map((p) => p.id));
  const demoEnabled = env.publicFlags.demoJitterEnabled;

  return (
    <main
      role="main"
      className="h-full overflow-y-auto bg-slate-950 text-slate-100"
      data-testid="providers-leaderboard-page"
    >
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section
        aria-label="Leaderboard introduction"
        className="relative w-full overflow-hidden"
        style={{
          background:
            'radial-gradient(ellipse at top, rgba(56,189,248,0.08) 0%, rgba(2,6,23,0) 60%), linear-gradient(180deg, rgba(2,6,23,0.98) 0%, rgba(2,6,23,1) 100%)',
        }}
      >
        <div
          className="mx-auto flex w-full max-w-6xl flex-col items-start"
          style={{
            padding: 'clamp(40px, 5vw, 80px) clamp(20px, 3vw, 48px) clamp(20px, 2.5vw, 36px)',
            gap: 'clamp(14px, 1.4vw, 20px)',
          }}
        >
          <span
            className="inline-flex items-center gap-2 rounded-full border border-sky-400/40 bg-sky-400/10 font-medium uppercase tracking-wide text-sky-200"
            style={{
              padding: 'clamp(4px, 0.6vw, 8px) clamp(10px, 1.2vw, 16px)',
              fontSize: 'clamp(0.65rem, 0.8vw, 0.78rem)',
              letterSpacing: '0.08em',
            }}
          >
            <span aria-hidden="true">●</span>
            40 platforms · updated daily
          </span>

          <h1
            className="font-bold leading-tight text-white"
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 3.25rem)',
              letterSpacing: '-0.02em',
            }}
          >
            The AI Image Generator{' '}
            <span className="bg-gradient-to-r from-sky-400 via-emerald-300 to-indigo-400 bg-clip-text text-transparent">
              Leaderboard
            </span>
          </h1>

          <p
            className="max-w-3xl text-slate-300"
            style={{
              fontSize: 'clamp(0.95rem, 1.15vw, 1.2rem)',
              lineHeight: 1.55,
            }}
          >
            Independent ranking of 40 AI image platforms by quality, prompt format,
            capability and value. No editorial favouritism. Affiliate links disclosed.
            Updated daily.
          </p>

          <ul
            className="flex flex-wrap items-center text-slate-400"
            style={{
              gap: 'clamp(12px, 1.4vw, 24px)',
              fontSize: 'clamp(0.75rem, 0.85vw, 0.9rem)',
              marginTop: 'clamp(4px, 0.5vw, 8px)',
            }}
          >
            <li className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="text-emerald-400">✓</span>
              Live Index Rating
            </li>
            <li className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="text-emerald-400">✓</span>
              Prompt format taxonomy
            </li>
            <li className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="text-emerald-400">✓</span>
              Negative-prompt support audit
            </li>
            <li className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="text-emerald-400">✓</span>
              Real Promagen-user counts
            </li>
          </ul>
        </div>
      </section>

      {/* ── Table card ───────────────────────────────────────────────────── */}
      <section
        aria-label="AI providers leaderboard table"
        className="w-full"
        style={{
          padding: 'clamp(20px, 2vw, 40px) clamp(16px, 2.5vw, 48px) clamp(40px, 4vw, 64px)',
        }}
      >
        <div className="mx-auto max-w-6xl">
          <div
            className="rounded-3xl border border-white/[0.08] bg-slate-950/70 shadow-sm ring-1 ring-white/10"
            style={{ padding: 'clamp(12px, 1.4vw, 24px)' }}
          >
            <ProvidersTable
              providers={providers}
              title="AI Providers Leaderboard"
              caption="Score stays far right; other columns follow the display contract."
              showRank
              initialRatings={initialRatings}
              demoEnabled={demoEnabled}
            />
          </div>

          {/* Affiliate disclosure (FTC) */}
          <p
            className="mt-6 text-slate-500"
            style={{ fontSize: 'clamp(0.7rem, 0.8vw, 0.8rem)', lineHeight: 1.6 }}
          >
            Some links to AI image platforms are affiliate links. If you sign up through one of
            them we may earn a commission at no additional cost to you. Rankings and editorial
            coverage are independent of any commercial relationship — see how we score.
          </p>
        </div>
      </section>

      <Footer />
    </main>
  );
}
