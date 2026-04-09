// src/app/platforms/[platformId]/page.tsx
// ============================================================================
// PLATFORM PROFILE — AUTHORITY PAGE (Priority 2)
// ============================================================================
// 40 individual server-rendered pages, one per platform. Each is a definitive
// reference for that platform's prompt capabilities — the page AI systems
// (ChatGPT, Perplexity, Claude, Gemini, Google AI Overviews) cite when users
// ask about specific platforms.
//
// RULES:
//   - All data from platform-config.json (SSOT) — zero hardcoded numbers
//   - Zero opacity dimming, zero banned greys
//   - All sizing via clamp()
//   - Presentation constants from @/lib/authority/presentation (shared)
//   - Breadcrumb from @/components/authority/breadcrumb (shared)
//   - Canonical type import: @/types/provider
//   - generateStaticParams() from SSOT for all 40 platforms
//
// Authority: promagen-ai-authority-pages-FINAL-v1.2.md §4.2 PAGE 2
// Existing features preserved: Yes — no existing routes modified.
// ============================================================================

import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import {
  getAuthorityPlatformById,
  getAuthorityPlatformIds,
  getSameTierPlatforms,
  getLastUpdated,
  TIER_META,
  NEGATIVE_SUPPORT_LABEL,
} from '@/lib/authority/platform-data';
import {
  getTierBadge,
  NEG_SUPPORT_COLOR,
  DIVIDER,
} from '@/lib/authority/presentation';
import { env } from '@/lib/env';
import { FaqItem, FactCard, Section } from '@/components/authority/shared';
import { Breadcrumb } from '@/components/authority/breadcrumb';

// ISR: rebuild once per day
export const revalidate = 86400;

type Params = { platformId: string };

// ─── Static params from SSOT ───────────────────────────────────────────────

export function generateStaticParams(): Params[] {
  return getAuthorityPlatformIds().map((id) => ({ platformId: id }));
}

// ─── Dynamic metadata ──────────────────────────────────────────────────────

const BASE = env.siteUrl;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { platformId } = await params;
  const p = getAuthorityPlatformById(platformId);

  if (!p) {
    return { title: 'Platform not found | Promagen', robots: { index: false, follow: false } };
  }

  const tier = TIER_META[p.tier] ?? { shortName: `T${p.tier}`, name: 'Unknown' };
  const title = `${p.name} Prompt Format, Limits & Negative Prompts | Promagen`;
  const description = `${p.name} uses ${tier.name} prompts (${tier.shortName}). Sweet spot: ${p.sweetSpot} chars. Negative prompts: ${NEGATIVE_SUPPORT_LABEL[p.negativeSupport]}. Full prompt compatibility profile.`;

  return {
    title,
    description,
    alternates: { canonical: `${BASE}/platforms/${p.id}` },
    openGraph: {
      title, description, url: `${BASE}/platforms/${p.id}`,
      type: 'website', siteName: 'Promagen',
      images: [{ url: '/og.png', width: 1200, height: 630, alt: `${p.name} — Prompt Compatibility Profile` }],
    },
    twitter: { card: 'summary_large_image', title, description, images: ['/og.png'] },
  };
}

// ─── JSON-LD ───────────────────────────────────────────────────────────────

