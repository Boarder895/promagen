// src/components/sentinel/sentinel-why.tsx
// ============================================================================
// SENTINEL WHY — urgency / cost-of-inaction block
// ============================================================================
// The hook that earns the right to talk about pillars and pricing. Three short
// claims, no stats Promagen cannot substantiate. Sky/rose/amber palette
// matches "evidence / loss / signal" semantics.
//
// Authority: docs/authority/commercial-strategy.md §8 (selling story)
// ============================================================================

import React from 'react';

type Claim = {
  number: string;
  title: string;
  body: string;
  accent: string;
};

const CLAIMS: Claim[] = [
  {
    number: '01',
    title: 'Buyers research in chat now',
    body: 'Search is no longer the only step before a buying decision. Buyers ask ChatGPT, Claude, Perplexity, and Gemini directly — and increasingly act on the answer they get.',
    accent: 'border-sky-400/40 bg-sky-400/[0.04]',
  },
  {
    number: '02',
    title: 'AI engines cite sites by name',
    body: "Each answer cites three to five sources. Either yours is one of them or your competitor's is. There is no second page of results to fall back on.",
    accent: 'border-rose-400/40 bg-rose-400/[0.04]',
  },
  {
    number: '03',
    title: 'Invisibility is silent',
    body: "You don't get notified when a competitor is named and you aren't. The lost lead never reaches your analytics. Sentinel is the notification.",
    accent: 'border-amber-400/40 bg-amber-400/[0.04]',
  },
];

export default function SentinelWhy() {
  return (
    <section
      aria-label="Why AI visibility matters now"
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
            Why this matters now
          </h2>
          <p
            className="mt-2 max-w-2xl text-slate-400"
            style={{ fontSize: 'clamp(0.85rem, 1vw, 1rem)', lineHeight: 1.6 }}
          >
            Not 2027 visibility. Already happening. The question isn&rsquo;t whether AI engines will start citing sites — they do. The question is whether they cite yours.
          </p>
        </header>

        <ul
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 'clamp(12px, 1.4vw, 20px)',
          }}
        >
          {CLAIMS.map((c) => (
            <li
              key={c.number}
              className={`flex flex-col rounded-2xl border ${c.accent} text-slate-200`}
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
                {c.number}
              </span>
              <h3
                className="font-semibold text-white"
                style={{ fontSize: 'clamp(1.1rem, 1.4vw, 1.4rem)' }}
              >
                {c.title}
              </h3>
              <p
                className="text-slate-300"
                style={{
                  fontSize: 'clamp(0.85rem, 0.95vw, 0.95rem)',
                  lineHeight: 1.55,
                }}
              >
                {c.body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
