// src/components/sentinel/sentinel-case-study.tsx
// ============================================================================
// SENTINEL CASE STUDY — The bridge between Sentinel and the leaderboard
// ============================================================================
// Walks the visitor through Promagen's own Sentinel intake, what we shipped,
// and how to verify the result independently. This is the deepest proof
// asset on /sentinel — anchored at #proof for cold outreach.
//
// Structure:
//   1. Header (eyebrow + heading + sub)
//   2. Two-column grid:
//      - Left: "The intake" (the same fields we'd ask any client for)
//      - Right: "What we shipped" (the technical changes that produce visibility)
//   3. Verify-it-yourself block (3 sample queries + dual CTA)
//
// Authority: docs/authority/commercial-strategy.md §2.4
// Used by:  /sentinel page (between SentinelProof and SentinelOfferStack)
// ============================================================================

import React from 'react';
import Link from 'next/link';

type IntakeRow = {
  field: string;
  promagen: string | React.ReactNode;
};

type ShippedRow = {
  area: string;
  detail: string;
};

type Query = string;

const INTAKE: IntakeRow[] = [
  { field: 'Domain', promagen: 'promagen.com' },
  { field: 'Top competitors', promagen: 'lexica.art · prompthero.com · playground.com' },
  {
    field: 'Priority queries',
    promagen: '8 buyer-intent questions across category, comparison, and use-case',
  },
  { field: 'Brand variants', promagen: '"Promagen", "promagen.com", founder name' },
  {
    field: 'Priority pages',
    promagen: '/platforms, /platforms/compare/*, /guides/best-generator-for/*, /about/how-we-score',
  },
  { field: 'Geography', promagen: 'UK + global English' },
];

const SHIPPED: ShippedRow[] = [
  {
    area: 'Schema.org markup',
    detail:
      'Article, FAQPage, ItemList, BreadcrumbList and Organization JSON-LD across all 57 authority pages. AI engines build entity associations from this.',
  },
  {
    area: 'Comparison structure',
    detail:
      '8 pre-rendered platform-vs-platform pages with explicit comparison tables. Direct-answer shape that AI engines extract cleanly.',
  },
  {
    area: 'Use-case taxonomy',
    detail:
      '4 buyer-intent guides ("best AI image generator for photorealism / illustration / product mockups / concept art"). Matches the queries buyers actually ask.',
  },
  {
    area: 'Internal link graph',
    detail:
      '/platforms hub linking to 40 profile pages. Hub-and-spoke architecture that distributes authority and helps crawlers reach every page.',
  },
  {
    area: 'Freshness signals',
    detail:
      'ISR-revalidated content + daily Sentinel cron that flags any regression. AI engines weight recent, healthy sources.',
  },
  {
    area: 'Crawler access',
    detail:
      'robots.txt explicitly allows GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended. No accidental blocks.',
  },
];

const VERIFY_QUERIES: Query[] = [
  "What's the best AI image generator?",
  'Midjourney vs DALL·E — which should I use?',
  'Best AI image platform for product photography',
];

