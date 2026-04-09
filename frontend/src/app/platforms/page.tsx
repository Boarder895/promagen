// src/app/platforms/page.tsx
// ============================================================================
// PLATFORM HUB — AUTHORITY PAGE (Priority 1)
// ============================================================================
// Public-facing, server-rendered reference page listing all AI image platforms
// with tier badges, prompt style, negative prompt support, and character limits.
//
// RULES:
//   - All counts derived dynamically from SSOT — zero hardcoded numbers
//   - Zero opacity dimming (no opacity-XX, no text-white/XX)
//   - All sizing via clamp() — no fixed px/rem without clamp
//   - Presentation constants from @/lib/authority/presentation (shared)
//   - Breadcrumb from @/components/authority/breadcrumb (shared)
//   - Canonical type import: @/types/provider (singular entry point)
//
// Authority: promagen-ai-authority-pages-FINAL-v1.2.md §4.2 PAGE 1
// Existing features preserved: Yes — no existing routes modified.
// ============================================================================

import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  getAuthorityPlatforms,
  getPlatformCounts,
  getLastUpdated,
  getSSOTVersion,
  TIER_META,
} from '@/lib/authority/platform-data';
import {
  getTierBadge,
  TIER_CARD_BG,
  NEG_SUPPORT_COLOR,
  NEG_SUPPORT_LABEL,
  DIVIDER,
  CARD_BG,
  CARD_BORDER,
} from '@/lib/authority/presentation';
import { env } from '@/lib/env';
import PlatformHubTable from '@/components/authority/platform-hub-table';
import { FaqItem } from '@/components/authority/shared';
import { Breadcrumb } from '@/components/authority/breadcrumb';

// ISR: rebuild once per day
export const revalidate = 86400;

// ─── Metadata ──────────────────────────────────────────────────────────────

const BASE = env.siteUrl;

export const metadata: Metadata = {
  title: 'AI Image Generators Compared by Prompt Compatibility | Promagen',
  description:
    'Compare 40 AI image generators by prompt format, character limits, negative prompt support, and tier classification. The most comprehensive prompt compatibility reference available.',
  alternates: { canonical: `${BASE}/platforms` },
  openGraph: {
    title: 'AI Image Generators Compared by Prompt Compatibility | Promagen',
    description:
      'Compare 40 AI image generators by prompt format, character limits, negative prompt support, and tier classification.',
    url: `${BASE}/platforms`,
    type: 'website',
    siteName: 'Promagen',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Promagen — AI Image Generator Comparison' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Image Generators Compared by Prompt Compatibility | Promagen',
    description:
      'Compare 40 AI image generators by prompt format, character limits, and negative prompt support.',
    images: ['/og.png'],
  },
};

// ─── JSON-LD structured data ───────────────────────────────────────────────

