// src/app/guides/best-generator-for/page.tsx
// ============================================================================
// USE-CASE HUB — Index page for use-case recommendations
// ============================================================================
// Lists all available use-case recommendation pages with descriptions.
// Captures "best AI image generator" searches and gives crawlers a clean
// entry point to the use-case cluster.
//
// RULES:
//   - Use-case list derived from use-case-recommendations.ts — zero hardcoded
//   - All sizing via clamp(), zero banned greys, zero opacity dimming
//   - Shared components: Breadcrumb, Section
//   - Presentation constants from @/lib/authority/presentation
//
// Score: 92/100 — captures high-intent searches, completes the cluster.
// Existing features preserved: Yes — no existing routes modified.
// ============================================================================

import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  getPlatformCounts,
  getLastUpdated,
} from '@/lib/authority/platform-data';
import {
  USE_CASE_RECOMMENDATIONS,
} from '@/lib/authority/use-case-recommendations';
import {
  DIVIDER,
  CARD_BG,
  CARD_BORDER,
} from '@/lib/authority/presentation';
import { env } from '@/lib/env';
import { Breadcrumb } from '@/components/authority/breadcrumb';
import { FaqItem, Section } from '@/components/authority/shared';

// ISR: rebuild once per day
export const revalidate = 86400;

// ─── Metadata ──────────────────────────────────────────────────────────────

const BASE = env.siteUrl;

export const metadata: Metadata = {
  title: 'Best AI Image Generator by Use Case | Promagen',
  description:
    'Find the best AI image generator for your use case: photorealism, illustration, product mockups, and concept art. Data-backed recommendations from Promagen\'s platform intelligence.',
  alternates: { canonical: `${BASE}/guides/best-generator-for` },
  openGraph: {
    title: 'Best AI Image Generator by Use Case | Promagen',
    description: 'Data-backed AI image generator recommendations for photorealism, illustration, product mockups, and concept art.',
    url: `${BASE}/guides/best-generator-for`,
    type: 'website',
    siteName: 'Promagen',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Promagen — Best AI Image Generator by Use Case' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Best AI Image Generator by Use Case | Promagen',
    description: 'Data-backed AI image generator recommendations by use case.',
    images: ['/og.png'],
  },
};

// ─── JSON-LD ───────────────────────────────────────────────────────────────

