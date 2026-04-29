// src/components/sentinel/sentinel-proof.tsx
// ============================================================================
// SENTINEL PROOF — "Live on Promagen" trust block
// ============================================================================
// Reinforces credibility: Promagen runs Sentinel against itself. This is the
// flagship case study. Numbers come from sentinel.md (57 pages, 24 modules,
// 72 tests, 4 page classes, 7 tables) — pulled at copy-write time and kept
// stable here unless the underlying authority doc updates.
//
// Authority: docs/authority/sentinel.md (intro, §3.14, §15)
// ============================================================================

import React from 'react';
import Link from 'next/link';

type Stat = {
  value: string;
  label: string;
};

const STATS: Stat[] = [
  { value: '57', label: 'authority pages monitored' },
  { value: '40', label: 'AI image platforms tracked' },
  { value: '4', label: 'AI engines on the citation board' },
  { value: 'Mon 06:00', label: 'weekly action report' },
];

export default function SentinelProof() {
  return (
    <section
      aria-label="Promagen as the live Sentinel case study"
      className="w-full bg-slate-950"
      style={{ padding: 'clamp(32px, 4vw, 80px) clamp(20px, 3vw, 48px)' }}
    >
      <div className="mx-auto max-w-6xl">
        <div
          className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-slate-900 to-slate-950"
          style={{ padding: 'clamp(24px, 3vw, 56px)' }}
        >
          <div
            className="grid items-center"
            style={{
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 'clamp(20px, 2.4vw, 40px)',
            }}
          >
            {/* Left — narrative */}
            <div className="flex flex-col" style={{ gap: 'clamp(12px, 1.2vw, 18px)' }}>
              <span
                className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 font-medium uppercase tracking-wide text-emerald-200"
                style={{
                  padding: 'clamp(4px, 0.6vw, 6px) clamp(10px, 1.2vw, 14px)',
                  fontSize: 'clamp(0.65rem, 0.75vw, 0.75rem)',
                  letterSpacing: '0.08em',
                  alignSelf: 'flex-start',
                }}
              >
                <span aria-hidden="true">●</span>
                Live case study
              </span>

              <h2
                className="font-semibold text-white"
                style={{ fontSize: 'clamp(1.4rem, 2.2vw, 2rem)', letterSpacing: '-0.01em' }}
              >
                Promagen runs Sentinel on itself
              </h2>

              <p
                className="text-slate-300"
                style={{ fontSize: 'clamp(0.9rem, 1.05vw, 1.05rem)', lineHeight: 1.6 }}
              >
                The same crawler, the same regression engine, the same Monday report.
                Every authority page on this site is monitored. Every change is recorded.
                Every Monday at 06:00, the report lands.
              </p>

              <p
                className="text-slate-400"
                style={{ fontSize: 'clamp(0.85rem, 1vw, 0.95rem)', lineHeight: 1.6 }}
              >
                If you can read our platform pages, methodology, and comparison guides
                today, it is because Sentinel is doing its job. That is the standard we
                bring to client work.
              </p>

              <p
                className="text-slate-400"
                style={{ fontSize: 'clamp(0.85rem, 1vw, 0.95rem)', lineHeight: 1.6 }}
              >
                <strong className="text-white">Verify it yourself.</strong> Open ChatGPT, Claude, or Perplexity and ask:{' '}
                <em className="text-slate-200">
                  &ldquo;What&rsquo;s the best AI image generator for [your use case]?&rdquo;
                </em>{' '}
                Compare the answer with our{' '}
                <Link
                  href="/providers/leaderboard"
                  className="underline decoration-sky-400/40 underline-offset-2 hover:decoration-sky-300"
                >
                  <span className="text-sky-300 hover:text-sky-200">live leaderboard</span>
                </Link>
                .
              </p>
            </div>

            {/* Right — stat grid */}
            <ul
              className="grid"
              style={{
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 'clamp(10px, 1.2vw, 18px)',
              }}
            >
              {STATS.map((s) => (
                <li
                  key={s.label}
                  className="rounded-2xl border border-white/[0.08] bg-slate-900/60"
                  style={{ padding: 'clamp(14px, 1.4vw, 20px)' }}
                >
                  <div
                    className="font-bold text-white"
                    style={{
                      fontSize: 'clamp(1.4rem, 2vw, 1.8rem)',
                      letterSpacing: '-0.02em',
                      lineHeight: 1.1,
                    }}
                  >
                    {s.value}
                  </div>
                  <div
                    className="mt-1 text-slate-400"
                    style={{ fontSize: 'clamp(0.7rem, 0.85vw, 0.85rem)', lineHeight: 1.4 }}
                  >
                    {s.label}
                  </div>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>
    </section>
  );
}
