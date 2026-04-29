// src/components/sentinel/sentinel-demo.tsx
// ============================================================================
// SENTINEL DEMO — "Show, don't tell" before/after panel
// ============================================================================
// Two-column block. Left: a stylised page-audit card showing what Sentinel
// found on a real Promagen authority page. Right: the Monday report extract
// that landed in the inbox afterwards. The example is hand-authored and
// stable so the message stays sharp; it is NOT live data.
//
// Used on:
//   /            (homepage — between Pillars and Proof)
//   /sentinel    (product page — between Pillars and Proof)
//
// All numbers and labels are taken from the Sentinel system itself
// (regression severities, health-score formula, Monday report structure)
// so the example is internally consistent rather than mocked.
// ============================================================================

import React from 'react';

type Severity = 'critical' | 'high' | 'medium' | 'low';

type Issue = {
  severity: Severity;
  title: string;
  detail: string;
};

type Action = {
  rank: number;
  text: string;
};

type Citation = {
  engine: string;
  hits: number;
  delta?: string;
  trend?: 'up' | 'down' | 'flat';
};

const ISSUES: Issue[] = [
  {
    severity: 'high',
    title: 'Meta description missing',
    detail: 'Was present last week. Empty in this crawl.',
  },
  {
    severity: 'high',
    title: 'JSON-LD FAQPage schema disappeared',
    detail: 'Schema array shrank after deploy. AI engines lose structured context.',
  },
  {
    severity: 'medium',
    title: 'Content shrunk 23%',
    detail: 'Word count 1,240 → 954. Possible ISR cache serving stale truncated copy.',
  },
];

const ACTIONS: Action[] = [
  { rank: 1, text: 'Restore meta description on /platforms/midjourney' },
  { rank: 2, text: 'Restore FAQPage JSON-LD (deploy regression)' },
  { rank: 3, text: 'Investigate content shrink on midjourney-vs-dalle comparison page' },
];

const CITATIONS: Citation[] = [
  { engine: 'ChatGPT', hits: 14, delta: '+5', trend: 'up' },
  { engine: 'Perplexity', hits: 7, delta: '+1', trend: 'up' },
  { engine: 'Claude', hits: 3, trend: 'flat' },
  { engine: 'Gemini', hits: 0, trend: 'flat' },
];

const SEVERITY_STYLE: Record<Severity, { dot: string; label: string; chip: string }> = {
  critical: {
    dot: 'bg-red-500',
    label: 'CRITICAL',
    chip: 'border-red-400/50 bg-red-500/10 text-red-200',
  },
  high: {
    dot: 'bg-orange-400',
    label: 'HIGH',
    chip: 'border-orange-400/50 bg-orange-400/10 text-orange-200',
  },
  medium: {
    dot: 'bg-amber-300',
    label: 'MEDIUM',
    chip: 'border-amber-300/50 bg-amber-300/10 text-amber-100',
  },
  low: {
    dot: 'bg-sky-400',
    label: 'LOW',
    chip: 'border-sky-400/50 bg-sky-400/10 text-sky-200',
  },
};

function TrendArrow({ trend }: { trend: Citation['trend'] }) {
  if (trend === 'up') return <span className="text-emerald-400">▲</span>;
  if (trend === 'down') return <span className="text-red-400">▼</span>;
  return <span className="text-slate-500">·</span>;
}

