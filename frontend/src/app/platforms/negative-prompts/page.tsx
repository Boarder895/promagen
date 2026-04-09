// src/app/platforms/negative-prompts/page.tsx
// ============================================================================
// NEGATIVE PROMPT SUPPORT GUIDE — AUTHORITY PAGE (Priority 3)
// ============================================================================
// The definitive reference for which AI image platforms support negative
// prompts and how. No competitor has published this data comprehensively.
//
// RULES:
//   - All counts derived dynamically from SSOT — zero hardcoded numbers
//   - Zero opacity dimming, zero banned greys
//   - All sizing via clamp()
//   - Shared presentation constants from @/lib/authority/presentation
//   - Shared Breadcrumb from @/components/authority/breadcrumb
//
// Authority: promagen-ai-authority-pages-FINAL-v1.2.md §4.2 PAGE 4
// Existing features preserved: Yes — no existing routes modified.
// ============================================================================

import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import {
  getPlatformsByNegativeSupport,
  getPlatformCounts,
  getLastUpdated,
  getSSOTVersion,
  TIER_META,
  type NegativeSupportType,
} from '@/lib/authority/platform-data';
import { env } from '@/lib/env';
import {
  getTierBadge,
  NEG_SUPPORT_COLOR,
  TABLE_CELL_PAD,
  ROW_STRIPE,
  DIVIDER,
} from '@/lib/authority/presentation';
import { Breadcrumb } from '@/components/authority/breadcrumb';
import { FaqItem } from '@/components/authority/shared';

// ISR: rebuild once per day
export const revalidate = 86400;

// ─── Metadata ──────────────────────────────────────────────────────────────

const BASE = env.siteUrl;

export const metadata: Metadata = {
  title: 'Negative Prompt Support — Which AI Image Generators Support Them? | Promagen',
  description:
    'Complete reference for negative prompt support across 40 AI image generators. See which platforms have separate fields, inline syntax, or no support — with practical examples and workarounds.',
  alternates: { canonical: `${BASE}/platforms/negative-prompts` },
  openGraph: {
    title: 'Negative Prompt Support — Which AI Image Generators Support Them? | Promagen',
    description:
      'Complete reference for negative prompt support across 40 AI image generators. Separate fields, inline syntax, and workarounds.',
    url: `${BASE}/platforms/negative-prompts`,
    type: 'website',
    siteName: 'Promagen',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Promagen — Negative Prompt Support Guide' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Negative Prompt Support — Which AI Image Generators Support Them? | Promagen',
    description:
      'Which AI image generators support negative prompts? Full breakdown of separate fields, inline syntax, and conversion strategies.',
    images: ['/og.png'],
  },
};

// ─── JSON-LD structured data ───────────────────────────────────────────────

function buildJsonLd(counts: ReturnType<typeof getPlatformCounts>) {
  const separateCount = counts.byNegativeSupport['separate'] ?? 0;
  const inlineCount = counts.byNegativeSupport['inline'] ?? 0;
  const noneCount = counts.byNegativeSupport['none'] ?? 0;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Promagen', item: BASE },
          { '@type': 'ListItem', position: 2, name: 'AI Image Generators', item: `${BASE}/platforms` },
          { '@type': 'ListItem', position: 3, name: 'Negative Prompt Support', item: `${BASE}/platforms/negative-prompts` },
        ],
      },
      {
        '@type': 'HowTo',
        name: 'How to Use Negative Prompts Across AI Image Generators',
        description: `A guide to negative prompt support across ${counts.total} AI image generators, covering separate fields, inline syntax, and platforms without support.`,
        step: [
          {
            '@type': 'HowToStep',
            name: 'Identify your platform\'s negative prompt type',
            text: `Check whether your platform supports a separate negative prompt field (${separateCount} platforms), inline syntax like --no (${inlineCount} platforms), or has no support (${noneCount} platforms).`,
          },
          {
            '@type': 'HowToStep',
            name: 'Use the correct format',
            text: 'For separate fields, type exclusions directly. For inline syntax (Midjourney, BlueWillow), append --no followed by unwanted elements. For platforms without support, rephrase exclusions as positive instructions.',
          },
          {
            '@type': 'HowToStep',
            name: 'Optimise with Promagen',
            text: 'Promagen\'s Prompt Lab automatically detects the platform\'s negative prompt type and formats your exclusions correctly — including converting negatives to positive reinforcement when the platform has no native support.',
          },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Which AI image generators support negative prompts?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: `Of the ${counts.total} platforms tracked, ${separateCount} have a separate negative prompt field, ${inlineCount} use inline syntax (--no), and ${noneCount} do not support negative prompts at all.`,
            },
          },
          {
            '@type': 'Question',
            name: 'What is a negative prompt in AI image generation?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'A negative prompt tells an AI image generator what NOT to include in the output. For example, "blurry, low quality, watermark" as a negative prompt instructs the model to actively avoid those qualities.',
            },
          },
          {
            '@type': 'Question',
            name: 'What do I do if my platform doesn\'t support negative prompts?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Rephrase exclusions as positive instructions. Instead of "no blur", write "sharp focus". Instead of "no watermark", write "clean image". Promagen\'s Prompt Lab handles this conversion automatically.',
            },
          },
        ],
      },
    ],
  };
}

