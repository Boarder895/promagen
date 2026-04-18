// src/app/guides/best-generator-for/[useCase]/page.tsx
// ============================================================================
// USE-CASE RECOMMENDATIONS — AUTHORITY PAGE (Priority 7)
// ============================================================================
// 4 pre-rendered pages answering "best AI image generator for [use case]".
// Each page cites Promagen's tier data as evidence for recommendations.
//
// RULES:
//   - Platform facts from SSOT — zero hardcoded numbers
//   - Editorial content from use-case-recommendations.ts
//   - Presentation constants from @/lib/authority/presentation (shared)
//   - Shared components: Breadcrumb, FaqItem, Section
//   - Build-time validation of all platform IDs
//   - All sizing via clamp(), zero banned greys, zero opacity dimming
//
// Authority: promagen-ai-authority-pages-FINAL-v1.2.md §4.2 PAGE 6
// Existing features preserved: Yes — no existing routes modified.
// ============================================================================

import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import {
  getAuthorityPlatformById,
  getLastUpdated,
  getPlatformCounts,
  TIER_META,
} from '@/lib/authority/platform-data';
import {
  getUseCaseSlugs,
  getUseCaseBySlug,
  getRelatedUseCases,
} from '@/lib/authority/use-case-recommendations';
import {
  getTierBadge,
  DIVIDER,
  CARD_BG,
  CARD_BORDER,
} from '@/lib/authority/presentation';
import { env } from '@/lib/env';
import { Breadcrumb } from '@/components/authority/breadcrumb';
import { FaqItem, Section } from '@/components/authority/shared';

// ISR: rebuild once per day
export const revalidate = 86400;

type Params = { useCase: string };

// ─── Static params (4 routes) ──────────────────────────────────────────────

export function generateStaticParams(): Params[] {
  return getUseCaseSlugs().map((slug) => ({ useCase: slug }));
}

// ─── Dynamic metadata ──────────────────────────────────────────────────────

const BASE = env.siteUrl;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { useCase } = await params;
  const uc = getUseCaseBySlug(useCase);
  if (!uc) return { title: 'Not found | Promagen', robots: { index: false, follow: false } };

  const description = uc.directAnswer.slice(0, 155) + '...';

  return {
    title: `${uc.title} | Promagen`,
    description,
    alternates: { canonical: `${BASE}/guides/best-generator-for/${uc.slug}` },
    openGraph: {
      title: `${uc.title} | Promagen`,
      description,
      url: `${BASE}/guides/best-generator-for/${uc.slug}`,
      type: 'website',
      siteName: 'Promagen',
      images: [{ url: '/og.png', width: 1200, height: 630, alt: `${uc.title} — Promagen` }],
    },
    twitter: { card: 'summary_large_image', title: `${uc.title} | Promagen`, description, images: ['/og.png'] },
  };
}

// ─── JSON-LD ───────────────────────────────────────────────────────────────

