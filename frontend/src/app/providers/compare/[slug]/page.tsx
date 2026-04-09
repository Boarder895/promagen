// src/app/platforms/compare/[slug]/page.tsx
// ============================================================================
// COMPARISON PAIR — AUTHORITY PAGE (Priority 4)
// ============================================================================
// 8 pre-rendered "X vs Y" pages capturing high-intent search queries.
// Each page compares two platforms side-by-side with factual, citation-ready
// content derived from the SSOT + editorial layer.
//
// RULES:
//   - Platform facts from SSOT (platform-config.json) — zero hardcoded numbers
//   - Editorial content from comparison-pairs.ts — separated from data layer
//   - Presentation constants from @/lib/authority/presentation (shared)
//   - Shared components: Breadcrumb, FaqItem, Section
//   - Zero opacity dimming, zero banned greys, all sizing via clamp()
//   - generateStaticParams() produces exactly 8 routes
//
// Authority: promagen-ai-authority-pages-FINAL-v1.2.md §4.2 PAGE 3
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
  TIER_META,
  type AuthorityPlatform,
} from '@/lib/authority/platform-data';
import {
  getComparisonSlugs,
  getComparisonPairBySlug,
  getRelatedComparisons,
} from '@/lib/authority/comparison-pairs';
import {
  getTierBadge,
  NEG_SUPPORT_COLOR,
  NEG_SUPPORT_LABEL,
  TABLE_CELL_PAD,
  DIVIDER,
  CARD_BG,
  CARD_BORDER,
} from '@/lib/authority/presentation';
import { env } from '@/lib/env';
import { Breadcrumb } from '@/components/authority/breadcrumb';
import { FaqItem, Section } from '@/components/authority/shared';

// ISR: rebuild once per day
export const revalidate = 86400;

type Params = { slug: string };

// ─── Static params (exactly 8 routes) ──────────────────────────────────────

export function generateStaticParams(): Params[] {
  return getComparisonSlugs().map((slug) => ({ slug }));
}

// ─── Dynamic metadata ──────────────────────────────────────────────────────

const BASE = env.siteUrl;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const pair = getComparisonPairBySlug(slug);
  if (!pair) return { title: 'Comparison not found | Promagen', robots: { index: false, follow: false } };

  const a = getAuthorityPlatformById(pair.platformAId);
  const b = getAuthorityPlatformById(pair.platformBId);
  if (!a || !b) return { title: 'Comparison not found | Promagen', robots: { index: false, follow: false } };

  const title = `${a.name} vs ${b.name} — Prompt Format Comparison | Promagen`;
  const description = `Side-by-side comparison of ${a.name} and ${b.name}: prompt format, character limits, negative prompt support, and tier classification. Data-backed analysis from Promagen's platform intelligence.`;

  return {
    title,
    description,
    alternates: { canonical: `${BASE}/platforms/compare/${slug}` },
    openGraph: {
      title, description,
      url: `${BASE}/platforms/compare/${slug}`,
      type: 'website',
      siteName: 'Promagen',
      images: [{ url: '/og.png', width: 1200, height: 630, alt: `${a.name} vs ${b.name} — Promagen Comparison` }],
    },
    twitter: { card: 'summary_large_image', title, description, images: ['/og.png'] },
  };
}

// ─── JSON-LD ───────────────────────────────────────────────────────────────

function buildJsonLd(
  slug: string,
  aName: string,
  bName: string,
  faq: { question: string; answer: string }[],
) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Promagen', item: BASE },
          { '@type': 'ListItem', position: 2, name: 'AI Image Generators', item: `${BASE}/platforms` },
          { '@type': 'ListItem', position: 3, name: `${aName} vs ${bName}`, item: `${BASE}/platforms/compare/${slug}` },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
      },
    ],
  };
}

// ─── Comparison row type ────────────────────────────────────────────────────

interface ComparisonRow {
  label: string;
  cellA: React.ReactNode;
  cellB: React.ReactNode;
}