// ─── Support type explainers ───────────────────────────────────────────────

interface SupportTypeInfo {
  type: NegativeSupportType;
  heading: string;
  description: string;
  howItWorks: string;
  example: string;
  promagenHandling: string;
}

const SUPPORT_TYPE_INFO: SupportTypeInfo[] = [
  {
    type: 'separate',
    heading: 'Separate Negative Prompt Field',
    description:
      'These platforms provide a dedicated text field specifically for negative prompts, separate from the main prompt input. This is the most powerful form of negative prompt support — the model receives your exclusions as a distinct signal.',
    howItWorks:
      'Type your unwanted elements directly into the negative prompt field. The platform processes these separately from your main prompt, giving the model a clear signal about what to avoid.',
    example:
      'Main prompt: "A portrait of a woman in a garden, oil painting style"\nNegative prompt: "blurry, low quality, watermark, extra fingers, deformed hands"',
    promagenHandling:
      'Promagen shows a dedicated amber negative prompt window in the Prompt Lab. Your negative selections are formatted and placed in the correct field automatically.',
  },
  {
    type: 'inline',
    heading: 'Inline Negative Syntax (--no)',
    description:
      'These platforms accept negative prompts within the main prompt field using special syntax. Midjourney and BlueWillow use the --no flag — negative terms are appended at the end of the prompt after the flag.',
    howItWorks:
      'Append --no followed by the elements you want to exclude at the end of your prompt. No special formatting is needed for the negative terms themselves.',
    example:
      'Prompt: "A portrait of a woman in a garden, oil painting style --no blurry, watermark, extra fingers"',
    promagenHandling:
      'Promagen detects inline-syntax platforms and appends your negative selections after the --no flag automatically. You select exclusions from the same interface — the format conversion happens behind the scenes.',
  },
  {
    type: 'none',
    heading: 'No Native Negative Prompt Support',
    description:
      'These platforms do not provide any mechanism for negative prompts — neither a separate field nor inline syntax. This includes major platforms like DALL·E 3, Adobe Firefly, Flux, Google Imagen, and Canva.',
    howItWorks:
      'The only option is to rephrase exclusions as positive instructions in your main prompt. Instead of saying what you don\'t want, emphasise what you do want. For example, instead of "no blur", write "sharp focus, crisp detail".',
    example:
      'Instead of: "A landscape --no blur, fog"\nWrite: "A landscape with sharp focus, crisp detail, clear atmosphere, high definition"',
    promagenHandling:
      'Promagen automatically converts your negative selections into positive reinforcement phrases. When you select "blurry" as a negative, Promagen writes "sharp focus" into the prompt for platforms without native support.',
  },
];

// ─── Notable platform changes ──────────────────────────────────────────────

interface PlatformChange {
  name: string;
  id: string;
  detail: string;
}

