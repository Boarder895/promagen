// src/components/sentinel/sentinel-pillars.tsx
// ============================================================================
// SENTINEL PILLARS — 4-up value strip
// ============================================================================
// Communicates what Sentinel actually checks, in plain language. Mirrors the
// internal architecture (Watchkeeper → Intelligence → Citation Cockpit →
// Monday Report) without revealing internal engine details.
//
// Authority: docs/authority/sentinel.md §1, §3, §4, §9
// ============================================================================

import React from 'react';

type Pillar = {
  number: string;
  title: string;
  body: string;
  accent: string;
};

const PILLARS: Pillar[] = [
  {
    number: '01',
    title: 'Watch',
    body: 'Crawl every public page weekly. Track titles, meta descriptions, canonicals, schema, internal links, response time, content freshness — page by page.',
    accent: 'border-sky-400/40 bg-sky-400/[0.04]',
  },
  {
    number: '02',
    title: 'Detect',
    body: 'Compare week over week. Catch broken pages, lost titles, missing schema, content shrink, and orphaned pages before they cost you visibility.',
    accent: 'border-emerald-400/40 bg-emerald-400/[0.04]',
  },
  {
    number: '03',
    title: 'Cite',
    body: 'Track whether ChatGPT, Claude, Perplexity and Gemini name your brand, link your pages, and how that score moves over time. AI crawler activity included.',
    accent: 'border-indigo-400/40 bg-indigo-400/[0.04]',
  },
  {
    number: '04',
    title: 'Report',
    body: 'One Monday email. Health score, regressions, improvements, top three actions for the week. Plain English. No dashboard archaeology required.',
    accent: 'border-purple-400/40 bg-purple-400/[0.04]',
  },
];

export default function SentinelPillars() {
  return (
    <section
      aria-label="What Sentinel checks"
      className="w-full bg-slate-950"
      style={{ padding: 'clamp(32px, 4vw, 64px) clamp(20px, 3vw, 48px)' }}
    >
      <div className="mx-auto max-w-6xl">
        <header style={{ marginBottom: 'clamp(20px, 2.4vw, 36px)' }}>
          <h2
            className="font-semibold text-white"
            style={{
              fontSize: 'clamp(1.4rem, 2.4vw, 2.2rem)',
              letterSpacing: '-0.01em',
            }}
          >
            What Sentinel actually checks
          </h2>
          <p
            className="mt-2 max-w-2xl text-slate-400"
            style={{ fontSize: 'clamp(0.85rem, 1vw, 1rem)', lineHeight: 1.6 }}
          >
            Four loops, one report. Every signal is evidence-first, not opinion-first.
          </p>
        </header>

        <ul
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 'clamp(12px, 1.4vw, 20px)',
          }}
        >
          {PILLARS.map((p) => (
            <li
              key={p.number}
              className={`flex flex-col rounded-2xl border ${p.accent} text-slate-200`}
              style={{
                padding: 'clamp(18px, 1.8vw, 28px)',
                gap: 'clamp(8px, 1vw, 14px)',
              }}
            >
              <span
                className="font-mono text-slate-500"
                style={{ fontSize: 'clamp(0.7rem, 0.8vw, 0.85rem)', letterSpacing: '0.1em' }}
              >
                {p.number}
              </span>
              <h3
                className="font-semibold text-white"
                style={{ fontSize: 'clamp(1.1rem, 1.4vw, 1.4rem)' }}
              >
                {p.title}
              </h3>
              <p
                className="text-slate-300"
                style={{ fontSize: 'clamp(0.85rem, 0.95vw, 0.95rem)', lineHeight: 1.55 }}
              >
                {p.body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