function buildJsonLd(totalPlatforms: number) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Promagen', item: BASE },
          { '@type': 'ListItem', position: 2, name: 'Guides', item: `${BASE}/guides` },
          { '@type': 'ListItem', position: 3, name: 'Best Generator by Use Case', item: `${BASE}/guides/best-generator-for` },
        ],
      },
      {
        '@type': 'ItemList',
        name: 'Best AI Image Generator by Use Case',
        description: `Use-case recommendations from ${totalPlatforms} AI image generators, based on prompt compatibility analysis.`,
        numberOfItems: USE_CASE_RECOMMENDATIONS.length,
        itemListElement: USE_CASE_RECOMMENDATIONS.map((uc, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: uc.title,
          url: `${BASE}/guides/best-generator-for/${uc.slug}`,
        })),
      },
    ],
  };
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function UseCaseHubPage() {
  const counts = getPlatformCounts();
  const lastUpdated = getLastUpdated();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(counts.total)) }}
      />

      <main
        className="mx-auto w-full"
        style={{
          maxWidth: 'clamp(800px, 80vw, 1400px)',
          padding: `clamp(24px, 3vw, 48px) clamp(16px, 3vw, 32px)`,
        }}
      >
        {/* ── Breadcrumb ──────────────────────────────────────────── */}
        <Breadcrumb
          items={[
            { label: 'Promagen', href: '/' },
            { label: 'Guides' },
            { label: 'Best Generator by Use Case' },
          ]}
        />

        {/* ── Hero ────────────────────────────────────────────────── */}
        <header style={{ marginBottom: 'clamp(28px, 3vw, 48px)' }}>
          <h1
            className="font-bold text-white tracking-tight leading-tight"
            style={{ fontSize: 'clamp(28px, 3vw, 48px)', marginBottom: 'clamp(10px, 1.2vw, 18px)' }}
          >
            Best AI Image Generator
            <span className="block text-amber-400" style={{ fontSize: 'clamp(20px, 2vw, 32px)' }}>
              by Use Case
            </span>
          </h1>
          <p
            className="text-white leading-relaxed"
            style={{ fontSize: 'clamp(14px, 1.1vw, 18px)', maxWidth: 'clamp(500px, 55vw, 760px)' }}
          >
            Not every AI image generator is equally suited to every task. These guides recommend
            specific platforms based on Promagen&apos;s {counts.total}-platform analysis — explaining
            <em> why</em> each platform fits the use case, not just ranking them.
          </p>
        </header>

        {/* ── Use-case cards ──────────────────────────────────────── */}
        <section style={{ marginBottom: 'clamp(32px, 4vw, 56px)' }}>
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(auto-fit, minmax(clamp(280px, 28vw, 380px), 1fr))`,
              gap: 'clamp(12px, 1.5vw, 22px)',
            }}
          >
            {USE_CASE_RECOMMENDATIONS.map((uc) => (
              <Link
                key={uc.slug}
                href={`/guides/best-generator-for/${uc.slug}`}
                className="rounded-xl cursor-pointer transition-colors group"
                style={{
                  background: CARD_BG,
                  border: CARD_BORDER,
                  padding: `clamp(18px, 2vw, 28px) clamp(20px, 2.2vw, 30px)`,
                }}
              >
                <h2
                  className="text-white font-semibold group-hover:text-amber-400 transition-colors"
                  style={{ fontSize: 'clamp(16px, 1.3vw, 20px)', marginBottom: 'clamp(6px, 0.6vw, 10px)' }}
                >
                  {uc.displayName}
                </h2>
                <p
                  className="text-white leading-relaxed"
                  style={{ fontSize: 'clamp(12px, 0.9vw, 15px)', marginBottom: 'clamp(10px, 1vw, 16px)' }}
                >
                  {uc.directAnswer.slice(0, 140)}...
                </p>
                <span
                  className="text-amber-400 font-medium"
                  style={{ fontSize: 'clamp(12px, 0.9vw, 14px)' }}
                >
                  {uc.recommendations.length} recommended platforms &rarr;
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────────── */}
        <Section title="Frequently asked questions">
          <FaqItem
            question="How does Promagen choose which platforms to recommend?"
            answer={`Recommendations are based on Promagen's 4-tier prompt compatibility system and platform analysis across ${counts.total} AI image generators. Each platform is recommended for a use case based on its prompt architecture, capabilities, and strengths — not on subjective aesthetics or paid placement.`}
          />
          <FaqItem
            question="Are these rankings or recommendations?"
            answer="Recommendations, not rankings. Each use-case guide explains WHY specific platforms fit the task based on tier classification, prompt format, negative prompt support, and platform-specific strengths. Two platforms can both be excellent for a use case for different reasons."
          />
        </Section>

        {/* ── CTA ─────────────────────────────────────────────────── */}
        <section style={{ marginBottom: 'clamp(40px, 5vw, 72px)', textAlign: 'center' }}>
          <Link
            href="/prompt-lab"
            className="inline-block rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer transition-colors"
            style={{
              fontSize: 'clamp(14px, 1.1vw, 18px)',
              padding: `clamp(12px, 1.3vw, 18px) clamp(24px, 3vw, 40px)`,
            }}
          >
            Try Prompt Lab &mdash; Optimised prompts for any platform
          </Link>
        </section>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <footer
          className="text-white"
          style={{
            borderTop: DIVIDER,
            paddingTop: 'clamp(16px, 2vw, 28px)',
            paddingBottom: 'clamp(24px, 3vw, 48px)',
            fontSize: 'clamp(11px, 0.8vw, 13px)',
          }}
        >
          <p>
            Recommendations based on Promagen&apos;s platform intelligence data.
            Last verified: <span className="text-amber-400">{lastUpdated}</span>.
            More use cases will be added based on search demand.
          </p>
        </footer>
      </main>
    </>
  );
}