const NOTABLE_CHANGES: PlatformChange[] = [
  {
    name: 'Adobe Firefly',
    id: 'adobe-firefly',
    detail:
      'Previously had an "Exclude Image" field under Advanced Settings but explicitly removed it. An Adobe Community Manager confirmed the decision. An unreliable [avoid=xxx] workaround exists but is not a supported feature.',
  },
  {
    name: 'Google Imagen',
    id: 'google-imagen',
    detail:
      'Deprecated negative prompts starting with Imagen 3.0, describing them as "a legacy feature." Earlier versions supported them, but the current generation does not.',
  },
  {
    name: 'Playground AI',
    id: 'playground',
    detail:
      'Rebranded to playground.com and pivoted to a design-tool focus. The "Exclude from Image" field survives in Board mode\'s Advanced Settings.',
  },
  {
    name: 'ClipDrop',
    id: 'clipdrop',
    detail:
      'Sold by Stability AI to Jasper AI and now operates under InitML branding. The current simplified interface has no negative prompt support.',
  },
];

// ─── API vs UI differences ──────────────────────────────────────────────────

interface ApiUiDifference {
  name: string;
  id: string;
  detail: string;
}

const API_UI_DIFFERENCES: ApiUiDifference[] = [
  {
    name: 'DeepAI',
    id: 'deepai',
    detail:
      'The API accepts a negative_prompt parameter, but the web UI at deepai.org has no negative prompt field. Promagen classifies this as "not supported" based on the UI experience.',
  },
  {
    name: 'Hotpot.ai',
    id: 'hotpot',
    detail:
      'The API documentation shows a negativePrompt parameter, but the standard Art Generator web page has only a single prompt box.',
  },
  {
    name: 'Stability AI',
    id: 'stability',
    detail:
      'The developer API supports negative_prompt for SD3.5 models. The consumer-facing DreamStudio has a separate negative prompt field and is classified accordingly.',
  },
];

// ─── Page ──────────────────────────────────────────────────────────────────

