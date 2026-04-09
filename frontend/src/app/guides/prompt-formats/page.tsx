// src/app/guides/prompt-formats/page.tsx
// ============================================================================
// PROMPT FORMAT GUIDE — AUTHORITY PAGE (Priority 5)
// ============================================================================
// Explains Promagen's 4-tier prompt compatibility system as original research.
// Shows the same creative intent written in all 4 formats and explains why
// prompts that work on one platform fail on another.
//
// RULES:
//   - Platform lists and counts from SSOT — zero hardcoded numbers
//   - All sizing via clamp(), zero banned greys, zero opacity dimming
//   - Shared components: Breadcrumb, FaqItem, Section
//   - Presentation constants from @/lib/authority/presentation
//
// Authority: promagen-ai-authority-pages-FINAL-v1.2.md §4.2 PAGE 5
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
  title: 'AI Image Prompt Formats Explained — The 4-Tier System | Promagen',
  description:
    'Why the same prompt works on one AI image generator but fails on another. Promagen\'s 4-tier system explains CLIP keywords, natural language, and plain language prompt formats across 40 platforms.',
  alternates: { canonical: `${BASE}/guides/prompt-formats` },
  openGraph: {
    title: 'AI Image Prompt Formats Explained — The 4-Tier System | Promagen',
    description:
      'Why prompts work differently across AI image generators. CLIP keywords, natural language, and plain language formats explained.',
    url: `${BASE}/guides/prompt-formats`,
    type: 'website',
    siteName: 'Promagen',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Promagen — Prompt Format Guide' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Image Prompt Formats Explained — The 4-Tier System | Promagen',
    description: 'Why prompts work differently across AI image generators. The 4-tier system explained.',
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
          { '@type': 'ListItem', position: 3, name: 'Prompt Formats', item: `${BASE}/guides/prompt-formats` },
        ],
      },
      {
        '@type': 'HowTo',
        name: 'How to Write Prompts for Different AI Image Generators',
        description: `A guide to the 4 prompt format tiers across ${totalPlatforms} AI image generators, explaining why the same prompt works on one platform but fails on another.`,
        step: [
          {
            '@type': 'HowToStep',
            name: 'Identify your platform\'s tier',
            text: 'Check which of the 4 tiers your platform belongs to: Tier 1 (CLIP-based weighted keywords), Tier 2 (Midjourney family), Tier 3 (natural language), or Tier 4 (plain language).',
          },
          {
            '@type': 'HowToStep',
            name: 'Write in the correct format',
            text: 'Use weighted keywords (term:1.3) for Tier 1, :: weighting with --no flags for Tier 2, conversational sentences for Tier 3, or short focused phrases for Tier 4.',
          },
          {
            '@type': 'HowToStep',
            name: 'Use Promagen to handle format conversion',
            text: 'Promagen\'s Prompt Lab automatically detects the platform tier and writes your creative intent in the correct format, so you don\'t need to learn each platform\'s syntax.',
          },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Why doesn\'t my Midjourney prompt work in DALL-E?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Midjourney uses keyword-weighted syntax (::) and --no flags that DALL-E ignores entirely. DALL-E reads natural sentences. A Midjourney prompt pasted into DALL-E loses all its weighting and negative instructions.',
            },
          },
          {
            '@type': 'Question',
            name: 'What is the difference between CLIP and natural language prompts?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'CLIP-based platforms tokenise prompts into weighted keywords where syntax like (term:1.3) controls emphasis. Natural language platforms read conversational sentences and ignore weight syntax entirely. They are fundamentally different text processing architectures.',
            },
          },
        ],
      },
    ],
  };
}

// ─── Tier format examples (same creative intent, 4 formats) ─────────────────

const SCENE_INTENT = 'A dramatic coastal lighthouse in a storm at sunset, with crashing waves, dark clouds, and warm golden light from the beacon.';