function buildJsonLd(p: NonNullable<ReturnType<typeof getAuthorityPlatformById>>) {
  const tier = TIER_META[p.tier] ?? { shortName: `T${p.tier}`, name: 'Unknown', description: '' };

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Promagen', item: BASE },
          { '@type': 'ListItem', position: 2, name: 'AI Image Generators', item: `${BASE}/platforms` },
          { '@type': 'ListItem', position: 3, name: p.name, item: `${BASE}/platforms/${p.id}` },
        ],
      },
      {
        '@type': 'SoftwareApplication',
        name: p.name,
        applicationCategory: 'AI Image Generator',
        url: p.website,
        description: p.tagline || `${p.name} is an AI image generator using ${tier.name} prompt format.`,
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: `What is the character limit for ${p.name}?`,
            acceptedAnswer: { '@type': 'Answer', text: p.maxChars
              ? `${p.name} accepts prompts up to ${p.maxChars} characters. The ideal range is around ${p.sweetSpot} characters.`
              : `${p.name} does not have a publicly documented character limit. The sweet spot is around ${p.sweetSpot} characters.` },
          },
          {
            '@type': 'Question',
            name: `Does ${p.name} support negative prompts?`,
            acceptedAnswer: { '@type': 'Answer', text: p.negativeSupport === 'separate'
              ? `Yes. ${p.name} has a separate negative prompt field.`
              : p.negativeSupport === 'inline'
                ? `Yes. ${p.name} uses inline negative syntax (${p.negativeSyntaxDisplay}).`
                : `No. ${p.name} does not support negative prompts.` },
          },
          {
            '@type': 'Question',
            name: `How should I write prompts for ${p.name}?`,
            acceptedAnswer: { '@type': 'Answer', text: `${p.name} is ${tier.name} (${tier.shortName}). ${tier.description}. ${p.tips}` },
          },
        ],
      },
    ],
  };
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default async function PlatformProfilePage({ params }: { params: Promise<Params> }) {
  const { platformId } = await params;
  const p = getAuthorityPlatformById(platformId);
  if (!p) notFound();

  const lastUpdated = getLastUpdated();
  const tier = TIER_META[p.tier] ?? { shortName: `T${p.tier}`, name: 'Unknown', description: '', promptStyle: '' };
  const badge = getTierBadge(p.tier);
  const sameTier = getSameTierPlatforms(p.id, p.tier);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(p)) }} />

      <main className="mx-auto w-full" style={{ maxWidth: 'clamp(700px, 70vw, 1100px)', padding: `clamp(24px, 3vw, 48px) clamp(16px, 3vw, 32px)` }}>

        {/* ── Breadcrumb ──────────────────────────────────────── */}
        <Breadcrumb
          items={[
            { label: 'Promagen', href: '/' },
            { label: 'AI Image Generators', href: '/platforms' },
            { label: p.name },
          ]}
        />

        {/* ── Header ──────────────────────────────────────────── */}
        <header style={{ marginBottom: 'clamp(28px, 3vw, 48px)' }}>
          <div className="flex items-center flex-wrap" style={{ gap: 'clamp(10px, 1vw, 18px)', marginBottom: 'clamp(10px, 1.2vw, 18px)' }}>
            {p.localIcon && (
              <Image src={p.localIcon} alt="" width={40} height={40} className="rounded-lg flex-shrink-0"
                style={{ width: 'clamp(32px, 3vw, 48px)', height: 'clamp(32px, 3vw, 48px)' }} />
            )}
            <h1 className="font-bold text-white tracking-tight leading-tight" style={{ fontSize: 'clamp(28px, 3vw, 48px)' }}>
              {p.name}
            </h1>
            <span className="inline-block rounded-lg font-semibold self-center" style={{
              fontSize: 'clamp(11px, 0.85vw, 14px)',
              padding: `clamp(3px, 0.3vw, 5px) clamp(8px, 0.8vw, 14px)`,
              background: `${badge.bg}22`, color: badge.border, border: `1px solid ${badge.border}44`,
            }}>
              {tier.shortName} — {tier.name}
            </span>
          </div>
          {p.tagline && (
            <p className="text-white" style={{ fontSize: 'clamp(14px, 1.1vw, 18px)', maxWidth: 'clamp(400px, 50vw, 700px)' }}>
              {p.tagline}
            </p>
          )}
        </header>

        {/* ── Key facts grid ──────────────────────────────────── */}
        <section className="grid" style={{
          gridTemplateColumns: `repeat(auto-fit, minmax(clamp(200px, 22vw, 300px), 1fr))`,
          gap: 'clamp(10px, 1.2vw, 18px)', marginBottom: 'clamp(28px, 3vw, 48px)',
        }}>
          <FactCard label="Prompt Style" value={tier.promptStyle} color={badge.border} />
          <FactCard
            label="Negative Prompts"
            value={NEGATIVE_SUPPORT_LABEL[p.negativeSupport]}
            color={NEG_SUPPORT_COLOR[p.negativeSupport]}
            detail={
              p.negativeSupport === 'separate'
                ? 'Dedicated exclusion field'
                : p.negativeSupport === 'inline'
                  ? p.negativeSyntaxDisplay
                  : 'Auto-converted to positive'
            }
          />
          <FactCard label="Sweet Spot" value={p.sweetSpot > 0 ? `${p.sweetSpot} characters` : 'Not documented'} color="#fbbf24" />
          <FactCard label="Character Range" value={p.maxChars ? `${p.idealMin}–${p.idealMax} ideal · ${p.maxChars} max` : `${p.idealMin}–${p.idealMax} ideal`} color="#fbbf24" />
          <FactCard label="Architecture" value={p.architecture} color="#E2E8F0" />
          <FactCard label="Country" value={p.countryCode || '—'} color="#E2E8F0" />
        </section>

        {/* ── How this platform reads prompts ─────────────────── */}
        <Section title={`How ${p.name} reads prompts`}>
          <p className="text-white leading-relaxed" style={{ fontSize: 'clamp(13px, 1vw, 16px)' }}>
            {p.name} is classified as <span style={{ color: badge.border, fontWeight: 600 }}>{tier.name} ({tier.shortName})</span> — {tier.description.toLowerCase()}.
            {p.groupKnowledge && ` ${p.groupKnowledge}`}
          </p>
        </Section>

        {/* ── Prompt tips ─────────────────────────────────────── */}
        {p.tips && (
          <Section title="Prompt tips">
            <p className="text-white leading-relaxed" style={{ fontSize: 'clamp(13px, 1vw, 16px)' }}>{p.tips}</p>
          </Section>
        )}

        {/* ── Why optimisation matters ────────────────────────── */}
        {p.optimizationBenefit && (
          <Section title="Why prompt optimisation matters">
            <p className="text-white leading-relaxed" style={{ fontSize: 'clamp(13px, 1vw, 16px)' }}>
              {p.optimizationBenefit} Promagen&apos;s Prompt Lab automatically formats your selections into {p.name}&apos;s native prompt structure.
            </p>
          </Section>
        )}

        {/* ── Negative prompt detail with cross-link ──────────── */}
        <Section title="Negative prompt support">
          <p className="text-white leading-relaxed" style={{ fontSize: 'clamp(13px, 1vw, 16px)' }}>
            {p.negativeSupport === 'separate' && (
              <>{p.name} has a <span style={{ color: NEG_SUPPORT_COLOR.separate, fontWeight: 600 }}>separate negative prompt field</span> — you can specify elements to exclude in a dedicated input. This is the most powerful form of negative prompt support.</>
            )}
            {p.negativeSupport === 'inline' && (
              <>{p.name} supports negative prompts using <span style={{ color: NEG_SUPPORT_COLOR.inline, fontWeight: 600 }}>inline syntax</span> ({p.negativeSyntaxDisplay}). Append your exclusions after the flag at the end of your prompt.</>
            )}
            {p.negativeSupport === 'none' && (
              <>{p.name} <span style={{ color: NEG_SUPPORT_COLOR.none, fontWeight: 600 }}>does not support negative prompts</span>. Promagen converts exclusion requests into positive reinforcement for this platform — for example, &quot;blurry&quot; becomes &quot;sharp focus&quot;.</>
            )}
          </p>
          <Link
            href="/platforms/negative-prompts"
            className="text-amber-400 hover:text-amber-300 cursor-pointer transition-colors font-medium inline-block"
            style={{ fontSize: 'clamp(12px, 0.9vw, 15px)', marginTop: 'clamp(6px, 0.6vw, 10px)' }}
          >
            Full negative prompt support guide →
          </Link>
        </Section>

        {/* ── Platform notes ──────────────────────────────────── */}
        {p.platformNote && (
          <Section title="Platform notes">
            <p className="text-white leading-relaxed" style={{ fontSize: 'clamp(13px, 1vw, 16px)' }}>{p.platformNote}</p>
          </Section>
        )}

        {/* ── Example prompt ──────────────────────────────────── */}
        {p.exampleOutput && (
          <Section title="Example prompt">
            <div className="rounded-xl text-amber-300 font-mono" style={{
              fontSize: 'clamp(12px, 0.9vw, 14px)',
              padding: `clamp(12px, 1.3vw, 20px) clamp(14px, 1.5vw, 24px)`,
              background: 'rgba(251, 191, 36, 0.06)', border: '1px solid rgba(251, 191, 36, 0.15)',
              lineHeight: 1.6, wordBreak: 'break-word',
            }}>
              {p.exampleOutput}
            </div>
          </Section>
        )}

        {/* ── FAQ ─────────────────────────────────────────────── */}
        <Section title="Frequently asked questions">
          <FaqItem
            question={`What is the character limit for ${p.name}?`}
            answer={p.maxChars
              ? `${p.name} accepts prompts up to ${p.maxChars} characters. The ideal writing range is ${p.idealMin}–${p.idealMax} characters (around ${p.sweetSpot} characters is the sweet spot where the platform produces its best results).`
              : `${p.name} does not have a publicly documented maximum character limit. The sweet spot for best results is around ${p.sweetSpot} characters, with an ideal range of ${p.idealMin}–${p.idealMax} characters.`}
          />
          <FaqItem
            question={`Does ${p.name} support negative prompts?`}
            answer={p.negativeSupport === 'separate'
              ? `Yes. ${p.name} has a separate negative prompt field where you can specify elements to exclude from the generated image.`
              : p.negativeSupport === 'inline'
                ? `Yes. ${p.name} uses inline negative syntax (${p.negativeSyntaxDisplay}) within the main prompt field.`
                : `No. ${p.name} does not support negative prompts. Promagen converts exclusion requests into positive reinforcement for this platform (for example, "blurry" becomes "sharp focus").`}
          />
          <FaqItem
            question={`How should I write prompts for ${p.name}?`}
            answer={`${p.name} uses ${tier.name} prompt format (${tier.shortName}). ${tier.description}. ${p.tips}`}
          />
        </Section>

        {/* ── Related platforms ────────────────────────────────── */}
        {sameTier.length > 0 && (
          <Section title={`Other ${tier.name} platforms`}>
            <p className="text-white" style={{ fontSize: 'clamp(12px, 0.9vw, 15px)', marginBottom: 'clamp(10px, 1vw, 16px)' }}>
              These platforms share the same prompt architecture — prompts written for one will generally work well on the others.
            </p>
            <div className="flex flex-wrap" style={{ gap: 'clamp(6px, 0.6vw, 10px)' }}>
              {sameTier.map((rp) => (
                <Link key={rp.id} href={`/platforms/${rp.id}`}
                  className="rounded-lg text-white hover:text-amber-400 cursor-pointer transition-colors font-medium"
                  style={{
                    fontSize: 'clamp(12px, 0.9vw, 15px)',
                    padding: `clamp(4px, 0.4vw, 7px) clamp(10px, 1vw, 16px)`,
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  }}>
                  {rp.name}
                </Link>
              ))}
            </div>
          </Section>
        )}

        {/* ── CTA ─────────────────────────────────────────────── */}
        <section style={{ marginBottom: 'clamp(40px, 5vw, 72px)', textAlign: 'center' }}>
          <Link href={`/studio/playground?provider=${p.id}`}
            className="inline-block rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer transition-colors"
            style={{ fontSize: 'clamp(14px, 1.1vw, 18px)', padding: `clamp(12px, 1.3vw, 18px) clamp(24px, 3vw, 40px)` }}>
            Try {p.name} in Prompt Lab →
          </Link>
        </section>

        {/* ── Footer ──────────────────────────────────────────── */}
        <footer className="text-white" style={{
          borderTop: DIVIDER,
          paddingTop: 'clamp(16px, 2vw, 28px)', paddingBottom: 'clamp(24px, 3vw, 48px)',
          fontSize: 'clamp(11px, 0.8vw, 13px)',
        }}>
          <p>Platform capabilities verified against live UI and API documentation. Last verified: <span className="text-amber-400">{lastUpdated}</span>.</p>
        </footer>
      </main>
    </>
  );
}