export default function NegativePromptsGuidePage() {
  const groups = getPlatformsByNegativeSupport();
  const counts = getPlatformCounts();
  const lastUpdated = getLastUpdated();
  const ssotVersion = getSSOTVersion();

  const separateCount = counts.byNegativeSupport['separate'] ?? 0;
  const inlineCount = counts.byNegativeSupport['inline'] ?? 0;
  const noneCount = counts.byNegativeSupport['none'] ?? 0;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(counts)) }}
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
            { label: 'Negative Prompt Support' },
          ]}
        />

        {/* ── Hero ────────────────────────────────────────────────── */}
        <header style={{ marginBottom: 'clamp(28px, 3vw, 48px)' }}>
          <h1
            className="font-bold text-white tracking-tight leading-tight"
            style={{
              fontSize: 'clamp(28px, 3vw, 48px)',
              marginBottom: 'clamp(10px, 1.2vw, 18px)',
            }}
          >
            Negative Prompt Support
            <span
              className="block text-amber-400"
              style={{ fontSize: 'clamp(20px, 2vw, 32px)' }}
            >
              Across {counts.total} AI Image Generators
            </span>
          </h1>
          <p
            className="text-white leading-relaxed"
            style={{
              fontSize: 'clamp(14px, 1.1vw, 18px)',
              maxWidth: 'clamp(500px, 55vw, 760px)',
            }}
          >
            Negative prompts tell an AI image generator what <em>not</em> to include in the output.
            Not every platform supports them — and those that do use different formats. This guide
            covers all {counts.total} platforms Promagen tracks, grouped by support type, with
            practical examples and workarounds for platforms without native support.
          </p>
        </header>

        {/* ── Summary stat cards ──────────────────────────────────── */}
        <section
          className="grid"
          style={{
            gridTemplateColumns: `repeat(auto-fit, minmax(clamp(180px, 20vw, 280px), 1fr))`,
            gap: 'clamp(10px, 1.2vw, 18px)',
            marginBottom: 'clamp(28px, 3vw, 48px)',
          }}
        >
          <StatCard
            count={separateCount}
            label="Separate Field"
            sublabel="Dedicated negative prompt input"
            color={NEG_SUPPORT_COLOR.separate}
          />
          <StatCard
            count={inlineCount}
            label="Inline Syntax"
            sublabel="--no flag within the prompt"
            color={NEG_SUPPORT_COLOR.inline}
          />
          <StatCard
            count={noneCount}
            label="Not Supported"
            sublabel="Rephrase as positive instructions"
            color={NEG_SUPPORT_COLOR.none}
          />
        </section>

        {/* ── Quick-jump navigation ──────────────────────────────── */}
        <nav
          aria-label="Page sections"
          className="flex flex-wrap items-center"
          style={{
            gap: 'clamp(6px, 0.6vw, 10px)',
            marginBottom: 'clamp(28px, 3vw, 48px)',
            paddingBottom: 'clamp(16px, 1.5vw, 24px)',
            borderBottom: DIVIDER,
          }}
        >
          <span
            className="text-white font-medium"
            style={{ fontSize: 'clamp(12px, 0.9vw, 15px)', marginRight: 'clamp(4px, 0.4vw, 8px)' }}
          >
            Jump to:
          </span>
          {[
            { href: '#separate', label: `Separate field (${separateCount})`, color: NEG_SUPPORT_COLOR.separate },
            { href: '#inline', label: `Inline syntax (${inlineCount})`, color: NEG_SUPPORT_COLOR.inline },
            { href: '#none', label: `Not supported (${noneCount})`, color: NEG_SUPPORT_COLOR.none },
            { href: '#notable-changes', label: 'Notable changes', color: '#fbbf24' },
            { href: '#api-vs-ui', label: 'API vs UI', color: '#fbbf24' },
            { href: '#faq', label: 'FAQ', color: '#fbbf24' },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-lg font-medium cursor-pointer transition-colors hover:text-amber-300"
              style={{
                fontSize: 'clamp(11px, 0.85vw, 14px)',
                padding: `clamp(4px, 0.4vw, 7px) clamp(10px, 1vw, 16px)`,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: item.color,
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* ── Support type sections (separate, inline, none) ─────── */}
        {SUPPORT_TYPE_INFO.map((info) => {
          const group = groups.find((g) => g.type === info.type);
          if (!group) return null;

          return (
            <section
              key={info.type}
              id={info.type}
              style={{ marginBottom: 'clamp(40px, 4.5vw, 64px)' }}
            >
              {/* Section heading */}
              <div
                className="flex items-baseline flex-wrap"
                style={{
                  gap: 'clamp(8px, 0.8vw, 14px)',
                  marginBottom: 'clamp(12px, 1.5vw, 22px)',
                }}
              >
                <h2
                  className="font-semibold"
                  style={{
                    fontSize: 'clamp(20px, 1.8vw, 28px)',
                    color: NEG_SUPPORT_COLOR[info.type],
                  }}
                >
                  {info.heading}
                </h2>
                <span
                  className="font-bold tabular-nums text-white"
                  style={{ fontSize: 'clamp(14px, 1.1vw, 18px)' }}
                >
                  ({group.platforms.length} platform{group.platforms.length !== 1 ? 's' : ''})
                </span>
              </div>

              {/* Description */}
              <p
                className="text-white leading-relaxed"
                style={{
                  fontSize: 'clamp(13px, 1vw, 16px)',
                  marginBottom: 'clamp(14px, 1.5vw, 22px)',
                  maxWidth: 'clamp(500px, 55vw, 760px)',
                }}
              >
                {info.description}
              </p>

              {/* How it works */}
              <div style={{ marginBottom: 'clamp(14px, 1.5vw, 22px)', maxWidth: 'clamp(500px, 55vw, 760px)' }}>
                <h3
                  className="text-amber-400 font-semibold"
                  style={{
                    fontSize: 'clamp(14px, 1.1vw, 18px)',
                    marginBottom: 'clamp(4px, 0.5vw, 8px)',
                  }}
                >
                  How it works
                </h3>
                <p
                  className="text-white leading-relaxed"
                  style={{ fontSize: 'clamp(13px, 1vw, 16px)' }}
                >
                  {info.howItWorks}
                </p>
              </div>

              {/* Example */}
              <div
                className="rounded-xl font-mono text-amber-300"
                style={{
                  fontSize: 'clamp(12px, 0.9vw, 14px)',
                  padding: `clamp(12px, 1.3vw, 20px) clamp(14px, 1.5vw, 24px)`,
                  background: 'rgba(251, 191, 36, 0.06)',
                  border: '1px solid rgba(251, 191, 36, 0.15)',
                  lineHeight: 1.7,
                  whiteSpace: 'pre-line',
                  wordBreak: 'break-word',
                  marginBottom: 'clamp(14px, 1.5vw, 22px)',
                  maxWidth: 'clamp(500px, 60vw, 820px)',
                }}
              >
                {info.example}
              </div>

              {/* Promagen handling */}
              <div style={{ marginBottom: 'clamp(18px, 2vw, 28px)', maxWidth: 'clamp(500px, 55vw, 760px)' }}>
                <h3
                  className="text-amber-400 font-semibold"
                  style={{
                    fontSize: 'clamp(14px, 1.1vw, 18px)',
                    marginBottom: 'clamp(4px, 0.5vw, 8px)',
                  }}
                >
                  How Promagen handles it
                </h3>
                <p
                  className="text-white leading-relaxed"
                  style={{ fontSize: 'clamp(13px, 1vw, 16px)' }}
                >
                  {info.promagenHandling}
                </p>
              </div>

              {/* Platform table for this group */}
              <NegativeSupportTable platforms={group.platforms} supportType={info.type} />
            </section>
          );
        })}

        {/* ── Notable platform changes ────────────────────────────── */}
        <section id="notable-changes" style={{ marginBottom: 'clamp(36px, 4vw, 56px)' }}>
          <h2
            className="text-white font-semibold"
            style={{
              fontSize: 'clamp(18px, 1.5vw, 24px)',
              marginBottom: 'clamp(10px, 1.2vw, 18px)',
            }}
          >
            Notable Platform Changes
          </h2>
          <p
            className="text-white leading-relaxed"
            style={{
              fontSize: 'clamp(13px, 1vw, 16px)',
              marginBottom: 'clamp(14px, 1.5vw, 22px)',
              maxWidth: 'clamp(500px, 55vw, 760px)',
            }}
          >
            Several platforms have changed their negative prompt support over time. These changes
            are reflected in the current data above — this section documents what changed and why.
          </p>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'clamp(10px, 1.2vw, 18px)',
              maxWidth: 'clamp(500px, 60vw, 820px)',
            }}
          >
            {NOTABLE_CHANGES.map((change) => (
              <div
                key={change.id}
                className="rounded-xl"
                style={{
                  padding: `clamp(12px, 1.3vw, 20px) clamp(14px, 1.5vw, 24px)`,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <Link
                  href={`/platforms/${change.id}`}
                  className="text-amber-400 hover:text-amber-300 font-semibold cursor-pointer transition-colors"
                  style={{ fontSize: 'clamp(14px, 1.1vw, 17px)' }}
                >
                  {change.name}
                </Link>
                <p
                  className="text-white leading-relaxed"
                  style={{
                    fontSize: 'clamp(12px, 0.9vw, 15px)',
                    marginTop: 'clamp(4px, 0.4vw, 7px)',
                  }}
                >
                  {change.detail}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── API vs UI differences ───────────────────────────────── */}
        <section id="api-vs-ui" style={{ marginBottom: 'clamp(36px, 4vw, 56px)' }}>
          <h2
            className="text-white font-semibold"
            style={{
              fontSize: 'clamp(18px, 1.5vw, 24px)',
              marginBottom: 'clamp(10px, 1.2vw, 18px)',
            }}
          >
            API vs UI Differences
          </h2>
          <p
            className="text-white leading-relaxed"
            style={{
              fontSize: 'clamp(13px, 1vw, 16px)',
              marginBottom: 'clamp(14px, 1.5vw, 22px)',
              maxWidth: 'clamp(500px, 55vw, 760px)',
            }}
          >
            Some platforms support negative prompts in their developer API but not in their
            consumer-facing web UI. Promagen classifies platforms based on the web UI experience
            — what you see when you use the platform directly.
          </p>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'clamp(10px, 1.2vw, 18px)',
              maxWidth: 'clamp(500px, 60vw, 820px)',
            }}
          >
            {API_UI_DIFFERENCES.map((diff) => (
              <div
                key={diff.id}
                className="rounded-xl"
                style={{
                  padding: `clamp(12px, 1.3vw, 20px) clamp(14px, 1.5vw, 24px)`,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <Link
                  href={`/platforms/${diff.id}`}
                  className="text-amber-400 hover:text-amber-300 font-semibold cursor-pointer transition-colors"
                  style={{ fontSize: 'clamp(14px, 1.1vw, 17px)' }}
                >
                  {diff.name}
                </Link>
                <p
                  className="text-white leading-relaxed"
                  style={{
                    fontSize: 'clamp(12px, 0.9vw, 15px)',
                    marginTop: 'clamp(4px, 0.4vw, 7px)',
                  }}
                >
                  {diff.detail}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────────── */}
        <section id="faq" style={{ marginBottom: 'clamp(32px, 4vw, 56px)' }}>
          <h2
            className="text-white font-semibold"
            style={{
              fontSize: 'clamp(18px, 1.5vw, 24px)',
              marginBottom: 'clamp(14px, 1.5vw, 24px)',
            }}
          >
            Frequently Asked Questions
          </h2>

          <div style={{ maxWidth: 'clamp(500px, 55vw, 760px)' }}>
            <FaqItem
              question="Which AI image generators support negative prompts?"
              answer={`Of the ${counts.total} platforms Promagen tracks, ${separateCount} have a separate negative prompt field, ${inlineCount} use inline syntax (like Midjourney's --no flag), and ${noneCount} do not support negative prompts at all. Support depends on the platform's underlying architecture — CLIP-based models (Tier 1) almost universally support them, while proprietary models like DALL·E 3 and Flux deliberately omit them.`}
            />
            <FaqItem
              question="What is a negative prompt in AI image generation?"
              answer="A negative prompt tells an AI image generator what NOT to include in the output. For example, adding &quot;blurry, low quality, watermark&quot; as a negative prompt instructs the model to actively avoid those qualities. It works by reducing the influence of those concepts in the generation process — the model steers its output away from the specified elements."
            />
            <FaqItem
              question="What do I do if my platform doesn't support negative prompts?"
              answer="Rephrase exclusions as positive instructions in your main prompt. Instead of &quot;no blur&quot;, write &quot;sharp focus, crisp detail&quot;. Instead of &quot;no watermark&quot;, write &quot;clean image, professional finish&quot;. Promagen's Prompt Lab handles this conversion automatically for all platforms without native negative prompt support."
            />
            <FaqItem
              question="Why do some platforms not support negative prompts?"
              answer="It's an architectural and UX choice. CLIP-based models (Stable Diffusion, Leonardo, etc.) process positive and negative prompts as separate embedding vectors — the architecture naturally supports it. Proprietary models like DALL·E 3, Flux, and Google Imagen use different text encoders that either don't separate positive/negative signals or deliberately simplify the interface to reduce user confusion."
            />
            <FaqItem
              question="Does the --no flag work the same as a separate negative prompt field?"
              answer="Similar effect, different format. Midjourney and BlueWillow use --no within the main prompt field. Separate-field platforms (like Leonardo, DreamStudio, Ideogram) process your negatives independently. In practice, both approaches exclude the specified elements — the difference is where you type them."
            />
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
            Try Prompt Lab — Automatic negative prompt handling →
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
            Data sourced from Promagen&apos;s platform intelligence database (SSOT v{ssotVersion}).
            Last verified: <span className="text-amber-400">{lastUpdated}</span>.
          </p>
          <p>
            Negative prompt classifications verified against live platform UIs and official API documentation.
            All counts are dynamically derived and update automatically when platforms change.
          </p>
        </footer>
      </main>
    </>
  );
}

// ─── Stat card (local component) ────────────────────────────────────────────

function StatCard({
  count,
  label,
  sublabel,
  color,
}: {
  count: number;
  label: string;
  sublabel: string;
  color: string;
}) {
  return (
    <div
      className="rounded-xl"
      style={{
        padding: `clamp(16px, 1.8vw, 26px) clamp(18px, 2vw, 28px)`,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div
        className="font-bold tabular-nums"
        style={{ fontSize: 'clamp(30px, 3vw, 48px)', color }}
      >
        {count}
      </div>
      <div
        className="font-semibold text-white"
        style={{ fontSize: 'clamp(14px, 1.1vw, 18px)' }}
      >
        {label}
      </div>
      <div
        className="text-white"
        style={{
          fontSize: 'clamp(11px, 0.85vw, 14px)',
          marginTop: 'clamp(2px, 0.3vw, 5px)',
        }}
      >
        {sublabel}
      </div>
    </div>
  );
}

// ─── Platform table per support type ────────────────────────────────────────

function NegativeSupportTable({
  platforms,
  supportType,
}: {
  platforms: ReturnType<typeof getPlatformsByNegativeSupport>[0]['platforms'];
  supportType: NegativeSupportType;
}) {
  return (
    <div
      className="overflow-x-auto rounded-xl"
      style={{
        border: DIVIDER,
        maxWidth: 'clamp(600px, 70vw, 1000px)',
      }}
    >
      <table
        className="w-full border-collapse"
        style={{ fontSize: 'clamp(12px, 0.9vw, 15px)' }}
      >
        <thead>
          <tr
            style={{
              background: 'rgba(255,255,255,0.05)',
              borderBottom: DIVIDER,
            }}
          >
            <th
              className="text-amber-400 font-semibold text-left"
              style={{ padding: `clamp(8px, 1vw, 14px) clamp(10px, 1.2vw, 18px)` }}
            >
              Platform
            </th>
            <th
              className="text-amber-400 font-semibold text-left"
              style={{ padding: `clamp(8px, 1vw, 14px) clamp(10px, 1.2vw, 18px)` }}
            >
              Tier
            </th>
            {supportType === 'inline' && (
              <th
                className="text-amber-400 font-semibold text-left"
                style={{ padding: `clamp(8px, 1vw, 14px) clamp(10px, 1.2vw, 18px)` }}
              >
                Syntax
              </th>
            )}
            <th
              className="text-amber-400 font-semibold text-right"
              style={{
                padding: `clamp(8px, 1vw, 14px) clamp(10px, 1.2vw, 18px)`,
                whiteSpace: 'nowrap',
              }}
            >
              Sweet Spot
            </th>
            <th
              className="text-amber-400 font-semibold text-right"
              style={{ padding: `clamp(8px, 1vw, 14px) clamp(10px, 1.2vw, 18px)` }}
            >
              Profile
            </th>
          </tr>
        </thead>
        <tbody>
          {platforms.map((p, i) => {
            const badge = getTierBadge(p.tier);
            const tierMeta = TIER_META[p.tier];

            return (
              <tr
                key={p.id}
                style={{
                  background: i % 2 === 0 ? ROW_STRIPE : 'transparent',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <td style={{ padding: TABLE_CELL_PAD }}>
                  <span
                    className="flex items-center"
                    style={{ gap: 'clamp(6px, 0.6vw, 10px)' }}
                  >
                    {p.localIcon && (
                      <Image
                        src={p.localIcon}
                        alt=""
                        width={20}
                        height={20}
                        className="rounded-sm flex-shrink-0"
                        style={{
                          width: 'clamp(16px, 1.3vw, 22px)',
                          height: 'clamp(16px, 1.3vw, 22px)',
                        }}
                      />
                    )}
                    <Link
                      href={`/platforms/${p.id}`}
                      className="text-white font-medium hover:text-amber-400 cursor-pointer transition-colors"
                    >
                      {p.name}
                    </Link>
                  </span>
                </td>
                <td style={{ padding: TABLE_CELL_PAD }}>
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
                    {tierMeta?.shortName ?? `T${p.tier}`}
                  </span>
                </td>
                {supportType === 'inline' && (
                  <td
                    className="text-amber-300 font-mono"
                    style={{
                      padding: TABLE_CELL_PAD,
                      fontSize: 'clamp(11px, 0.85vw, 14px)',
                    }}
                  >
                    {p.negativeSyntax
                      ? p.negativeSyntax.replace('{negative}', '…')
                      : '--no'}
                  </td>
                )}
                <td
                  className="text-white tabular-nums"
                  style={{ padding: TABLE_CELL_PAD, textAlign: 'right' }}
                >
                  {p.sweetSpot > 0 ? `${p.sweetSpot} chars` : '—'}
                </td>
                <td style={{ padding: TABLE_CELL_PAD, textAlign: 'right' }}>
                  <Link
                    href={`/platforms/${p.id}`}
                    className="text-amber-400 hover:text-amber-300 cursor-pointer transition-colors"
                    title={`View ${p.name} profile`}
                    style={{ fontSize: 'clamp(14px, 1.1vw, 18px)' }}
                  >
                    →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