function buildJsonLd(
  uc: NonNullable<ReturnType<typeof getUseCaseBySlug>>,
  platformNames: string[],
  totalPlatforms: number,
) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Promagen', item: BASE },
          { '@type': 'ListItem', position: 2, name: 'Guides', item: `${BASE}/guides` },
          { '@type': 'ListItem', position: 3, name: uc.displayName, item: `${BASE}/guides/best-generator-for/${uc.slug}` },
        ],
      },
      {
        '@type': 'ItemList',
        name: uc.title,
        description: `Recommended AI image generators for ${uc.displayName.toLowerCase()}, selected from ${totalPlatforms} platforms based on prompt compatibility analysis.`,
        numberOfItems: platformNames.length,
        itemListElement: platformNames.map((name, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name,
        })),
      },
      {
        '@type': 'FAQPage',
        mainEntity: uc.faq.map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
      },
    ],
  };
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default async function UseCaseRecommendationPage({ params }: { params: Promise<Params> }) {
  const { useCase } = await params;
  const uc = getUseCaseBySlug(useCase);
  if (!uc) notFound();

  const lastUpdated = getLastUpdated();
  const counts = getPlatformCounts();
  const related = getRelatedUseCases(useCase);

  // Pre-resolve all recommended platforms
  const resolved = uc.recommendations.map((rec) => {
    const p = getAuthorityPlatformById(rec.platformId);
    const tier = p ? TIER_META[p.tier] : undefined;
    return { ...rec, platform: p, tier };
  });

  const platformNames = resolved.map((r) => r.platform?.name ?? r.platformId);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildJsonLd(uc, platformNames, counts.total)),
        }}
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
            { label: 'Guides', href: '/guides/prompt-formats' },
            { label: uc.displayName },
          ]}
        />

        {/* ── Hero + direct answer ─────────────────────────────────── */}
        <header style={{ marginBottom: 'clamp(28px, 3vw, 48px)' }}>
          <h1
            className="font-bold text-white tracking-tight leading-tight"
            style={{ fontSize: 'clamp(24px, 2.5vw, 40px)', marginBottom: 'clamp(12px, 1.3vw, 20px)' }}
          >
            {uc.title}
          </h1>
          <p
            className="text-white leading-relaxed"
            style={{
              fontSize: 'clamp(14px, 1.1vw, 18px)',
              maxWidth: 'clamp(500px, 55vw, 760px)',
            }}
          >
            {uc.directAnswer}
          </p>
          <p
            className="text-amber-300"
            style={{
              fontSize: 'clamp(11px, 0.85vw, 14px)',
              marginTop: 'clamp(6px, 0.6vw, 10px)',
            }}
          >
            Based on analysis of {counts.total} platforms across Promagen&apos;s 4-tier prompt compatibility system.
          </p>
        </header>

        {/* ── Recommended platforms ────────────────────────────────── */}
        <section style={{ marginBottom: 'clamp(32px, 4vw, 56px)' }}>
          <h2
            className="text-white font-semibold"
            style={{ fontSize: 'clamp(18px, 1.5vw, 24px)', marginBottom: 'clamp(14px, 1.5vw, 22px)' }}
          >
            Recommended Platforms
          </h2>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'clamp(12px, 1.3vw, 20px)',
              maxWidth: 'clamp(600px, 65vw, 900px)',
            }}
          >
            {resolved.map((rec) => {
              if (!rec.platform) return null;
              const badge = getTierBadge(rec.platform.tier);
              const tierMeta = rec.tier;

              return (
                <div
                  key={rec.platformId}
                  className="rounded-xl"
                  style={{
                    background: CARD_BG,
                    border: CARD_BORDER,
                    padding: `clamp(14px, 1.5vw, 22px) clamp(16px, 1.8vw, 26px)`,
                  }}
                >
                  <div
                    className="flex items-center flex-wrap"
                    style={{ gap: 'clamp(8px, 0.8vw, 14px)', marginBottom: 'clamp(6px, 0.6vw, 10px)' }}
                  >
                    {rec.platform.localIcon && (
                      <Image
                        src={rec.platform.localIcon}
                        alt=""
                        width={24}
                        height={24}
                        className="rounded-sm flex-shrink-0"
                        style={{ width: 'clamp(20px, 1.6vw, 28px)', height: 'clamp(20px, 1.6vw, 28px)' }}
                      />
                    )}
                    <Link
                      href={`/platforms/${rec.platformId}`}
                      className="text-white font-semibold hover:text-amber-400 cursor-pointer transition-colors"
                      style={{ fontSize: 'clamp(15px, 1.2vw, 19px)' }}
                    >
                      {rec.platform.name}
                    </Link>
                    <span
                      className="inline-block rounded-md font-semibold"
                      style={{
                        fontSize: 'clamp(10px, 0.75vw, 12px)',
                        padding: `clamp(1px, 0.2vw, 3px) clamp(5px, 0.5vw, 8px)`,
                        background: `${badge.bg}22`,
                        color: badge.border,
                        border: `1px solid ${badge.border}44`,
                      }}
                    >
                      {tierMeta?.shortName ?? `T${rec.platform.tier}`}
                    </span>
                  </div>
                  <p className="text-white leading-relaxed" style={{ fontSize: 'clamp(12px, 0.9vw, 15px)' }}>
                    {rec.reasoning}
                  </p>
                  <Link
                    href={`/prompt-lab?provider=${rec.platformId}`}
                    className="text-amber-400 hover:text-amber-300 cursor-pointer transition-colors font-medium inline-block"
                    style={{ fontSize: 'clamp(11px, 0.85vw, 14px)', marginTop: 'clamp(6px, 0.6vw, 10px)' }}
                  >
                    Try in Prompt Lab &rarr;
                  </Link>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Prompt format considerations ─────────────────────────── */}
        <Section title="Prompt format considerations">
          <p className="text-white leading-relaxed" style={{ fontSize: 'clamp(13px, 1vw, 16px)' }}>
            {uc.formatConsiderations}
          </p>
          <Link
            href="/guides/prompt-formats"
            className="text-amber-400 hover:text-amber-300 cursor-pointer transition-colors font-medium inline-block"
            style={{ fontSize: 'clamp(12px, 0.9vw, 15px)', marginTop: 'clamp(8px, 0.8vw, 12px)' }}
          >
            Full prompt format guide &rarr;
          </Link>
        </Section>

        {/* ── FAQ ─────────────────────────────────────────────────── */}
        <Section title="Frequently asked questions">
          {uc.faq.map((f) => (
            <FaqItem key={f.question} question={f.question} answer={f.answer} />
          ))}
        </Section>

        {/* ── Related use cases ────────────────────────────────────── */}
        {related.length > 0 && (
          <Section title="Other use-case guides">
            <div className="flex flex-wrap" style={{ gap: 'clamp(6px, 0.6vw, 10px)' }}>
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/guides/best-generator-for/${r.slug}`}
                  className="rounded-lg text-white hover:text-amber-400 cursor-pointer transition-colors font-medium"
                  style={{
                    fontSize: 'clamp(12px, 0.9vw, 15px)',
                    padding: `clamp(4px, 0.4vw, 7px) clamp(10px, 1vw, 16px)`,
                    background: CARD_BG,
                    border: CARD_BORDER,
                  }}
                >
                  Best for {r.displayName}
                </Link>
              ))}
            </div>
          </Section>
        )}

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
            Try Prompt Lab &mdash; Optimised prompts for {uc.displayName.toLowerCase()}
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
            Recommendations based on Promagen&apos;s platform intelligence data and 4-tier prompt
            compatibility analysis. Last verified: <span className="text-amber-400">{lastUpdated}</span>.
            Not a subjective ranking — platforms are recommended based on architectural fit for
            the use case.
          </p>
        </footer>
      </main>
    </>
  );
}
