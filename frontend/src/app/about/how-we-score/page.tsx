// src/app/about/how-we-score/page.tsx
// ============================================================================
// METHODOLOGY PAGE — AUTHORITY PAGE (Priority 6)
// ============================================================================
// Transparency page explaining Promagen's Builder Quality Intelligence (BQI)
// evaluation methodology. Builds E-E-A-T trust signal.
//
// Decision: Option B — Methodology + headline summary range.
// Option C (full per-platform scores) deferred until BQI pipeline matures.
//
// RULES:
//   - Platform count from SSOT — zero hardcoded numbers
//   - BQI headline range from local constant (updated when scores stabilise)
//   - All sizing via clamp(), zero banned greys, zero opacity dimming
//   - Shared components: Breadcrumb, FaqItem, Section
//   - Presentation constants from @/lib/authority/presentation
//
// Authority: promagen-ai-authority-pages-FINAL-v1.2.md §4.2 PAGE 7
// Existing features preserved: Yes — no existing routes modified.
// ============================================================================

import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  getPlatformCounts,
  getLastUpdated,
  getBqiHeadlineRange,
} from '@/lib/authority/platform-data';
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

// BQI headline range now loaded from src/data/authority/bqi-headline.json
// via getBqiHeadlineRange() — update the JSON file when scores stabilise.

// ─── Metadata ──────────────────────────────────────────────────────────────

const BASE = env.siteUrl;

export const metadata: Metadata = {
  title: 'How We Score AI Image Generators — BQI Methodology | Promagen',
  description:
    'Promagen\'s Builder Quality Intelligence (BQI) methodology: 8 standardised test scenes, three-layer triangulated scoring, and transparent evaluation across 40 AI image generators.',
  alternates: { canonical: `${BASE}/about/how-we-score` },
  openGraph: {
    title: 'How We Score AI Image Generators — BQI Methodology | Promagen',
    description:
      'Transparent methodology behind Promagen\'s AI image generator scoring. 8 test scenes, multi-assessor scoring, triangulated aggregation.',
    url: `${BASE}/about/how-we-score`,
    type: 'website',
    siteName: 'Promagen',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Promagen — BQI Methodology' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How We Score AI Image Generators — BQI Methodology | Promagen',
    description: 'Transparent methodology behind Promagen\'s AI image generator scoring.',
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
          { '@type': 'ListItem', position: 2, name: 'About', item: `${BASE}/about` },
          { '@type': 'ListItem', position: 3, name: 'How We Score', item: `${BASE}/about/how-we-score` },
        ],
      },
      {
        '@type': 'AboutPage',
        name: 'How Promagen Scores AI Image Generators',
        description: `Builder Quality Intelligence (BQI) methodology: 8 standardised test scenes evaluated across ${totalPlatforms} platforms using triangulated multi-assessor scoring.`,
        url: `${BASE}/about/how-we-score`,
        publisher: {
          '@type': 'Organization',
          name: 'Promagen',
          url: BASE,
        },
      },
    ],
  };
}

// ─── Test suite scenes ─────────────────────────────────────────────────────

interface TestScene {
  number: string;
  name: string;
  purpose: string;
  stressTest: string;
}

const TEST_SCENES: TestScene[] = [
  { number: '01', name: 'Complex Multi-Subject', purpose: 'Tests ability to handle multiple distinct subjects in one scene', stressTest: 'Subject count, spatial relationships, individual attribute retention' },
  { number: '02', name: 'Style Stacking', purpose: 'Tests simultaneous application of multiple artistic styles', stressTest: 'Style blending, reference consistency, technique layering' },
  { number: '03', name: 'Photorealistic Product', purpose: 'Tests commercial-grade photorealism and detail precision', stressTest: 'Material accuracy, lighting fidelity, surface texture' },
  { number: '04', name: 'Illustrative Narrative', purpose: 'Tests storytelling composition and character expression', stressTest: 'Emotional conveyance, narrative coherence, compositional flow' },
  { number: '05', name: 'Weather-Driven Environmental', purpose: 'Tests environmental atmosphere and weather effects', stressTest: 'Atmospheric depth, weather interaction, lighting conditions' },
  { number: '06', name: 'Text and Typography', purpose: 'Tests ability to render legible text within images', stressTest: 'Character accuracy, font rendering, text integration' },
  { number: '07', name: 'Negative Prompt Handling', purpose: 'Tests correct interpretation and exclusion of negative elements', stressTest: 'Exclusion accuracy, positive/negative separation, format compliance' },
  { number: '08', name: 'Edge-Case Format Compliance', purpose: 'Tests adherence to tier-specific format requirements', stressTest: 'Weight syntax, parameter handling, character limit behaviour' },
];