function IntakeColumn() {
  return (
    <div
      className="rounded-2xl border border-white/[0.08] bg-slate-900/50"
      style={{ padding: 'clamp(20px, 2vw, 32px)' }}
    >
      <header style={{ marginBottom: 'clamp(14px, 1.4vw, 20px)' }}>
        <span
          className="font-mono uppercase tracking-wide text-slate-500"
          style={{ fontSize: 'clamp(0.65rem, 0.75vw, 0.75rem)', letterSpacing: '0.08em' }}
        >
          Step 1 — the intake
        </span>
        <h3
          className="mt-1 font-semibold text-white"
          style={{ fontSize: 'clamp(1.05rem, 1.2vw, 1.25rem)' }}
        >
          The same fields we&rsquo;d ask any client for
        </h3>
      </header>

      <dl className="flex flex-col" style={{ gap: 'clamp(10px, 1vw, 14px)' }}>
        {INTAKE.map((row) => (
          <div
            key={row.field}
            className="flex flex-col gap-1 rounded-xl border border-white/[0.05] bg-slate-950/40"
            style={{ padding: 'clamp(10px, 1vw, 14px)' }}
          >
            <dt
              className="font-mono uppercase tracking-wide text-slate-500"
              style={{
                fontSize: 'clamp(0.6rem, 0.7vw, 0.7rem)',
                letterSpacing: '0.08em',
              }}
            >
              {row.field}
            </dt>
            <dd
              className="font-mono text-slate-200"
              style={{ fontSize: 'clamp(0.78rem, 0.85vw, 0.88rem)', lineHeight: 1.5 }}
            >
              {row.promagen}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ShippedColumn() {
  return (
    <div
      className="rounded-2xl border border-emerald-400/20 bg-slate-900/50"
      style={{ padding: 'clamp(20px, 2vw, 32px)' }}
    >
      <header style={{ marginBottom: 'clamp(14px, 1.4vw, 20px)' }}>
        <span
          className="font-mono uppercase tracking-wide text-emerald-300"
          style={{ fontSize: 'clamp(0.65rem, 0.75vw, 0.75rem)', letterSpacing: '0.08em' }}
        >
          Step 2 — what we shipped
        </span>
        <h3
          className="mt-1 font-semibold text-white"
          style={{ fontSize: 'clamp(1.05rem, 1.2vw, 1.25rem)' }}
        >
          The changes AI engines actually reward
        </h3>
      </header>

      <ul className="flex flex-col" style={{ gap: 'clamp(10px, 1vw, 14px)' }}>
        {SHIPPED.map((row) => (
          <li
            key={row.area}
            className="flex gap-3 rounded-xl border border-white/[0.05] bg-slate-950/40"
            style={{ padding: 'clamp(10px, 1vw, 14px)' }}
          >
            <span
              className="mt-0.5 shrink-0 text-emerald-400"
              aria-hidden="true"
              style={{ fontSize: 'clamp(0.85rem, 0.95vw, 0.95rem)', lineHeight: 1.4 }}
            >
              ✓
            </span>
            <div>
              <div
                className="font-medium text-white"
                style={{ fontSize: 'clamp(0.85rem, 0.95vw, 0.95rem)' }}
              >
                {row.area}
              </div>
              <p
                className="mt-1 text-slate-300"
                style={{ fontSize: 'clamp(0.78rem, 0.85vw, 0.88rem)', lineHeight: 1.55 }}
              >
                {row.detail}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VerifyBlock() {
  return (
    <div
      className="rounded-2xl border border-sky-400/30 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950"
      style={{ padding: 'clamp(20px, 2.2vw, 36px)' }}
    >
      <header style={{ marginBottom: 'clamp(14px, 1.4vw, 22px)' }}>
        <span
          className="font-mono uppercase tracking-wide text-sky-300"
          style={{ fontSize: 'clamp(0.65rem, 0.75vw, 0.75rem)', letterSpacing: '0.08em' }}
        >
          Step 3 — verify it yourself
        </span>
        <h3
          className="mt-1 font-semibold text-white"
          style={{ fontSize: 'clamp(1.1rem, 1.3vw, 1.4rem)' }}
        >
          Open your AI engine of choice. Ask one of these.
        </h3>
        <p
          className="mt-2 text-slate-300"
          style={{ fontSize: 'clamp(0.85rem, 0.95vw, 0.95rem)', lineHeight: 1.6 }}
        >
          ChatGPT, Claude, Perplexity, or Gemini. See whether our leaderboard pages appear in
          the answer. Not a screenshot we control — a live, third-party check anyone can run.
        </p>
      </header>

      <ul
        className="grid"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 'clamp(10px, 1vw, 14px)',
          marginBottom: 'clamp(18px, 2vw, 28px)',
        }}
      >
        {VERIFY_QUERIES.map((q) => (
          <li
            key={q}
            className="rounded-xl border border-white/[0.08] bg-slate-950/60 font-mono text-slate-200"
            style={{
              padding: 'clamp(10px, 1vw, 14px) clamp(14px, 1.2vw, 18px)',
              fontSize: 'clamp(0.78rem, 0.85vw, 0.88rem)',
              lineHeight: 1.5,
            }}
          >
            <span className="text-slate-500" aria-hidden="true">&gt;&nbsp;</span>
            {q}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center" style={{ gap: 'clamp(10px, 1vw, 16px)' }}>
        <Link
          href="/platforms"
          className="inline-flex items-center gap-2 rounded-full border border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 font-medium no-underline shadow-sm transition-all hover:border-purple-400 hover:from-purple-600/30 hover:to-pink-600/30 cursor-pointer"
          style={{
            padding: 'clamp(10px, 1vw, 14px) clamp(16px, 1.6vw, 22px)',
            fontSize: 'clamp(0.85rem, 0.95vw, 0.95rem)',
          }}
        >
          <span className="text-purple-100">Open the live leaderboard</span>
        </Link>
        <Link
          href="#sentinel-offer"
          className="group inline-flex items-center gap-2 rounded-2xl border border-sky-400/60 bg-gradient-to-r from-sky-400/40 via-emerald-300/40 to-indigo-400/40 font-semibold text-white no-underline shadow-sm transition-all hover:border-sky-300 hover:from-sky-400/55 hover:via-emerald-300/55 hover:to-indigo-400/55 cursor-pointer"
          style={{
            padding: 'clamp(10px, 1.1vw, 14px) clamp(18px, 1.8vw, 26px)',
            fontSize: 'clamp(0.85rem, 0.95vw, 0.95rem)',
          }}
        >
          <span className="text-white">Book your Snapshot</span>
          <svg
            className="shrink-0 text-white transition-transform group-hover:translate-x-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            style={{ width: 'clamp(14px, 1vw, 18px)', height: 'clamp(14px, 1vw, 18px)' }}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7-7 7M21 12H3" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

export default function SentinelCaseStudy() {
  return (
    <section
      id="proof"
      aria-label="Sentinel live case study — how we did it on Promagen"
      className="w-full bg-slate-950"
      style={{
        padding: 'clamp(40px, 5vw, 88px) clamp(20px, 3vw, 48px)',
        scrollMarginTop: 'clamp(24px, 3vh, 48px)',
      }}
    >
      <div className="mx-auto max-w-6xl">
        <header style={{ marginBottom: 'clamp(28px, 3vw, 48px)' }}>
          <span
            className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 font-medium uppercase tracking-wide text-emerald-200"
            style={{
              padding: 'clamp(4px, 0.6vw, 6px) clamp(10px, 1.2vw, 14px)',
              fontSize: 'clamp(0.65rem, 0.75vw, 0.75rem)',
              letterSpacing: '0.08em',
            }}
          >
            <span aria-hidden="true">●</span>
            Live case study
          </span>
          <h2
            className="mt-3 font-semibold text-white"
            style={{ fontSize: 'clamp(1.6rem, 2.6vw, 2.4rem)', letterSpacing: '-0.01em' }}
          >
            How we did it on Promagen
          </h2>
          <p
            className="mt-3 max-w-3xl text-slate-300"
            style={{ fontSize: 'clamp(0.95rem, 1.1vw, 1.1rem)', lineHeight: 1.6 }}
          >
            The same Sentinel intake we&rsquo;d run on your domain &mdash; applied to ours, with
            a verifiable result anyone can check in 30 seconds. No screenshots. No managed demos.
          </p>
        </header>

        <div
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 'clamp(16px, 1.8vw, 28px)',
            marginBottom: 'clamp(24px, 2.4vw, 36px)',
          }}
        >
          <IntakeColumn />
          <ShippedColumn />
        </div>

        <VerifyBlock />
      </div>
    </section>
  );
}