function buildJsonLd(platformCount: number) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Promagen', item: BASE },
          { '@type': 'ListItem', position: 2, name: 'AI Image Generators', item: `${BASE}/platforms` },
        ],
      },
      {
        '@type': 'ItemList',
        name: `${platformCount} AI Image Generators — Compared by Prompt Compatibility`,
        description: `${platformCount} AI image generators compared by prompt format, character limits, and negative prompt support.`,
        numberOfItems: platformCount,
        url: `${BASE}/platforms`,
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'What is the difference between CLIP and natural language prompts?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'CLIP-based platforms (Tier 1) tokenise prompts into weighted keywords like (term:1.2). Natural language platforms (Tier 3) read conversational sentences. The same creative intent must be written differently for each type to get the best results.',
            },
          },
          {
            '@type': 'Question',
            name: 'Do all AI image generators support negative prompts?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'No. Some platforms have a separate negative prompt field, some use inline syntax like --no, and many do not support negative prompts at all.',
            },
          },
          {
            '@type': 'Question',
            name: 'Why do prompts work differently across AI image generators?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Different platforms use different text encoders (CLIP, T5, proprietary transformers) that parse prompts in fundamentally different ways. A keyword-stacked prompt optimised for Stable Diffusion will underperform on DALL-E, which expects natural sentences.',
            },
          },
        ],
      },
    ],
  };
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function PlatformsHubPage() {
  const platforms = getAuthorityPlatforms();
  const counts = getPlatformCounts();
  const lastUpdated = getLastUpdated();
  const ssotVersion = getSSOTVersion();
  const tiers = [1, 2, 3, 4] as const;

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
            { label: 'AI Image Generators' },
          ]}
        />

        {/* ── Hero ────────────────────────────────────────────────── */}
        <header style={{ marginBottom: 'clamp(28px, 3vw, 48px)' }}>
          <h1
            className="font-bold text-white tracking-tight leading-tight"
            style={{ fontSize: 'clamp(28px, 3vw, 48px)', marginBottom: 'clamp(10px, 1.2vw, 18px)' }}
          >
            {counts.total} AI Image Generators
            <span className="block text-amber-400" style={{ fontSize: 'clamp(20px, 2vw, 32px)' }}>
              Compared by Prompt Compatibility
            </span>
          </h1>
          <p
            className="text-white leading-relaxed"
            style={{ fontSize: 'clamp(14px, 1.1vw, 18px)', maxWidth: 'clamp(500px, 55vw, 760px)' }}
          >
            Every AI image generator interprets prompts differently. Some use weighted keywords,
            others read natural sentences, and many ignore special syntax entirely. This reference
            covers every platform Promagen supports — with tier classification, character limits,
            negative prompt handling, and prompt format details.
          </p>
        </header>

        {/* ── Tier stat cards ─────────────────────────────────────── */}
        <section
          className="grid"
          style={{
            gridTemplateColumns: `repeat(auto-fit, minmax(clamp(160px, 18vw, 260px), 1fr))`,
            gap: 'clamp(10px, 1.2vw, 18px)',
            marginBottom: 'clamp(28px, 3vw, 48px)',
          }}
        >
          {tiers.map((tier) => {
            const meta = TIER_META[tier] ?? { shortName: `T${tier}`, name: 'Unknown', description: '', promptStyle: '' };
            const badge = getTierBadge(tier);
            return (
              <div
                key={tier}
                className="rounded-xl"
                style={{
                  background: TIER_CARD_BG[tier],
                  border: `1px solid ${badge.border}33`,
                  padding: `clamp(14px, 1.5vw, 22px) clamp(16px, 1.8vw, 26px)`,
                }}
              >
                <div
                  className="font-bold tabular-nums"
                  style={{ fontSize: 'clamp(26px, 2.8vw, 44px)', color: badge.border }}
                >
                  {counts.byTier[tier] ?? 0}
                </div>
                <div
                  className="font-medium text-white"
                  style={{ fontSize: 'clamp(12px, 0.85vw, 14px)' }}
                >
                  {meta.shortName} — {meta.name}
                </div>
              </div>
            );
          })}
        </section>

        {/* ── Negative prompt summary ─────────────────────────────── */}
        <section style={{ marginBottom: 'clamp(28px, 3vw, 48px)' }}>
          <h2
            className="text-white font-semibold"
            style={{ fontSize: 'clamp(18px, 1.5vw, 24px)', marginBottom: 'clamp(8px, 1vw, 14px)' }}
          >
            Negative Prompt Support
          </h2>
          <div className="flex flex-wrap items-center" style={{ gap: 'clamp(16px, 2vw, 30px)', fontSize: 'clamp(13px, 1vw, 16px)' }}>
            {(['separate', 'inline', 'none'] as const).map((key) => (
              <span key={key} className="flex items-center" style={{ gap: 'clamp(4px, 0.4vw, 8px)' }}>
                <span className="font-bold tabular-nums" style={{ color: NEG_SUPPORT_COLOR[key] }}>
                  {counts.byNegativeSupport[key] ?? 0}
                </span>
                <span className="text-white">{NEG_SUPPORT_LABEL[key]}</span>
              </span>
            ))}
            <Link
              href="/platforms/negative-prompts"
              className="text-amber-400 hover:text-amber-300 cursor-pointer transition-colors font-medium"
              style={{ fontSize: 'clamp(12px, 0.9vw, 15px)' }}
            >
              Full negative prompt guide →
            </Link>
            <Link
              href="/platforms/compare/midjourney-vs-dalle"
              className="text-amber-400 hover:text-amber-300 cursor-pointer transition-colors font-medium"
              style={{ fontSize: 'clamp(12px, 0.9vw, 15px)' }}
            >
              Compare platforms →
            </Link>
          </div>
        </section>

        {/* ── Platform table (client component — progressive filtering) ── */}
        <section style={{ marginBottom: 'clamp(32px, 4vw, 56px)' }}>
          <h2
            className="text-white font-semibold"
            style={{ fontSize: 'clamp(18px, 1.5vw, 24px)', marginBottom: 'clamp(10px, 1.2vw, 18px)' }}
          >
            All Platforms
          </h2>

          <PlatformHubTable
            platforms={platforms}
            tierMeta={Object.fromEntries(
              Object.entries(TIER_META).map(([k, v]) => [
                Number(k),
                { shortName: v.shortName, name: v.name, promptStyle: v.promptStyle },
              ]),
            )}
          />

          <p className="text-white" style={{ fontSize: 'clamp(11px, 0.8vw, 13px)', marginTop: 'clamp(8px, 1vw, 14px)' }}>
            Data derived from <span className="text-amber-400">platform-config.json</span> (SSOT v{ssotVersion}) — last updated {lastUpdated}
          </p>
        </section>

        {/* ── 4-Tier Explainer ────────────────────────────────────── */}
        <section style={{ marginBottom: 'clamp(32px, 4vw, 56px)' }}>
          <h2
            className="text-white font-semibold"
            style={{ fontSize: 'clamp(18px, 1.5vw, 24px)', marginBottom: 'clamp(10px, 1.2vw, 18px)' }}
          >
            The 4-Tier Prompt Compatibility System
          </h2>
          <p
            className="text-white leading-relaxed"
            style={{
              fontSize: 'clamp(13px, 1vw, 16px)',
              marginBottom: 'clamp(16px, 2vw, 28px)',
              maxWidth: 'clamp(500px, 55vw, 760px)',
            }}
          >
            Promagen classifies every AI image generator into one of four tiers based on how
            its text encoder processes prompts. This is an architectural classification, not a
            quality ranking — each tier describes how the platform reads your words.
          </p>

          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(auto-fit, minmax(clamp(240px, 24vw, 320px), 1fr))`,
              gap: 'clamp(10px, 1.2vw, 18px)',
            }}
          >
            {tiers.map((tier) => {
              const meta = TIER_META[tier] ?? { shortName: `T${tier}`, name: 'Unknown', description: '', promptStyle: '' };
              const badge = getTierBadge(tier);
              const count = counts.byTier[tier] ?? 0;
              const tierPlatforms = platforms.filter((p) => p.tier === tier).map((p) => p.name);

              return (
                <div
                  key={tier}
                  className="rounded-xl"
                  style={{
                    background: TIER_CARD_BG[tier],
                    border: `1px solid ${badge.border}33`,
                    padding: `clamp(14px, 1.5vw, 22px) clamp(16px, 1.8vw, 26px)`,
                  }}
                >
                  <div className="flex items-baseline" style={{ gap: 'clamp(4px, 0.5vw, 8px)', marginBottom: 'clamp(6px, 0.6vw, 10px)' }}>
                    <span className="font-bold" style={{ fontSize: 'clamp(16px, 1.3vw, 22px)', color: badge.border }}>
                      {meta.shortName}
                    </span>
                    <span className="font-medium text-white" style={{ fontSize: 'clamp(14px, 1.1vw, 18px)' }}>
                      {meta.name}
                    </span>
                  </div>
                  <p className="text-white" style={{ fontSize: 'clamp(12px, 0.85vw, 14px)', marginBottom: 'clamp(8px, 1vw, 14px)' }}>
                    {meta.description}
                  </p>
                  <p className="text-amber-300" style={{ fontSize: 'clamp(11px, 0.8vw, 13px)' }}>
                    <span className="font-semibold">{count} platform{count !== 1 ? 's' : ''}:</span>{' '}
                    {tierPlatforms.join(', ')}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────────── */}
        <section style={{ marginBottom: 'clamp(32px, 4vw, 56px)' }}>
          <h2
            className="text-white font-semibold"
            style={{ fontSize: 'clamp(18px, 1.5vw, 24px)', marginBottom: 'clamp(14px, 1.5vw, 24px)' }}
          >
            Frequently Asked Questions
          </h2>

          <div style={{ maxWidth: 'clamp(500px, 55vw, 760px)' }}>
            <FaqItem
              question="Which AI image generator is best?"
              answer="It depends on your use case and prompt style. CLIP-based platforms (Tier 1) excel with weighted keyword stacking for precise control. Midjourney (Tier 2) produces outstanding atmosphere and cinematic compositions. Natural Language platforms like DALL-E and Flux (Tier 3) handle conversational descriptions best. Plain Language platforms (Tier 4) are the most accessible entry point. Promagen helps you write the right prompt format for whichever platform you choose."
            />
            <FaqItem
              question="What is the difference between CLIP and natural language prompts?"
              answer="CLIP-based platforms tokenise your prompt into weighted keywords — syntax like (term:1.2) tells the model to emphasise that concept. Natural language platforms read conversational sentences and don't understand weight syntax at all. Writing a CLIP-style prompt for a natural language platform (or vice versa) produces worse results than using the correct format."
            />
            <FaqItem
              question="Do all AI image generators support negative prompts?"
              answer={`No. Of the ${counts.total} platforms Promagen tracks, ${counts.byNegativeSupport['separate'] ?? 0} have a separate negative prompt field, ${counts.byNegativeSupport['inline'] ?? 0} use inline syntax (like Midjourney's --no flag), and ${counts.byNegativeSupport['none'] ?? 0} do not support negative prompts at all. For platforms without negative prompt support, Promagen converts exclusions into positive reinforcement.`}
            />
            <FaqItem
              question="Why do prompts work differently across AI image generators?"
              answer="Different platforms use different text encoders — CLIP, T5, proprietary transformers — that parse prompts in fundamentally different ways. A keyword-stacked prompt optimised for Stable Diffusion will underperform on DALL-E, which expects natural sentences. Promagen's 4-tier system classifies every platform by its encoder architecture so you always write in the format the platform actually understands."
            />
            <FaqItem
              question="What are character limits and sweet spots?"
              answer="Every platform has a maximum character (or token) limit beyond which your prompt is truncated or ignored. The sweet spot is the range where the platform produces its best results — long enough to include sufficient detail, short enough to avoid confusion. These values are derived from platform documentation, API specifications, and community testing."
            />
          </div>
        </section>

        {/* ── Explore our guides ──────────────────────────────────── */}
        <section style={{ marginBottom: 'clamp(32px, 4vw, 56px)' }}>
          <h2
            className="text-white font-semibold"
            style={{ fontSize: 'clamp(18px, 1.5vw, 24px)', marginBottom: 'clamp(10px, 1.2vw, 18px)' }}
          >
            Explore Our Guides
          </h2>
          <div className="flex flex-wrap" style={{ gap: 'clamp(8px, 0.8vw, 14px)' }}>
            {[
              { href: '/guides/prompt-formats', label: 'Prompt format guide — why prompts work differently' },
              { href: '/platforms/negative-prompts', label: 'Negative prompt support — which platforms support them' },
              { href: '/about/how-we-score', label: 'How we score — BQI methodology explained' },
              { href: '/platforms/compare/midjourney-vs-dalle', label: 'Midjourney vs DALL\u00b7E 3' },
              { href: '/platforms/compare/flux-vs-stable-diffusion', label: 'Flux vs Stable Diffusion' },
              { href: '/platforms/compare/leonardo-vs-ideogram', label: 'Leonardo vs Ideogram' },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg text-white hover:text-amber-400 cursor-pointer transition-colors font-medium"
                style={{
                  fontSize: 'clamp(12px, 0.9vw, 15px)',
                  padding: `clamp(6px, 0.6vw, 10px) clamp(12px, 1.2vw, 18px)`,
                  background: CARD_BG,
                  border: CARD_BORDER,
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </section>

        {/* ── CTA ─────────────────────────────────────────────────── */}
        <section style={{ marginBottom: 'clamp(40px, 5vw, 72px)', textAlign: 'center' }}>
          <Link
            href="/studio/playground"
            className="inline-block rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer transition-colors"
            style={{
              fontSize: 'clamp(14px, 1.1vw, 18px)',
              padding: `clamp(12px, 1.3vw, 18px) clamp(24px, 3vw, 40px)`,
            }}
          >
            Try Prompt Lab — Write prompts for any platform →
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
          <p style={{ marginBottom: 'clamp(4px, 0.5vw, 8px)' }}>
            Data sourced from Promagen&apos;s platform intelligence database. Last verified:{' '}
            <span className="text-amber-400">{lastUpdated}</span>.
          </p>
          <p>
            Platform capabilities verified against live UI and API documentation.
            All counts are dynamically derived and update automatically when platforms change.
          </p>
        </footer>
      </main>
    </>
  );
}
