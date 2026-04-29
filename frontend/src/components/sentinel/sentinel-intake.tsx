// src/components/sentinel/sentinel-intake.tsx
// ============================================================================
// SENTINEL INTAKE — what we need from you
// ============================================================================
// Sits between Demo (HOW it manifests) and Proof (the live case study). Sets
// the buyer expectation that Sentinel is only as accurate as the priorities
// they hand over, and pre-qualifies on the same four signals the actual
// intake form will collect. Same 4-up Pillars grid pattern so the journey
// reads as one continuous shape: WHAT → HOW → WHAT WE NEED.
//
// Authority: docs/authority/commercial-strategy.md §2.4 (bridge case study
// intake fields), .claude/skills/sentinel-readiness/SKILL.md §6.1 (Onboard
// gate intake completeness).
// ============================================================================

import React from 'react';

type Field = {
  number: string;
  title: string;
  body: string;
  accent: string;
};

const FIELDS: Field[] = [
  {
    number: '01',
    title: 'Your domain and brand variants',
    body: 'The domain we audit, plus the names buyers actually use for you — official, abbreviation, founder name, common misspellings. Citation tracking checks every variant.',
    accent: 'border-sky-400/40 bg-sky-400/[0.04]',
  },
  {
    number: '02',
    title: 'Three competitors',
    body: 'The sites you measure yourself against. Sentinel checks whether AI engines name them when buyers ask category questions, and tracks how citation share moves week over week.',
    accent: 'border-emerald-400/40 bg-emerald-400/[0.04]',
  },
  {
    number: '03',
    title: 'Eight to twelve priority queries',
    body: 'The questions your buyers ask AI engines — the verbatim phrasings, not keywords. Each one is tested against ChatGPT, Claude, Perplexity and Gemini, every week.',
    accent: 'border-indigo-400/40 bg-indigo-400/[0.04]',
  },
  {
    number: '04',
    title: 'Five to fifteen priority pages',
    body: 'The URLs that matter most — landing pages, methodology, comparisons, pricing. Every public page on the site is crawled, but these get the deep-audit treatment.',
    accent: 'border-purple-400/40 bg-purple-400/[0.04]',
  },
];

export default function SentinelIntake() {
  return (
    <section
      aria-label="What we need from you to start"
      className="w-full bg-slate-950"
      style={{ padding: 'clamp(32px, 4vw, 64px) clamp(20px, 3vw, 48px)' }}
    >
      <div className="mx-auto max-w-6xl">
        <header style={{ marginBottom: 'clamp(20px, 2.4vw, 36px)' }}>
          <span
            className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-300/10 font-medium uppercase tracking-wide text-amber-200"
            style={{
              padding: 'clamp(4px, 0.6vw, 6px) clamp(10px, 1.2vw, 14px)',
              fontSize: 'clamp(0.65rem, 0.75vw, 0.75rem)',
              letterSpacing: '0.08em',
            }}
          >
            <span aria-hidden="true">●</span>
            What we need from you
          </span>
          <h2
            className="mt-3 font-semibold text-white"
            style={{ fontSize: 'clamp(1.4rem, 2.4vw, 2.2rem)', letterSpacing: '-0.01em' }}
          >
            What we need to start
          </h2>
          <p
            className="mt-2 max-w-2xl text-slate-400"
            style={{ fontSize: 'clamp(0.85rem, 1vw, 1rem)', lineHeight: 1.6 }}
          >
            Sentinel is only as accurate as the priorities you hand over. The intake is short — most teams complete it in under thirty minutes — and the same four signals drive every weekly report from then on.
          </p>
        </header>

        <ul
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 'clamp(12px, 1.4vw, 20px)',
          }}
        >
          {FIELDS.map((f) => (
            <li
              key={f.number}
              className={`flex flex-col rounded-2xl border ${f.accent} text-slate-200`}
              style={{
                padding: 'clamp(18px, 1.8vw, 28px)',
                gap: 'clamp(8px, 1vw, 14px)',
              }}
            >
              <span
                className="font-mono text-slate-500"
                style={{
                  fontSize: 'clamp(0.7rem, 0.8vw, 0.85rem)',
                  letterSpacing: '0.1em',
                }}
              >
                {f.number}
              </span>
              <h3
                className="font-semibold text-white"
                style={{ fontSize: 'clamp(1.1rem, 1.4vw, 1.4rem)' }}
              >
                {f.title}
              </h3>
              <p
                className="text-slate-300"
                style={{
                  fontSize: 'clamp(0.85rem, 0.95vw, 0.95rem)',
                  lineHeight: 1.55,
                }}
              >
                {f.body}
              </p>
            </li>
          ))}
        </ul>

        <p
          className="mx-auto mt-6 max-w-2xl text-center text-slate-400"
          style={{ fontSize: 'clamp(0.8rem, 0.9vw, 0.9rem)', lineHeight: 1.6 }}
        >
          Geographic focus and a stakeholder contact round out the intake. We share a Google Doc once you commit; you fill in your fields; the first crawl runs within five working days.
        </p>
      </div>
    </section>
  );
}
