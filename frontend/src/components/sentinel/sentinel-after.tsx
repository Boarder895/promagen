// src/components/sentinel/sentinel-after.tsx
// ============================================================================
// SENTINEL AFTER — what happens after you commit
// ============================================================================
// Final reassurance section before the CTA. Four time-ordered steps from
// intake to ongoing report, plus a refund commitment and case-study opt-in
// in the closing paragraph. De-risks the buy.
//
// Authority: docs/authority/commercial-strategy.md §2.3,
// .claude/skills/sentinel-readiness/SKILL.md §6 (Onboard gate).
// ============================================================================

import React from 'react';

type Step = {
  day: string;
  title: string;
  body: string;
  accent: string;
};

const STEPS: Step[] = [
  {
    day: 'Day 0',
    title: 'Intake',
    body: 'You complete the intake doc — the four signals from "What we need to start", plus geographic focus and a stakeholder contact. Google Doc; under thirty minutes.',
    accent: 'border-sky-400/40 bg-sky-400/[0.04]',
  },
  {
    day: 'Day 1',
    title: 'Kickoff',
    body: 'We acknowledge, schedule the first crawl, and confirm the priority queries and pages. Any clarifications happen here, before the audit runs.',
    accent: 'border-emerald-400/40 bg-emerald-400/[0.04]',
  },
  {
    day: 'Day 5–20',
    title: 'First deliverable',
    body: 'Snapshot lands within five working days. Audit within ten. Fix Sprint within twenty (ten-day audit, ten-day implementation). Audit and Fix Sprint include a handoff call.',
    accent: 'border-indigo-400/40 bg-indigo-400/[0.04]',
  },
  {
    day: 'Day 7+',
    title: 'Monitor (recurring)',
    body: 'For Monitor subscriptions, the first Monday report lands within seven days of activation. Then every Monday at 06:00, every week — until you cancel.',
    accent: 'border-purple-400/40 bg-purple-400/[0.04]',
  },
];

export default function SentinelAfter() {
  return (
    <section
      aria-label="What happens after you commit"
      className="w-full bg-slate-950"
      style={{ padding: 'clamp(32px, 4vw, 64px) clamp(20px, 3vw, 48px)' }}
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
            What happens next
          </span>
          <h2
            className="mt-3 font-semibold text-white"
            style={{ fontSize: 'clamp(1.4rem, 2.4vw, 2.2rem)', letterSpacing: '-0.01em' }}
          >
            After you commit
          </h2>
          <p
            className="mt-2 max-w-2xl text-slate-400"
            style={{ fontSize: 'clamp(0.85rem, 1vw, 1rem)', lineHeight: 1.6 }}
          >
            No black box between purchase and delivery. The cadence below is the same one Promagen runs against itself, every week.
          </p>
        </header>

        <ol
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 'clamp(12px, 1.4vw, 20px)',
          }}
        >
          {STEPS.map((s) => (
            <li
              key={s.day}
              className={`flex flex-col rounded-2xl border ${s.accent} text-slate-200`}
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
                {s.day}
              </span>
              <h3
                className="font-semibold text-white"
                style={{ fontSize: 'clamp(1.1rem, 1.4vw, 1.4rem)' }}
              >
                {s.title}
              </h3>
              <p
                className="text-slate-300"
                style={{
                  fontSize: 'clamp(0.85rem, 0.95vw, 0.95rem)',
                  lineHeight: 1.55,
                }}
              >
                {s.body}
              </p>
            </li>
          ))}
        </ol>

        <p
          className="mx-auto mt-6 max-w-2xl text-center text-slate-400"
          style={{ fontSize: 'clamp(0.8rem, 0.9vw, 0.9rem)', lineHeight: 1.6 }}
        >
          If a delivery slips against the cadence above, we cancel the charge — no questions. At thirty days we&rsquo;ll ask whether you&rsquo;re willing to be a public case study; saying no does not affect anything you receive.
        </p>
      </div>
    </section>
  );
}