/** Build rows from live SSOT data — zero hardcoded values */
function buildComparisonRows(a: AuthorityPlatform, b: AuthorityPlatform): ComparisonRow[] {
  const tierA = TIER_META[a.tier] ?? { shortName: `T${a.tier}`, name: 'Unknown', promptStyle: '' };
  const tierB = TIER_META[b.tier] ?? { shortName: `T${b.tier}`, name: 'Unknown', promptStyle: '' };

  return [
    {
      label: 'Tier',
      cellA: <TierBadgeInline tier={a.tier} shortName={tierA.shortName} name={tierA.name} />,
      cellB: <TierBadgeInline tier={b.tier} shortName={tierB.shortName} name={tierB.name} />,
    },
    {
      label: 'Prompt Style',
      cellA: <span className="text-white">{tierA.promptStyle}</span>,
      cellB: <span className="text-white">{tierB.promptStyle}</span>,
    },
    {
      label: 'Negative Prompts',
      cellA: <NegCell platform={a} />,
      cellB: <NegCell platform={b} />,
    },
    {
      label: 'Sweet Spot',
      cellA: <span className="text-white tabular-nums">{a.sweetSpot > 0 ? `${a.sweetSpot} chars` : '\u2014'}</span>,
      cellB: <span className="text-white tabular-nums">{b.sweetSpot > 0 ? `${b.sweetSpot} chars` : '\u2014'}</span>,
    },
    {
      label: 'Character Range',
      cellA: <CharRange p={a} />,
      cellB: <CharRange p={b} />,
    },
    {
      label: 'Architecture',
      cellA: <span className="text-white">{a.architecture}</span>,
      cellB: <span className="text-white">{b.architecture}</span>,
    },
  ];
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default async function ComparisonPairPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const pair = getComparisonPairBySlug(slug);
  if (!pair) notFound();

  const a = getAuthorityPlatformById(pair.platformAId);
  const b = getAuthorityPlatformById(pair.platformBId);
  if (!a || !b) notFound();

  const lastUpdated = getLastUpdated();
  const badgeA = getTierBadge(a.tier);
  const badgeB = getTierBadge(b.tier);
  const tierA = TIER_META[a.tier] ?? { shortName: `T${a.tier}`, name: 'Unknown' };
  const tierB = TIER_META[b.tier] ?? { shortName: `T${b.tier}`, name: 'Unknown' };
  const rows = buildComparisonRows(a, b);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildJsonLd(slug, a.name, b.name, pair.faq)),
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
            { label: 'AI Image Generators', href: '/platforms' },
            { label: `${a.name} vs ${b.name}` },
          ]}
        />

        {/* ── Hero ────────────────────────────────────────────────── */}
        <header style={{ marginBottom: 'clamp(28px, 3vw, 48px)' }}>
          <h1
            className="font-bold text-white tracking-tight leading-tight"
            style={{
              fontSize: 'clamp(28px, 3vw, 48px)',
              marginBottom: 'clamp(12px, 1.3vw, 20px)',
            }}
          >
            <PlatformHeading platform={a} badge={badgeA} tierShort={tierA.shortName} />
            <span className="block text-amber-400" style={{ fontSize: 'clamp(18px, 1.6vw, 26px)', margin: `clamp(4px, 0.4vw, 8px) 0` }}>
              vs
            </span>
            <PlatformHeading platform={b} badge={badgeB} tierShort={tierB.shortName} />
          </h1>
          <p
            className="text-white leading-relaxed"
            style={{
              fontSize: 'clamp(14px, 1.1vw, 18px)',
              maxWidth: 'clamp(500px, 55vw, 760px)',
            }}
          >
            Side-by-side prompt compatibility comparison based on Promagen&apos;s platform intelligence data.
            All facts derived from verified platform analysis — not subjective rankings.
          </p>
        </header>

        {/* ── Comparison table ─────────────────────────────────────── */}
        <section style={{ marginBottom: 'clamp(32px, 4vw, 56px)' }}>
          <h2
            className="text-white font-semibold"
            style={{
              fontSize: 'clamp(18px, 1.5vw, 24px)',
              marginBottom: 'clamp(10px, 1.2vw, 18px)',
            }}
          >
            Prompt Compatibility Comparison
          </h2>

          <div
            className="overflow-x-auto rounded-xl"
            style={{ border: DIVIDER, maxWidth: 'clamp(600px, 70vw, 1000px)' }}
          >
            <table
              className="w-full border-collapse"
              style={{ fontSize: 'clamp(12px, 0.9vw, 15px)' }}
            >
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: DIVIDER }}>
                  <th className="text-amber-400 font-semibold text-left" style={{ padding: `clamp(8px, 1vw, 14px) clamp(10px, 1.2vw, 18px)` }}>&nbsp;</th>
                  <th className="font-semibold text-left" style={{ padding: `clamp(8px, 1vw, 14px) clamp(10px, 1.2vw, 18px)`, color: badgeA.border }}>{a.name}</th>
                  <th className="font-semibold text-left" style={{ padding: `clamp(8px, 1vw, 14px) clamp(10px, 1.2vw, 18px)`, color: badgeB.border }}>{b.name}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={row.label}
                    style={{
                      background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    <td className="text-amber-400 font-medium" style={{ padding: TABLE_CELL_PAD, whiteSpace: 'nowrap' }}>{row.label}</td>
                    <td style={{ padding: TABLE_CELL_PAD }}>{row.cellA}</td>
                    <td style={{ padding: TABLE_CELL_PAD }}>{row.cellB}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Key difference ──────────────────────────────────────── */}
        <Section title="Key difference">
          <p className="text-white leading-relaxed" style={{ fontSize: 'clamp(13px, 1vw, 16px)' }}>
            {pair.keyDifference}
          </p>
          <p
            className="text-amber-300 font-medium leading-relaxed"
            style={{
              fontSize: 'clamp(13px, 1vw, 16px)',
              marginTop: 'clamp(10px, 1vw, 16px)',
            }}
          >
            {pair.chooseWhen}
          </p>
        </Section>

        {/* ── Why this matters ────────────────────────────────────── */}
        <Section title="Why this matters for your workflow">
          <p className="text-white leading-relaxed" style={{ fontSize: 'clamp(13px, 1vw, 16px)' }}>
            {pair.workflowGuidance}
          </p>
        </Section>

        {/* ── Platform profile links ──────────────────────────────── */}
        <Section title="Full platform profiles">
          <div className="flex flex-wrap" style={{ gap: 'clamp(10px, 1.2vw, 18px)' }}>
            <ProfileLink platform={a} />
            <ProfileLink platform={b} />
          </div>
        </Section>

        {/* ── FAQ ─────────────────────────────────────────────────── */}
        <Section title="Frequently asked questions">
          {pair.faq.map((f) => (
            <FaqItem key={f.question} question={f.question} answer={f.answer} />
          ))}
        </Section>

        {/* ── Related comparisons ───────────────────────────────── */}
        <RelatedComparisons currentSlug={slug} />

        {/* ── CTA ─────────────────────────────────────────────────── */}
        <section style={{ marginBottom: 'clamp(40px, 5vw, 72px)', textAlign: 'center' }}>
          <div className="flex flex-wrap justify-center" style={{ gap: 'clamp(10px, 1.2vw, 18px)' }}>
            <CtaButton platformId={a.id} platformName={a.name} />
            <CtaButton platformId={b.id} platformName={b.name} />
          </div>
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
            Platform data sourced from Promagen&apos;s platform intelligence database.
            Last verified: <span className="text-amber-400">{lastUpdated}</span>.
            All comparisons are factual and data-backed — not subjective rankings.
          </p>
        </footer>
      </main>
    </>
  );
}

