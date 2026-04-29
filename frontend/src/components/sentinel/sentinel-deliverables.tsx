// src/components/sentinel/sentinel-deliverables.tsx
// ============================================================================
// SENTINEL DELIVERABLES — What the buyer actually gets
// ============================================================================
// Used on /sentinel between the offer stack and the CTA. Removes ambiguity
// about what arrives in the buyer's inbox after they pay.
//
// Authority: docs/authority/sentinel.md §3.9 (Monday Report), §9 (Citation Cockpit)
// ============================================================================

import React from 'react';

type Item = {
  title: string;
  body: string;
};

const SNAPSHOT: Item[] = [
  { title: 'Health score', body: 'Composite 0–100 across availability, metadata, schema, regression burden and link-graph health.' },
  { title: 'Page-level findings', body: 'Each priority page audited for title, meta description, canonical, schema and content health.' },
  { title: 'Citation read', body: 'A baseline check across ChatGPT, Claude, Perplexity and Gemini for your priority queries.' },
  { title: 'Top fixes', body: 'Three to five fixes ranked by ROI, with the exact pages and the exact change to make.' },
];

const MONITOR: Item[] = [
  { title: 'Monday report (weekly)', body: 'Health score delta, regressions, improvements, top three actions for the week.' },
  { title: 'Tripwire alerts', body: 'Immediate email if a priority page goes 4xx/5xx — no waiting for Monday.' },
  { title: 'Citation tracking', body: 'Rolling scorecard across four AI engines. Trend arrows. Velocity per query.' },
  { title: 'Quarterly review', body: '30-minute call every quarter to review trajectory and re-prioritise.' },
];

function Column({ heading, items }: { heading: string; items: Item[] }) {
  return (
    <div className="flex flex-col" style={{ gap: 'clamp(12px, 1.2vw, 18px)' }}>
      <h3
        className="font-semibold text-white"
        style={{ fontSize: 'clamp(1.1rem, 1.4vw, 1.4rem)' }}
      >
        {heading}
      </h3>
      <ul className="flex flex-col" style={{ gap: 'clamp(10px, 1vw, 14px)' }}>
        {items.map((item) => (
          <li
            key={item.title}
            className="rounded-2xl border border-white/[0.08] bg-slate-900/50"
            style={{ padding: 'clamp(14px, 1.4vw, 20px)' }}
          >
            <div
              className="font-medium text-white"
              style={{ fontSize: 'clamp(0.9rem, 1vw, 1rem)' }}
            >
              {item.title}
            </div>
            <p
              className="mt-1 text-slate-300"
              style={{ fontSize: 'clamp(0.8rem, 0.9vw, 0.9rem)', lineHeight: 1.55 }}
            >
              {item.body}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SentinelDeliverables() {
  return (
    <section
      aria-label="Sentinel deliverables"
      className="w-full bg-slate-950"
      style={{ padding: 'clamp(32px, 4vw, 80px) clamp(20px, 3vw, 48px)' }}
    >
      <div className="mx-auto max-w-6xl">
        <header style={{ marginBottom: 'clamp(20px, 2.4vw, 36px)' }}>
          <h2
            className="font-semibold text-white"
            style={{ fontSize: 'clamp(1.4rem, 2.4vw, 2.2rem)', letterSpacing: '-0.01em' }}
          >
            What you actually receive
          </h2>
          <p
            className="mt-2 max-w-2xl text-slate-400"
            style={{ fontSize: 'clamp(0.85rem, 1vw, 1rem)', lineHeight: 1.6 }}
          >
            Plain English. Specific URLs. Specific fixes. No dashboard archaeology.
          </p>
        </header>

        <div
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'clamp(20px, 2vw, 32px)',
          }}
        >
          <Column heading="Snapshot & Audit deliverables" items={SNAPSHOT} />
          <Column heading="Monitor (recurring)" items={MONITOR} />
        </div>
      </div>
    </section>
  );
}