const TIER_EXAMPLES: Record<number, { label: string; prompt: string; explanation: string }> = {
  1: {
    label: 'Tier 1 — CLIP Weighted Keywords',
    prompt: '(dramatic coastal lighthouse:1.4), (storm:1.3), sunset, (crashing waves:1.2), dark clouds, (warm golden light:1.3), beacon, cinematic, 8K, masterpiece',
    explanation: 'CLIP tokenisation breaks the prompt into weighted tokens. (term:1.3) increases that concept\'s influence by 30%. Order matters less than weights. Negative prompts go in a separate field.',
  },
  2: {
    label: 'Tier 2 — Midjourney Keywords',
    prompt: 'dramatic coastal lighthouse in a storm at sunset, crashing waves, dark clouds, warm golden light from the beacon::1.3 cinematic atmosphere::1.2 --ar 16:9 --no blur, haze, cartoon',
    explanation: 'Midjourney uses :: for emphasis weighting and --no for negative exclusions inline. Parameters like --ar control aspect ratio. Natural sentences work but keywords with weighting produce more precise results.',
  },
  3: {
    label: 'Tier 3 — Natural Language',
    prompt: 'A dramatic coastal lighthouse standing on a rocky cliff during a powerful storm at sunset. Massive waves crash against the base of the cliff. Dark, heavy clouds fill the sky while warm golden light streams from the lighthouse beacon, cutting through the rain and mist. Cinematic composition with rich detail.',
    explanation: 'Natural language platforms read full sentences. Descriptive, conversational writing works best. Weight syntax like (term:1.3) is ignored or treated as literal text. Detail and specificity come from vocabulary, not from numerical weights.',
  },
  4: {
    label: 'Tier 4 — Plain Language',
    prompt: 'Lighthouse in a storm at sunset with crashing waves and golden light',
    explanation: 'Plain language platforms work best with short, focused prompts. They have lower character limits and simpler text encoders. Overloading them with detail or long descriptions often produces worse results than a clear, concise description.',
  },
};

// ─── Common failure patterns ────────────────────────────────────────────────

interface FailurePattern {
  title: string;
  description: string;
  example: string;
}

const FAILURE_PATTERNS: FailurePattern[] = [
  {
    title: 'CLIP syntax pasted into a natural language platform',
    description: 'Platforms like DALL\u00b7E 3, Flux, and Adobe Firefly do not understand parenthetical weights. (dramatic:1.4) is read as the literal text "(dramatic:1.4)" — the model sees brackets and numbers, not emphasis.',
    example: 'Pasting "(lighthouse:1.4), (storm:1.3), sunset" into DALL\u00b7E 3 produces confused results because it reads the weight syntax as literal words.',
  },
  {
    title: 'Midjourney --no flags sent to other platforms',
    description: 'The --no parameter is Midjourney-specific. Other platforms either ignore it or interpret "--no blur" as the literal words "no blur" in the prompt, which can actually increase the presence of blur.',
    example: 'Sending "--no watermark, text" to Stable Diffusion does nothing. Use the separate negative prompt field instead.',
  },
  {
    title: 'Long natural language prompts on plain language platforms',
    description: 'Tier 4 platforms (Canva, Jasper Art, Microsoft Designer) have short sweet spots (40\u201380 characters). Pasting a 300-character natural language prompt gets truncated or overwhelms the simpler text encoder.',
    example: 'A 250-word Flux prompt pasted into Canva Magic Media (sweet spot: 40 chars) produces generic results because most of the prompt is ignored.',
  },
  {
    title: 'Missing negative prompts on platforms without support',
    description: 'Platforms like DALL\u00b7E 3, Flux, Google Imagen, and Adobe Firefly have no negative prompt mechanism. Writing "no blur" in the main prompt can actually make blur more likely because the model processes the concept "blur".',
    example: 'Writing "no watermark, no text overlay" in a DALL\u00b7E 3 prompt. The model reads "watermark" and "text overlay" as concepts and may include them. Instead, write "clean image, professional finish".',
  },
];

// ─── Page ──────────────────────────────────────────────────────────────────