// ─── Extracted helper components (keep page body lean) ──────────────────────

function PlatformHeading({
  platform,
  badge,
  tierShort,
}: {
  platform: AuthorityPlatform;
  badge: ReturnType<typeof getTierBadge>;
  tierShort: string;
}) {
  return (
    <span className="flex items-center flex-wrap" style={{ gap: 'clamp(8px, 0.8vw, 14px)' }}>
      {platform.localIcon && (
        <Image
          src={platform.localIcon}
          alt=""
          width={36}
          height={36}
          className="rounded-lg flex-shrink-0"
          style={{ width: 'clamp(28px, 2.5vw, 40px)', height: 'clamp(28px, 2.5vw, 40px)' }}
        />
      )}
      <span>{platform.name}</span>
      <span
        className="inline-block rounded-lg font-semibold"
        style={{
          fontSize: 'clamp(11px, 0.85vw, 14px)',
          padding: `clamp(2px, 0.2vw, 4px) clamp(6px, 0.6vw, 10px)`,
          background: `${badge.bg}22`,
          color: badge.border,
          border: `1px solid ${badge.border}44`,
        }}
      >
        {tierShort}
      </span>
    </span>
  );
}

function TierBadgeInline({ tier, shortName, name }: { tier: number; shortName: string; name: string }) {
  const badge = getTierBadge(tier);
  return (
    <span className="flex items-center" style={{ gap: 'clamp(4px, 0.4vw, 8px)' }}>
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
        {shortName}
      </span>
      <span className="text-white">{name}</span>
    </span>
  );
}