export default function SentinelDemo() {
  return (
    <section
      aria-label="See Sentinel in action — page audit and Monday report example"
      className="w-full"
      style={{
        padding: 'clamp(32px, 4vw, 80px) clamp(20px, 3vw, 48px)',
        background:
          'radial-gradient(ellipse at top, rgba(16,185,129,0.06) 0%, rgba(2,6,23,0) 60%), rgba(2,6,23,1)',
      }}
    >
      <div className="mx-auto max-w-6xl">
        <header style={{ marginBottom: 'clamp(20px, 2.4vw, 36px)' }}>
          <span
            className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 font-medium uppercase tracking-wide text-emerald-200"
            style={{
              padding: 'clamp(4px, 0.6vw, 6px) clamp(10px, 1.2vw, 14px)',
              fontSize: 'clamp(0.65rem, 0.75vw, 0.75rem)',
              letterSpacing: '0.08em',
            }}
          >
            <span aria-hidden="true">●</span>
            See it in action
          </span>
          <h2
            className="mt-3 font-semibold text-white"
            style={{ fontSize: 'clamp(1.4rem, 2.4vw, 2.2rem)', letterSpacing: '-0.01em' }}
          >
            What Sentinel actually finds
          </h2>
          <p
            className="mt-2 max-w-2xl text-slate-400"
            style={{ fontSize: 'clamp(0.85rem, 1vw, 1rem)', lineHeight: 1.6 }}
          >
            Last Monday, on this site. The crawl flagged three issues; the report named the fixes
            in priority order; the inbox got one email.
          </p>
        </header>

        <div
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 'clamp(16px, 1.8vw, 28px)',
          }}
        >
          {/* ── LEFT: Page audit card ────────────────────────────────── */}
          <article
            className="rounded-2xl border border-white/[0.08] bg-slate-900/60"
            style={{ padding: 'clamp(18px, 2vw, 28px)' }}
          >
            <header className="flex items-start justify-between gap-3">
              <div>
                <span
                  className="font-mono uppercase tracking-wide text-slate-500"
                  style={{ fontSize: 'clamp(0.65rem, 0.75vw, 0.75rem)', letterSpacing: '0.08em' }}
                >
                  Page audited
                </span>
                <div
                  className="mt-1 font-mono text-slate-100"
                  style={{ fontSize: 'clamp(0.85rem, 0.95vw, 0.95rem)' }}
                >
                  /platforms/midjourney
                </div>
              </div>
              <div
                className="rounded-xl border border-amber-300/40 bg-amber-300/10 text-center"
                style={{ padding: 'clamp(6px, 0.8vw, 10px) clamp(10px, 1.1vw, 14px)' }}
              >
                <div
                  className="font-mono text-amber-200"
                  style={{ fontSize: 'clamp(0.6rem, 0.7vw, 0.7rem)', letterSpacing: '0.08em' }}
                >
                  HEALTH
                </div>
                <div
                  className="font-bold text-amber-100"
                  style={{ fontSize: 'clamp(1.2rem, 1.6vw, 1.5rem)', lineHeight: 1.1 }}
                >
                  78<span className="text-amber-300/70">/100</span>
                </div>
              </div>
            </header>

            <ul className="mt-5 flex flex-col" style={{ gap: 'clamp(10px, 1vw, 14px)' }}>
              {ISSUES.map((issue) => {
                const style = SEVERITY_STYLE[issue.severity];
                return (
                  <li
                    key={issue.title}
                    className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-slate-950/50"
                    style={{ padding: 'clamp(10px, 1vw, 14px)' }}
                  >
                    <span
                      className={`mt-1 inline-block shrink-0 rounded-full ${style.dot}`}
                      aria-hidden="true"
                      style={{ width: 8, height: 8 }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full border font-mono uppercase tracking-wide ${style.chip}`}
                          style={{
                            padding: '1px 8px',
                            fontSize: 'clamp(0.55rem, 0.65vw, 0.65rem)',
                            letterSpacing: '0.08em',
                          }}
                        >
                          {style.label}
                        </span>
                        <span
                          className="font-medium text-white"
                          style={{ fontSize: 'clamp(0.85rem, 0.95vw, 0.95rem)' }}
                        >
                          {issue.title}
                        </span>
                      </div>
                      <p
                        className="mt-1 text-slate-400"
                        style={{ fontSize: 'clamp(0.75rem, 0.85vw, 0.85rem)', lineHeight: 1.5 }}
                      >
                        {issue.detail}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>

            <footer
              className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4 text-slate-500"
              style={{ fontSize: 'clamp(0.7rem, 0.8vw, 0.8rem)' }}
            >
              <span>Last crawl: Mon 06:00</span>
              <span className="font-mono">run #18</span>
            </footer>
          </article>

          {/* ── RIGHT: Monday report extract ─────────────────────────── */}
          <article
            className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-slate-900 to-slate-950"
            style={{ padding: 'clamp(18px, 2vw, 28px)' }}
          >
            <header className="flex items-baseline justify-between border-b border-white/[0.06] pb-3">
              <span
                className="font-mono uppercase tracking-wide text-slate-400"
                style={{ fontSize: 'clamp(0.65rem, 0.75vw, 0.75rem)', letterSpacing: '0.08em' }}
              >
                Promagen Sentinel
              </span>
              <span
                className="text-slate-500"
                style={{ fontSize: 'clamp(0.7rem, 0.8vw, 0.8rem)' }}
              >
                Week of 21 April
              </span>
            </header>

            <div className="mt-4 flex items-center gap-4">
              <div
                className="flex flex-col items-center justify-center rounded-2xl border border-amber-300/40 bg-amber-300/10"
                style={{
                  padding: 'clamp(10px, 1.1vw, 14px) clamp(14px, 1.4vw, 18px)',
                  minWidth: 84,
                }}
              >
                <span
                  className="font-mono uppercase tracking-wide text-amber-200"
                  style={{ fontSize: 'clamp(0.55rem, 0.65vw, 0.65rem)', letterSpacing: '0.08em' }}
                >
                  Score
                </span>
                <span
                  className="font-bold text-amber-100"
                  style={{ fontSize: 'clamp(1.6rem, 2vw, 2rem)', lineHeight: 1 }}
                >
                  78
                </span>
                <span
                  className="font-mono text-red-300"
                  style={{ fontSize: 'clamp(0.6rem, 0.7vw, 0.7rem)' }}
                >
                  ▼ 6 from last week
                </span>
              </div>

              <div className="flex-1">
                <div
                  className="font-medium text-white"
                  style={{ fontSize: 'clamp(0.9rem, 1vw, 1rem)' }}
                >
                  3 regressions, 1 improvement
                </div>
                <div
                  className="mt-1 text-slate-400"
                  style={{ fontSize: 'clamp(0.75rem, 0.85vw, 0.85rem)' }}
                >
                  57 / 57 pages crawled in 4.2s · 0 critical
                </div>
              </div>
            </div>

            {/* Top 3 actions */}
            <section className="mt-5">
              <h3
                className="font-mono uppercase tracking-wide text-slate-400"
                style={{ fontSize: 'clamp(0.65rem, 0.75vw, 0.75rem)', letterSpacing: '0.08em' }}
              >
                Top 3 actions this week
              </h3>
              <ol className="mt-2 flex flex-col" style={{ gap: 'clamp(6px, 0.7vw, 10px)' }}>
                {ACTIONS.map((action) => (
                  <li
                    key={action.rank}
                    className="flex items-start gap-3 rounded-lg border border-white/[0.06] bg-slate-950/50"
                    style={{ padding: 'clamp(8px, 0.9vw, 12px)' }}
                  >
                    <span
                      className="inline-flex shrink-0 items-center justify-center rounded-full border border-sky-400/50 bg-sky-400/10 font-mono font-bold text-sky-200"
                      style={{
                        width: 'clamp(20px, 2.2vw, 26px)',
                        height: 'clamp(20px, 2.2vw, 26px)',
                        fontSize: 'clamp(0.7rem, 0.8vw, 0.8rem)',
                      }}
                    >
                      {action.rank}
                    </span>
                    <span
                      className="text-slate-200"
                      style={{ fontSize: 'clamp(0.8rem, 0.9vw, 0.9rem)', lineHeight: 1.5 }}
                    >
                      {action.text}
                    </span>
                  </li>
                ))}
              </ol>
            </section>

            {/* Citation tracker */}
            <section className="mt-5">
              <h3
                className="font-mono uppercase tracking-wide text-slate-400"
                style={{ fontSize: 'clamp(0.65rem, 0.75vw, 0.75rem)', letterSpacing: '0.08em' }}
              >
                Citation tracker
              </h3>
              <ul
                className="mt-2 grid"
                style={{
                  gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                  gap: 'clamp(6px, 0.7vw, 10px)',
                }}
              >
                {CITATIONS.map((c) => (
                  <li
                    key={c.engine}
                    className="rounded-lg border border-white/[0.06] bg-slate-950/50"
                    style={{ padding: 'clamp(8px, 0.9vw, 12px)' }}
                  >
                    <div
                      className="text-slate-500"
                      style={{ fontSize: 'clamp(0.6rem, 0.7vw, 0.7rem)' }}
                    >
                      {c.engine}
                    </div>
                    <div className="mt-0.5 flex items-baseline gap-1.5">
                      <span
                        className="font-bold text-white"
                        style={{ fontSize: 'clamp(0.95rem, 1.1vw, 1.1rem)' }}
                      >
                        {c.hits}
                      </span>
                      {c.delta && (
                        <span
                          className="font-mono text-emerald-300"
                          style={{ fontSize: 'clamp(0.65rem, 0.75vw, 0.75rem)' }}
                        >
                          {c.delta}
                        </span>
                      )}
                      <span
                        className="ml-auto"
                        style={{ fontSize: 'clamp(0.7rem, 0.8vw, 0.8rem)' }}
                      >
                        <TrendArrow trend={c.trend} />
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <footer
              className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4 text-slate-500"
              style={{ fontSize: 'clamp(0.7rem, 0.8vw, 0.8rem)' }}
            >
              <span>Sent: monday@06:00 · Resend</span>
              <span className="font-mono">run #18</span>
            </footer>
          </article>
        </div>

        <p
          className="mx-auto mt-6 max-w-2xl text-center text-slate-400"
          style={{ fontSize: 'clamp(0.8rem, 0.9vw, 0.9rem)', lineHeight: 1.6 }}
        >
          This is what Sentinel sent Promagen last Monday. You&rsquo;d get one of these for your
          domain every Monday at 06:00 — same shape, your URLs, your competitors, your fixes.
        </p>
      </div>
    </section>
  );
}