// ─── Scoring metrics ────────────────────────────────────────────────────────

interface ScoringMetric {
  name: string;
  weight: string;
  description: string;
}

const SCORING_METRICS: ScoringMetric[] = [
  { name: 'Prompt Adherence', weight: '40%', description: 'How accurately the output reflects the creative brief. Every element specified in the prompt is checked against the generated image.' },
  { name: 'Anchor Fidelity', weight: '40%', description: 'How faithfully the output matches the scene\'s key anchor elements — the non-negotiable visual requirements that define the scene\'s identity.' },
  { name: 'Format Compliance', weight: '20%', description: 'How correctly the platform processes the tier-specific prompt format. Weight syntax, negative handling, and character limit behaviour are all tested.' },
];

// ─── Page ──────────────────────────────────────────────────────────────────

export default function HowWeScorePage() {
  const counts = getPlatformCounts();
  const lastUpdated = getLastUpdated();
  const bqiRange = getBqiHeadlineRange();

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
            { label: 'About' },
            { label: 'How We Score' },
          ]}
        />

        {/* ── Hero ────────────────────────────────────────────────── */}
        <header style={{ marginBottom: 'clamp(28px, 3vw, 48px)' }}>
          <h1
            className="font-bold text-white tracking-tight leading-tight"
            style={{ fontSize: 'clamp(28px, 3vw, 48px)', marginBottom: 'clamp(10px, 1.2vw, 18px)' }}
          >
            How We Score
            <span className="block text-amber-400" style={{ fontSize: 'clamp(20px, 2vw, 32px)' }}>
              AI Image Generators
            </span>
          </h1>
          <p
            className="text-white leading-relaxed"
            style={{ fontSize: 'clamp(14px, 1.1vw, 18px)', maxWidth: 'clamp(500px, 55vw, 760px)' }}
          >
            Promagen&apos;s Builder Quality Intelligence (BQI) is a quantitative benchmark for
            evaluating how effectively an AI image generator converts your instructions into the
            intended image. This page explains exactly how BQI works — what we test, how we score,
            and why the methodology is designed to be transparent and reproducible.
          </p>
        </header>

        {/* ── Section 1: What BQI is ──────────────────────────────── */}
        <Section title="What is Builder Quality Intelligence?">
          <p className="text-white leading-relaxed" style={{ fontSize: 'clamp(13px, 1vw, 16px)' }}>
            BQI measures <em>prompt intelligence</em> — the platform&apos;s ability to understand
            and execute structured creative direction. Unlike aesthetic rankings or subjective
            &ldquo;best looking&rdquo; lists, BQI tests measurable execution against fixed
            creative briefs. A platform that faithfully renders every element you specified scores
            higher than one that produces a beautiful but unfaithful interpretation.
          </p>
          <p
            className="text-white leading-relaxed"
            style={{ fontSize: 'clamp(13px, 1vw, 16px)', marginTop: 'clamp(8px, 0.8vw, 14px)' }}
          >
            Every BQI score is derived from {counts.total} platforms tested against 8 standardised
            scenes using a three-layer aggregation process designed to eliminate single-assessor bias.
          </p>
        </Section>

        {/* ── Section 2: Core principles ──────────────────────────── */}
        <section style={{ marginBottom: 'clamp(32px, 3.5vw, 52px)' }}>
          <h2
            className="text-white font-semibold"
            style={{ fontSize: 'clamp(18px, 1.5vw, 24px)', marginBottom: 'clamp(14px, 1.5vw, 22px)' }}
          >
            Core Principles
          </h2>
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(auto-fit, minmax(clamp(240px, 26vw, 340px), 1fr))`,
              gap: 'clamp(10px, 1.2vw, 18px)',
            }}
          >
            {[
              { title: 'Objective, not subjective', text: 'BQI never scores artistic beauty or style preference. It only scores measurable execution against a fixed creative brief.' },
              { title: 'Architecturally grounded', text: 'Scores reflect underlying prompt architecture — CLIP tokenisation, natural-language parsing, plain-language simplicity — rather than marketing claims.' },
              { title: 'Triangulated and reproducible', text: 'Every score results from a three-layer aggregation process designed to eliminate single-assessor bias.' },
              { title: 'Transparent and auditable', text: 'Full methodology published on this page so anyone can verify the process and understand how scores are derived.' },
            ].map((p) => (
              <div
                key={p.title}
                className="rounded-xl"
                style={{ background: CARD_BG, border: CARD_BORDER, padding: `clamp(14px, 1.5vw, 22px) clamp(16px, 1.8vw, 26px)` }}
              >
                <h3
                  className="text-amber-400 font-semibold"
                  style={{ fontSize: 'clamp(14px, 1.1vw, 17px)', marginBottom: 'clamp(4px, 0.5vw, 8px)' }}
                >
                  {p.title}
                </h3>
                <p className="text-white leading-relaxed" style={{ fontSize: 'clamp(12px, 0.9vw, 15px)' }}>
                  {p.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 3: Test suite ───────────────────────────────── */}
        <section style={{ marginBottom: 'clamp(32px, 3.5vw, 52px)' }}>
          <h2
            className="text-white font-semibold"
            style={{ fontSize: 'clamp(18px, 1.5vw, 24px)', marginBottom: 'clamp(8px, 1vw, 14px)' }}
          >
            The 8-Scene Test Suite
          </h2>
          <p
            className="text-white leading-relaxed"
            style={{
              fontSize: 'clamp(13px, 1vw, 16px)',
              marginBottom: 'clamp(14px, 1.5vw, 22px)',
              maxWidth: 'clamp(500px, 55vw, 760px)',
            }}
          >
            Each scene is run identically on all {counts.total} platforms using the exact prompt
            format required by that platform&apos;s tier. The scenes are designed to stress-test
            different aspects of prompt understanding.
          </p>

          <div className="overflow-x-auto rounded-xl" style={{ border: DIVIDER, maxWidth: 'clamp(650px, 75vw, 1050px)' }}>
            <table className="w-full border-collapse" style={{ fontSize: 'clamp(12px, 0.9vw, 15px)' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: DIVIDER }}>
                  <th className="text-amber-400 font-semibold text-left" style={{ padding: `clamp(8px, 1vw, 14px) clamp(10px, 1.2vw, 18px)`, whiteSpace: 'nowrap' }}>Scene</th>
                  <th className="text-amber-400 font-semibold text-left" style={{ padding: `clamp(8px, 1vw, 14px) clamp(10px, 1.2vw, 18px)` }}>Name</th>
                  <th className="text-amber-400 font-semibold text-left" style={{ padding: `clamp(8px, 1vw, 14px) clamp(10px, 1.2vw, 18px)` }}>Purpose</th>
                  <th className="text-amber-400 font-semibold text-left" style={{ padding: `clamp(8px, 1vw, 14px) clamp(10px, 1.2vw, 18px)` }}>Key Stress Test</th>
                </tr>
              </thead>
              <tbody>
                {TEST_SCENES.map((scene, i) => (
                  <tr key={scene.number} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td className="text-amber-300 font-mono font-semibold" style={{ padding: `clamp(6px, 0.7vw, 10px) clamp(10px, 1.2vw, 18px)` }}>{scene.number}</td>
                    <td className="text-white font-medium" style={{ padding: `clamp(6px, 0.7vw, 10px) clamp(10px, 1.2vw, 18px)`, whiteSpace: 'nowrap' }}>{scene.name}</td>
                    <td className="text-white" style={{ padding: `clamp(6px, 0.7vw, 10px) clamp(10px, 1.2vw, 18px)` }}>{scene.purpose}</td>
                    <td className="text-white" style={{ padding: `clamp(6px, 0.7vw, 10px) clamp(10px, 1.2vw, 18px)` }}>{scene.stressTest}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Section 4: Three-layer aggregation ──────────────────── */}
        <section style={{ marginBottom: 'clamp(32px, 3.5vw, 52px)' }}>
          <h2
            className="text-white font-semibold"
            style={{ fontSize: 'clamp(18px, 1.5vw, 24px)', marginBottom: 'clamp(14px, 1.5vw, 22px)' }}
          >
            Three-Layer Aggregation
          </h2>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'clamp(12px, 1.3vw, 20px)',
              maxWidth: 'clamp(550px, 60vw, 800px)',
            }}
          >
            {[
              {
                layer: 'Layer 1',
                name: 'Raw Execution',
                colour: '#38bdf8',
                text: `Each platform receives all 8 test scenes in its native prompt format under identical conditions. No platform gets special treatment — every scene is formatted according to the platform's tier requirements.`,
              },
              {
                layer: 'Layer 2',
                name: 'Multi-Assessor Scoring',
                colour: '#a78bfa',
                text: 'Every output is independently scored by multiple large vision-language models and human reviewers on three metrics: Prompt Adherence (40%), Anchor Fidelity (40%), and Format Compliance (20%).',
              },
              {
                layer: 'Layer 3',
                name: 'Triangulated Median',
                colour: '#34d399',
                text: 'The median is taken after removing the highest and lowest scores to eliminate outlier bias. Three metric medians combine into one scene score. Eight scene scores are averaged for the final BQI score (0\u2013100).',
              },
            ].map((l) => (
              <div
                key={l.layer}
                className="rounded-xl"
                style={{ background: CARD_BG, border: CARD_BORDER, padding: `clamp(14px, 1.5vw, 22px) clamp(16px, 1.8vw, 26px)` }}
              >
                <div className="flex items-baseline" style={{ gap: 'clamp(6px, 0.6vw, 10px)', marginBottom: 'clamp(4px, 0.5vw, 8px)' }}>
                  <span className="font-bold" style={{ fontSize: 'clamp(13px, 1vw, 16px)', color: l.colour }}>{l.layer}</span>
                  <span className="text-white font-semibold" style={{ fontSize: 'clamp(14px, 1.1vw, 17px)' }}>{l.name}</span>
                </div>
                <p className="text-white leading-relaxed" style={{ fontSize: 'clamp(12px, 0.9vw, 15px)' }}>{l.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Scoring metrics ──────────────────────────────────────── */}
        <section style={{ marginBottom: 'clamp(32px, 3.5vw, 52px)' }}>
          <h2
            className="text-white font-semibold"
            style={{ fontSize: 'clamp(18px, 1.5vw, 24px)', marginBottom: 'clamp(14px, 1.5vw, 22px)' }}
          >
            Scoring Metrics
          </h2>
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(auto-fit, minmax(clamp(220px, 24vw, 320px), 1fr))`,
              gap: 'clamp(10px, 1.2vw, 18px)',
            }}
          >
            {SCORING_METRICS.map((m) => (
              <div
                key={m.name}
                className="rounded-xl"
                style={{ background: CARD_BG, border: CARD_BORDER, padding: `clamp(14px, 1.5vw, 22px) clamp(16px, 1.8vw, 26px)` }}
              >
                <div className="flex items-baseline" style={{ gap: 'clamp(6px, 0.6vw, 10px)', marginBottom: 'clamp(4px, 0.5vw, 8px)' }}>
                  <span className="text-amber-400 font-semibold" style={{ fontSize: 'clamp(14px, 1.1vw, 17px)' }}>{m.name}</span>
                  <span className="text-amber-300 font-bold tabular-nums" style={{ fontSize: 'clamp(13px, 1vw, 16px)' }}>{m.weight}</span>
                </div>
                <p className="text-white leading-relaxed" style={{ fontSize: 'clamp(12px, 0.9vw, 15px)' }}>{m.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 5: Measures vs doesn't ──────────────────────── */}
        <section style={{ marginBottom: 'clamp(32px, 3.5vw, 52px)', maxWidth: 'clamp(550px, 60vw, 800px)' }}>
          <h2
            className="text-white font-semibold"
            style={{ fontSize: 'clamp(18px, 1.5vw, 24px)', marginBottom: 'clamp(14px, 1.5vw, 22px)' }}
          >
            What BQI Measures — and What It Doesn&apos;t
          </h2>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 'clamp(12px, 1.3vw, 20px)' }}>
            <div className="rounded-xl" style={{ background: CARD_BG, border: CARD_BORDER, padding: `clamp(14px, 1.5vw, 22px) clamp(16px, 1.8vw, 26px)` }}>
              <h3 className="text-emerald-400 font-semibold" style={{ fontSize: 'clamp(14px, 1.1vw, 17px)', marginBottom: 'clamp(8px, 0.8vw, 12px)' }}>
                BQI measures
              </h3>
              <div className="text-white leading-relaxed" style={{ fontSize: 'clamp(12px, 0.9vw, 15px)' }}>
                Prompt understanding and execution fidelity, architectural compatibility with different tiers, and consistency across controlled conditions.
              </div>
            </div>
            <div className="rounded-xl" style={{ background: CARD_BG, border: CARD_BORDER, padding: `clamp(14px, 1.5vw, 22px) clamp(16px, 1.8vw, 26px)` }}>
              <h3 className="text-white font-semibold" style={{ fontSize: 'clamp(14px, 1.1vw, 17px)', marginBottom: 'clamp(8px, 0.8vw, 12px)' }}>
                BQI does not measure
              </h3>
              <div className="text-white leading-relaxed" style={{ fontSize: 'clamp(12px, 0.9vw, 15px)' }}>
                Aesthetic quality, generation speed or cost, safety filters, UI/UX design, or training data recency. These are important but outside BQI&apos;s scope.
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 6: Headline results (Option B) ──────────────── */}
        <Section title="Headline Results">
          <div
            className="rounded-xl"
            style={{
              background: 'rgba(251, 191, 36, 0.06)',
              border: '1px solid rgba(251, 191, 36, 0.15)',
              padding: `clamp(16px, 1.8vw, 26px) clamp(18px, 2vw, 28px)`,
            }}
          >
            <p className="text-white leading-relaxed" style={{ fontSize: 'clamp(14px, 1.1vw, 17px)' }}>
              Across our 8-scene test suite, the {counts.total} platforms score between{' '}
              <span className="text-amber-400 font-bold tabular-nums">{bqiRange.min}</span> and{' '}
              <span className="text-amber-400 font-bold tabular-nums">{bqiRange.max}</span> on a
              100-point scale. Scores vary significantly by tier and scene complexity.
            </p>
            <p
              className="text-amber-300"
              style={{ fontSize: 'clamp(12px, 0.9vw, 15px)', marginTop: 'clamp(8px, 0.8vw, 12px)' }}
            >
              Full per-platform breakdowns will be published once the scoring pipeline reaches
              automated maturity and multiple stable batch runs confirm score consistency.
            </p>
          </div>
        </Section>

        {/* ── FAQ ─────────────────────────────────────────────────── */}
        <Section title="Frequently asked questions">
          <FaqItem
            question="How does Promagen rank AI image generators?"
            answer={`Promagen uses Builder Quality Intelligence (BQI) — a quantitative benchmark that tests ${counts.total} platforms against 8 standardised scenes. Each output is scored by multiple assessors on prompt adherence, anchor fidelity, and format compliance. Scores are triangulated to eliminate bias and averaged across all scenes for a final score of 0–100.`}
          />
          <FaqItem
            question="Is BQI the same as image quality rankings?"
            answer="No. BQI measures prompt intelligence — how well the platform understands and executes your instructions. A platform could produce stunning images but score lower on BQI if it ignores parts of your prompt. Aesthetic quality, while important, is subjective and outside BQI's scope."
          />
          <FaqItem
            question="How often are BQI scores updated?"
            answer="BQI scores are recalculated when platform capabilities change (new models, updated text encoders) or when new test scenes are added to the suite. The scoring pipeline is being automated to support more frequent and reproducible batch runs."
          />
          <FaqItem
            question="Why don't you show individual platform BQI scores?"
            answer="The BQI system has completed its first full batch run, but scene calibration is ongoing and several platforms need rescoring after recent tier corrections. Publishing per-platform scores from a maturing system would commit to numbers that may shift. Full breakdowns will be published once the pipeline is stable."
          />
          <FaqItem
            question="Can I see the test prompts used in BQI?"
            answer="The 8 scene descriptions and their stress-test parameters are documented on this page. The exact prompt text for each scene is formatted per platform tier and is part of the scoring infrastructure. The methodology is fully transparent — what we test and how we score is published here."
          />
        </Section>

        {/* ── Internal links ──────────────────────────────────────── */}
        <Section title="Explore further">
          <div className="flex flex-wrap" style={{ gap: 'clamp(8px, 0.8vw, 14px)' }}>
            {[
              { href: '/platforms', label: `All ${counts.total} platforms` },
              { href: '/guides/prompt-formats', label: 'Prompt format guide' },
              { href: '/platforms/negative-prompts', label: 'Negative prompt support' },
              { href: '/platforms/compare/midjourney-vs-dalle', label: 'Midjourney vs DALL\u00b7E 3' },
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
            href="/prompt-lab"
            className="inline-block rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer transition-colors"
            style={{
              fontSize: 'clamp(14px, 1.1vw, 18px)',
              padding: `clamp(12px, 1.3vw, 18px) clamp(24px, 3vw, 40px)`,
            }}
          >
            Try Prompt Lab — Optimised prompts for any platform
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
            BQI methodology and scoring infrastructure developed by Promagen.
            Last updated: <span className="text-amber-400">{lastUpdated}</span>.
            Scores are recalculated when platform capabilities change or new test scenes are added.
          </p>
        </footer>
      </main>
    </>
  );
}