function NegCell({ platform }: { platform: AuthorityPlatform }) {
  return (
    <span style={{ color: NEG_SUPPORT_COLOR[platform.negativeSupport] }}>
      {NEG_SUPPORT_LABEL[platform.negativeSupport]}
      {platform.negativeSupport === 'inline' && platform.negativeSyntaxDisplay
        ? ` (${platform.negativeSyntaxDisplay})`
        : ''}
    </span>
  );
}

function CharRange({ p }: { p: AuthorityPlatform }) {
  return (
    <span className="text-white tabular-nums">
      {p.idealMin}\u2013{p.idealMax} ideal{p.maxChars ? ` \u00b7 ${p.maxChars} max` : ''}
    </span>
  );
}

function ProfileLink({ platform }: { platform: AuthorityPlatform }) {
  const badge = getTierBadge(platform.tier);
  return (
    <Link
      href={`/platforms/${platform.id}`}
      className="rounded-xl hover:text-amber-400 cursor-pointer transition-colors flex items-center"
      style={{
        gap: 'clamp(8px, 0.8vw, 14px)',
        padding: `clamp(12px, 1.3vw, 20px) clamp(16px, 1.8vw, 26px)`,
        background: CARD_BG,
        border: CARD_BORDER,
        fontSize: 'clamp(13px, 1vw, 16px)',
        color: badge.border,
      }}
    >
      {platform.localIcon && (
        <Image
          src={platform.localIcon}
          alt=""
          width={24}
          height={24}
          className="rounded-sm flex-shrink-0"
          style={{ width: 'clamp(20px, 1.6vw, 28px)', height: 'clamp(20px, 1.6vw, 28px)' }}
        />
      )}
      <span className="font-medium text-white">{platform.name}</span>
      <span className="text-amber-400" style={{ fontSize: 'clamp(11px, 0.85vw, 14px)' }}>
        Full profile \u2192
      </span>
    </Link>
  );
}

function CtaButton({ platformId, platformName }: { platformId: string; platformName: string }) {
  return (
    <Link
      href={`/studio/playground?provider=${platformId}`}
      className="inline-block rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer transition-colors"
      style={{
        fontSize: 'clamp(13px, 1vw, 16px)',
        padding: `clamp(10px, 1.1vw, 16px) clamp(20px, 2.5vw, 36px)`,
      }}
    >
      Try {platformName} in Prompt Lab \u2192
    </Link>
  );
}
function RelatedComparisons({
  currentSlug,
}: {
  currentSlug: string;
}) {
  const related = getRelatedComparisons(currentSlug);
  if (related.length === 0) return null;

  return (
    <Section title="Other comparisons">
      <div className="flex flex-wrap" style={{ gap: 'clamp(6px, 0.6vw, 10px)' }}>
        {related.map((r) => {
          const aName = getAuthorityPlatformById(r.platformAId)?.name ?? r.platformAId;
          const bName = getAuthorityPlatformById(r.platformBId)?.name ?? r.platformBId;
          return (
            <Link
              key={r.slug}
              href={`/platforms/compare/${r.slug}`}
              className="rounded-lg text-white hover:text-amber-400 cursor-pointer transition-colors font-medium"
              style={{
                fontSize: 'clamp(12px, 0.9vw, 15px)',
                padding: `clamp(4px, 0.4vw, 7px) clamp(10px, 1vw, 16px)`,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {aName} vs {bName}
            </Link>
          );
        })}
      </div>
    </Section>
  );
}