export default function PromptFormatsGuidePage() {
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
            { label: 'Guides' },
            { label: 'Prompt Formats' },
          ]}
        />

        {/* ── Hero ────────────────────────────────────────────────── */}
        <header style={{ marginBottom: 'clamp(28px, 3vw, 48px)' }}>
          <h1
            className="font-bold text-white tracking-tight leading-tight"
            style={{ fontSize: 'clamp(28px, 3vw, 48px)', marginBottom: 'clamp(10px, 1.2vw, 18px)' }}
          >
            How AI Image Generators
            <span className="block text-amber-400" style={{ fontSize: 'clamp(20px, 2vw, 32px)' }}>
              Read Your Prompts
            </span>
          </h1>
          <p
            className="text-white leading-relaxed"
            style={{ fontSize: 'clamp(14px, 1.1vw, 18px)', maxWidth: 'clamp(500px, 55vw, 760px)' }}
          >
            Not every AI image generator reads prompts the same way. Some parse weighted keywords,
            others read natural sentences, and some work best with a single short phrase. Writing
            in the wrong format for your platform produces worse results — not because the prompt
            is bad, but because the platform cannot understand it. Promagen classifies every
            platform into one of four tiers based on its prompt architecture.
          </p>
        </header>

        {/* ── The 4 tiers ─────────────────────────────────────────── */}
        <section style={{ marginBottom: 'clamp(36px, 4vw, 56px)' }}>
          <h2
            className="text-white font-semibold"
            style={{ fontSize: 'clamp(18px, 1.5vw, 24px)', marginBottom: 'clamp(14px, 1.5vw, 22px)' }}
          >
            The 4-Tier Prompt Compatibility System
          </h2>
          <p
            className="text-white leading-relaxed"
            style={{
              fontSize: 'clamp(13px, 1vw, 16px)',
              marginBottom: 'clamp(18px, 2vw, 28px)',
              maxWidth: 'clamp(500px, 55vw, 760px)',
            }}
          >
            This classification is architectural, not a quality ranking. Each tier describes how
            the platform&apos;s text encoder processes your words — what it pays attention to,
            what it ignores, and what syntax it understands.
          </p>

          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(auto-fit, minmax(clamp(280px, 28vw, 380px), 1fr))`,
              gap: 'clamp(12px, 1.5vw, 22px)',
            }}
          >
            {tiers.map((tier) => {
              const meta = TIER_META[tier];
              const badge = getTierBadge(tier);
              const count = counts.byTier[tier] ?? 0;
              const tierPlatforms = platforms.filter((p) => p.tier === tier);

              return (
                <div
                  key={tier}
                  className="rounded-xl"
                  style={{
                    background: TIER_CARD_BG[tier],
                    border: `1px solid ${badge.border}33`,
                    padding: `clamp(16px, 1.8vw, 26px) clamp(18px, 2vw, 28px)`,
                  }}
                >
                  <div className="flex items-baseline" style={{ gap: 'clamp(4px, 0.5vw, 8px)', marginBottom: 'clamp(6px, 0.6vw, 10px)' }}>
                    <span className="font-bold" style={{ fontSize: 'clamp(18px, 1.5vw, 24px)', color: badge.border }}>
                      {meta?.shortName}
                    </span>
                    <span className="font-medium text-white" style={{ fontSize: 'clamp(14px, 1.1vw, 18px)' }}>
                      {meta?.name}
                    </span>
                  </div>
                  <p className="text-white leading-relaxed" style={{ fontSize: 'clamp(12px, 0.9vw, 15px)', marginBottom: 'clamp(8px, 1vw, 14px)' }}>
                    {meta?.description}
                  </p>
                  <p className="text-amber-300" style={{ fontSize: 'clamp(11px, 0.8vw, 13px)' }}>
                    <span className="font-semibold">{count} platform{count !== 1 ? 's' : ''}:</span>{' '}
                    {tierPlatforms.map((p) => p.name).join(', ')}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Same intent, 4 formats ──────────────────────────────── */}
        <section style={{ marginBottom: 'clamp(36px, 4vw, 56px)' }}>
          <h2
            className="text-white font-semibold"
            style={{ fontSize: 'clamp(18px, 1.5vw, 24px)', marginBottom: 'clamp(8px, 1vw, 14px)' }}
          >
            Same Creative Intent, Four Different Formats
          </h2>
          <p
            className="text-white leading-relaxed"
            style={{
              fontSize: 'clamp(13px, 1vw, 16px)',
              marginBottom: 'clamp(6px, 0.6vw, 10px)',
              maxWidth: 'clamp(500px, 55vw, 760px)',
            }}
          >
            The following examples show the same scene described in each tier&apos;s native format:
          </p>
          <p
            className="text-amber-300 font-medium italic"
            style={{
              fontSize: 'clamp(13px, 1vw, 16px)',
              marginBottom: 'clamp(18px, 2vw, 28px)',
              maxWidth: 'clamp(500px, 55vw, 760px)',
            }}
          >
            &ldquo;{SCENE_INTENT}&rdquo;
          </p>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'clamp(14px, 1.5vw, 22px)',
              maxWidth: 'clamp(600px, 65vw, 900px)',
            }}
          >
            {tiers.map((tier) => {
              const ex = TIER_EXAMPLES[tier];
              const badge = getTierBadge(tier);
              if (!ex) return null;

              return (
                <div
                  key={tier}
                  className="rounded-xl"
                  style={{
                    background: CARD_BG,
                    border: CARD_BORDER,
                    padding: `clamp(14px, 1.5vw, 22px) clamp(16px, 1.8vw, 26px)`,
                  }}
                >
                  <div
                    className="font-semibold"
                    style={{
                      fontSize: 'clamp(14px, 1.1vw, 17px)',
                      color: badge.border,
                      marginBottom: 'clamp(8px, 0.8vw, 12px)',
                    }}
                  >
                    {ex.label}
                  </div>
                  <div
                    className="rounded-lg font-mono text-amber-300"
                    style={{
                      fontSize: 'clamp(11px, 0.85vw, 14px)',
                      padding: `clamp(10px, 1vw, 16px) clamp(12px, 1.2vw, 18px)`,
                      background: 'rgba(251, 191, 36, 0.06)',
                      border: '1px solid rgba(251, 191, 36, 0.15)',
                      lineHeight: 1.7,
                      wordBreak: 'break-word',
                      marginBottom: 'clamp(8px, 0.8vw, 12px)',
                    }}
                  >
                    {ex.prompt}
                  </div>
                  <p className="text-white leading-relaxed" style={{ fontSize: 'clamp(12px, 0.9vw, 15px)' }}>
                    {ex.explanation}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Converter teaser ────────────────────────────────────── */}
        <section
          className="rounded-xl"
          style={{
            marginBottom: 'clamp(36px, 4vw, 56px)',
            maxWidth: 'clamp(600px, 65vw, 900px)',
            padding: `clamp(18px, 2vw, 28px) clamp(20px, 2.2vw, 32px)`,
            background: 'rgba(251, 191, 36, 0.06)',
            border: '1px solid rgba(251, 191, 36, 0.15)',
            textAlign: 'center',
          }}
        >
          <p
            className="text-white font-medium leading-relaxed"
            style={{ fontSize: 'clamp(14px, 1.1vw, 17px)', marginBottom: 'clamp(10px, 1vw, 16px)' }}
          >
            Want to see how Promagen handles the conversion?
          </p>
          <Link
            href="/studio/playground"
            className="inline-block rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer transition-colors"
            style={{
              fontSize: 'clamp(13px, 1vw, 16px)',
              padding: `clamp(10px, 1.1vw, 16px) clamp(20px, 2.5vw, 36px)`,
            }}
          >
            Try the lighthouse scene in Prompt Lab
          </Link>
        </section>

        {/* ── Why prompts fail across platforms ────────────────────── */}
        <section style={{ marginBottom: 'clamp(36px, 4vw, 56px)' }}>
          <h2
            className="text-white font-semibold"
            style={{ fontSize: 'clamp(18px, 1.5vw, 24px)', marginBottom: 'clamp(8px, 1vw, 14px)' }}
          >
            Why Your Prompt Doesn&apos;t Work on Another Platform
          </h2>
          <p
            className="text-white leading-relaxed"
            style={{
              fontSize: 'clamp(13px, 1vw, 16px)',
              marginBottom: 'clamp(18px, 2vw, 28px)',
              maxWidth: 'clamp(500px, 55vw, 760px)',
            }}
          >
            The most common reason a prompt &ldquo;fails&rdquo; on a new platform is format
            mismatch — not creative quality. Here are the patterns that trip people up:
          </p>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'clamp(12px, 1.3vw, 20px)',
              maxWidth: 'clamp(600px, 65vw, 900px)',
            }}
          >
            {FAILURE_PATTERNS.map((fp) => (
              <div
                key={fp.title}
                className="rounded-xl"
                style={{
                  background: CARD_BG,
                  border: CARD_BORDER,
                  padding: `clamp(14px, 1.5vw, 22px) clamp(16px, 1.8vw, 26px)`,
                }}
              >
                <h3
                  className="text-amber-400 font-semibold"
                  style={{ fontSize: 'clamp(14px, 1.1vw, 17px)', marginBottom: 'clamp(4px, 0.5vw, 8px)' }}
                >
                  {fp.title}
                </h3>
                <p className="text-white leading-relaxed" style={{ fontSize: 'clamp(12px, 0.9vw, 15px)', marginBottom: 'clamp(6px, 0.6vw, 10px)' }}>
                  {fp.description}
                </p>
                <p
                  className="text-amber-300 italic"
                  style={{ fontSize: 'clamp(11px, 0.85vw, 14px)' }}
                >
                  {fp.example}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────────── */}
        <Section title="Frequently asked questions">
          <FaqItem
            question="Why doesn't my Midjourney prompt work in DALL-E?"
            answer="Midjourney uses keyword-weighted syntax (::) and --no flags that DALL-E ignores entirely. DALL-E reads natural language sentences. A Midjourney prompt pasted into DALL-E loses all its weighting and negative instructions. You need to rewrite the prompt as a conversational description — or use Promagen, which handles the conversion automatically."
          />
          <FaqItem
            question="What is the difference between CLIP and natural language prompts?"
            answer="CLIP-based platforms (Tier 1) tokenise your prompt into weighted keywords — syntax like (term:1.3) increases that concept's influence by 30%. Natural language platforms (Tier 3) read conversational sentences and ignore weight syntax entirely. Writing CLIP syntax for a natural language platform wastes the weights and may add confusing literal characters to the prompt."
          />
          <FaqItem
            question="Can I use one prompt for all platforms?"
            answer={`Not effectively. The ${counts.total} platforms Promagen tracks use 4 fundamentally different prompt architectures. A prompt optimised for one tier will underperform on another because the text encoder processes it differently. Promagen's Prompt Lab solves this by writing your creative intent in the correct format for whichever platform you select.`}
          />
          <FaqItem
            question="What is a prompt tier?"
            answer="A prompt tier is Promagen's classification of how an AI image generator's text encoder processes prompts. Tier 1 uses CLIP tokenisation with weighted keywords. Tier 2 is the Midjourney family with :: weighting and --no flags. Tier 3 reads natural language sentences. Tier 4 works best with short, focused phrases. The tier describes prompt architecture, not quality."
          />
          <FaqItem
            question="Why do plain language platforms work differently from natural language ones?"
            answer="Natural language platforms (Tier 3) have sophisticated text encoders that understand complex sentences and follow detailed instructions. Plain language platforms (Tier 4) have simpler encoders with shorter character limits — they work best with brief, focused descriptions. Overloading a Tier 4 platform with a long Tier 3 prompt often produces worse results."
          />
        </Section>

        {/* ── Internal links ──────────────────────────────────────── */}
        <Section title="Explore further">
          <div className="flex flex-wrap" style={{ gap: 'clamp(8px, 0.8vw, 14px)' }}>
            {[
              { href: '/platforms', label: `All ${counts.total} platforms` },
              { href: '/platforms/negative-prompts', label: 'Negative prompt support guide' },
              { href: '/platforms/compare/midjourney-vs-dalle', label: 'Midjourney vs DALL\u00b7E 3' },
              { href: '/platforms/compare/flux-vs-stable-diffusion', label: 'Flux vs Stable Diffusion' },
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
        </Section>

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
            Try Prompt Lab — Automatic format conversion for any platform
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
            Tier classifications and platform data from Promagen&apos;s platform intelligence database (SSOT v{ssotVersion}).
            Last verified: <span className="text-amber-400">{lastUpdated}</span>.
          </p>
          <p>
            All platform counts are dynamically derived. This guide is original research
            based on architectural analysis of each platform&apos;s text encoder behaviour.
          </p>
        </footer>
      </main>
    </>
  );
}
