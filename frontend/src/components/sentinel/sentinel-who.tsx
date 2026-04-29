// src/components/sentinel/sentinel-who.tsx
// ============================================================================
// SENTINEL WHO — qualification block
// ============================================================================
// First content section after the hero. Lets the right buyer self-identify in
// 30s and lets the wrong buyer click away without burning sales time. The
// two-column "for you if / not for you yet if" structure pre-qualifies on
// three signals the intake form will ask for anyway: public content,
// research-led buyers, stated priorities.
//
// id="how-sentinel-works" so the hero primary CTA ("How Sentinel works")
// scrolls here.
//
// Authority: docs/authority/commercial-strategy.md §2.5
// ============================================================================

import React from 'react';

const FOR_YOU_IF: string[] = [
  'You run a public site with indexable content — product pages, methodology, comparison guides, service descriptions.',
  'Your buyers research before they buy, and they increasingly do that in ChatGPT, Claude, Perplexity, or Gemini.',
  'You can name three competitors and eight to twelve priority queries — the questions buyers actually ask.',
];

const NOT_YET_IF: string[] = [
  'You are pre-launch with no public content for AI engines to find.',
  'Your buyers do not research online — local trades, walk-in sales, word-of-mouth referrals.',
  "You have not decided what you want to be known for. Sentinel measures visibility against stated priorities; without the priorities there is nothing to measure.",
];

export default function SentinelWho() {
  return (
    <section
      id="how-sentinel-works"
      aria-label="Who Sentinel is for"
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
            Who Sentinel is for
          </h2>
          <p
            className="mt-2 max-w-2xl text-slate-400"
            style={{ fontSize: 'clamp(0.85rem, 1vw, 1rem)', lineHeight: 1.6 }}
          >
            Operators who care whether AI engines mention their site by name. SaaS founders, e-commerce leads, SEO owners, CMOs at B2B services where the buyer&rsquo;s research now happens inside a model, not a SERP.
          </p>
        </header>

        <div
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'clamp(16px, 1.8vw, 28px)',
          }}
        >
          {/* For you if */}
          <div
            className="rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.04]"
            style={{ padding: 'clamp(20px, 2vw, 32px)' }}
          >
            <h3
              className="font-semibold text-emerald-200"
              style={{ fontSize: 'clamp(1rem, 1.2vw, 1.2rem)' }}
            >
              For you if
            </h3>
            <ul
              className="mt-3 flex flex-col"
              style={{
                gap: 'clamp(10px, 1vw, 14px)',
                fontSize: 'clamp(0.85rem, 0.95vw, 0.95rem)',
                lineHeight: 1.55,
              }}
            >
              {FOR_YOU_IF.map((line, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden="true" className="text-emerald-400">
                    ✓
                  </span>
                  <span className="text-slate-300">{line}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Not for you yet if */}
          <div
            className="rounded-2xl border border-slate-700 bg-slate-900/40"
            style={{ padding: 'clamp(20px, 2vw, 32px)' }}
          >
            <h3
              className="font-semibold text-slate-300"
              style={{ fontSize: 'clamp(1rem, 1.2vw, 1.2rem)' }}
            >
              Not for you yet if
            </h3>
            <ul
              className="mt-3 flex flex-col"
              style={{
                gap: 'clamp(10px, 1vw, 14px)',
                fontSize: 'clamp(0.85rem, 0.95vw, 0.95rem)',
                lineHeight: 1.55,
              }}
            >
              {NOT_YET_IF.map((line, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden="true" className="text-slate-500">
                    ·
                  </span>
                  <span className="text-slate-400">{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
