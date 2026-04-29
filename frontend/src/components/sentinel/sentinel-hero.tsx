// src/components/sentinel/sentinel-hero.tsx
// ============================================================================
// SENTINEL HERO — Commercial repositioning hero block
// ============================================================================
// Used on:
//   /          (homepage — leads above all other sections)
//   /sentinel  (dedicated Sentinel product page — used at top)
//
// Authority: docs/authority/commercial-positioning.md
// Buttons: docs/authority/buttons.md §2.1 (purple gradient canonical),
//          §5 (sky/emerald/indigo engine-bay style for primary CTA)
//
// AI Disguise rule: Copy here references EXTERNAL AI systems (ChatGPT, Claude,
// Perplexity, AI image platforms). It does NOT reference Promagen's internal
// engine. This is allowed by promagen-ai-authority-pages-FINAL §3.4.
// ============================================================================

import React from 'react';
import Link from 'next/link';

export interface SentinelHeroProps {
  /** When true, renders the more compact homepage variant (no breadcrumb, no eyebrow). */
  variant?: 'homepage' | 'product';
}

export default function SentinelHero({ variant = 'homepage' }: SentinelHeroProps) {
  const isProduct = variant === 'product';

  return (
    <section
      aria-label="Sentinel — AI Platform Intelligence and AI Visibility Intelligence"
      className="relative w-full overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at top, rgba(56,189,248,0.10) 0%, rgba(2,6,23,0) 60%), linear-gradient(180deg, rgba(2,6,23,0.98) 0%, rgba(2,6,23,1) 100%)',
      }}
    >
      <div
        className="relative mx-auto flex w-full max-w-6xl flex-col items-start"
        style={{
          padding: 'clamp(40px, 6vw, 96px) clamp(20px, 3vw, 48px)',
          gap: 'clamp(20px, 2vw, 32px)',
        }}
      >
        {/* Eyebrow */}
        <span
          className="inline-flex items-center gap-2 rounded-full border border-sky-400/40 bg-sky-400/10 font-medium uppercase tracking-wide text-sky-200"
          style={{
            padding: 'clamp(4px, 0.6vw, 8px) clamp(10px, 1.2vw, 16px)',
            fontSize: 'clamp(0.65rem, 0.8vw, 0.78rem)',
            letterSpacing: '0.08em',
          }}
        >
          <span aria-hidden="true">●</span>
          {isProduct ? 'Sentinel — by Promagen' : 'Now from Promagen'}
        </span>

        {/* Headline */}
        <h1
          className="font-bold leading-tight text-white"
          style={{
            fontSize: 'clamp(2rem, 5vw, 4rem)',
            letterSpacing: '-0.02em',
          }}
        >
          AI Platform Intelligence.
          <br />
          <span className="bg-gradient-to-r from-sky-400 via-emerald-300 to-indigo-400 bg-clip-text text-transparent">
            AI Visibility Intelligence.
          </span>
        </h1>

        {/* Sub-headline */}
        <p
          className="max-w-3xl text-slate-300"
          style={{
            fontSize: 'clamp(1rem, 1.4vw, 1.35rem)',
            lineHeight: 1.55,
          }}
        >
          Sentinel watches whether AI systems can find, read, cite and send traffic to your
          content — then tells you exactly what to fix next, every week.
        </p>

        {/* Supporting line — product variant only.
            Homepage hero stays short so the click to /sentinel feels like a real
            navigation; the deeper narrative lives on the deep page. */}
        {isProduct && (
          <p
            className="max-w-3xl text-slate-400"
            style={{ fontSize: 'clamp(0.85rem, 1vw, 1rem)', lineHeight: 1.6 }}
          >
            Built and battle-tested on Promagen itself: 57 authority pages, 40-platform
            intelligence, and a weekly report that turns crawl data, AI citation tracking,
            and machine-readability checks into one prioritised action list.
          </p>
        )}

        {/* CTA row */}
        <div className="flex flex-wrap items-center" style={{ gap: 'clamp(10px, 1vw, 16px)' }}>
          {/* Primary — engine bay style (sky/emerald/indigo) */}
          <Link
            href={isProduct ? '#how-sentinel-works' : '/sentinel'}
            className="group inline-flex items-center gap-2 rounded-2xl border border-sky-400/60 bg-gradient-to-r from-sky-400/40 via-emerald-300/40 to-indigo-400/40 font-semibold text-white no-underline shadow-sm transition-all hover:border-sky-300 hover:from-sky-400/55 hover:via-emerald-300/55 hover:to-indigo-400/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/80 cursor-pointer"
            style={{
              padding: 'clamp(12px, 1.2vw, 16px) clamp(20px, 2vw, 28px)',
              fontSize: 'clamp(0.9rem, 1vw, 1.05rem)',
            }}
          >
            <span className="text-white" aria-hidden="true">✦</span>
            <span className="text-white">
              {isProduct ? 'How Sentinel works' : 'See Sentinel'}
            </span>
            <svg
              className="shrink-0 text-white transition-transform group-hover:translate-x-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              style={{ width: 'clamp(16px, 1.1vw, 20px)', height: 'clamp(16px, 1.1vw, 20px)' }}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7-7 7M21 12H3" />
            </svg>
          </Link>

        </div>

        {/* Bullet strip — product variant only. Homepage stays minimal. */}
        {isProduct && (
          <ul
            className="mt-2 flex flex-wrap items-center text-slate-400"
            style={{ gap: 'clamp(12px, 1.4vw, 24px)', fontSize: 'clamp(0.75rem, 0.85vw, 0.9rem)' }}
          >
            <li className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="text-emerald-400">✓</span>
              Weekly action report
            </li>
            <li className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="text-emerald-400">✓</span>
              ChatGPT · Claude · Perplexity · Gemini citation tracking
            </li>
            <li className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="text-emerald-400">✓</span>
              Live on Promagen as proof
            </li>
          </ul>
        )}
      </div>
    </section>
  );
}
