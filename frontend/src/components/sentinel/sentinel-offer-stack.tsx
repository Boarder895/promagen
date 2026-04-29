// src/components/sentinel/sentinel-offer-stack.tsx
// ============================================================================
// SENTINEL OFFER STACK — Snapshot / Audit / Fix Sprint / Monitor
// ============================================================================
// Commercial offer presentation. Prices and packages mirror the deep-research
// recommendation and sentinel.md "Initial packages" line.
//
// Note: Pricing is presented as service pricing, not a paid_tier.md product.
// `paid_tier.md` governs the in-app Pro Promagen subscription. Sentinel
// audits/monitors are a separate B2B service offering and so do not change
// the consumer paid-tier matrix.
//
// Authority: docs/authority/commercial-positioning.md, docs/authority/sentinel.md §5
// ============================================================================

import React from 'react';
import Link from 'next/link';

type Tier = {
  name: string;
  price: string;
  cadence: string;
  pitch: string;
  bullets: string[];
  highlighted?: boolean;
  cta: { label: string; href: string };
};

const TIERS: Tier[] = [
  {
    name: 'Snapshot',
    price: '£495',
    cadence: 'one-off',
    pitch: 'A first read on how AI systems see your domain.',
    bullets: [
      'Full crawl of priority pages',
      'Metadata, schema, canonical & link-graph health',
      'Citation check across 4 AI platforms',
      'Top fixes ranked by ROI',
    ],
    cta: { label: 'Start with a Snapshot', href: '/sentinel#contact' },
  },
  {
    name: 'Full Audit',
    price: '£1,950',
    cadence: 'one-off',
    pitch: 'The complete picture, with a 30-minute walkthrough.',
    bullets: [
      'Snapshot, deeper crawl, broader page coverage',
      'Competitor visibility comparison',
      'Citation scorecard + velocity baseline',
      'Page-level fix list + 30-min call',
    ],
    highlighted: true,
    cta: { label: 'Book a Full Audit', href: '/sentinel#contact' },
  },
  {
    name: 'Fix Sprint',
    price: '£3,500',
    cadence: 'one-off',
    pitch: 'We ship the top fixes. You see the regressions disappear.',
    bullets: [
      'Everything in Full Audit',
      'Up to 10 high-ROI fixes implemented',
      'Re-crawl + before/after evidence',
      'Hand-off notes for the team',
    ],
    cta: { label: 'Plan a Fix Sprint', href: '/sentinel#contact' },
  },
  {
    name: 'Monitor',
    price: '£349',
    cadence: 'per month',
    pitch: 'Weekly Sentinel report on your domain. Cancel anytime.',
    bullets: [
      'Weekly crawl + Monday report',
      'AI citation tracking (4 platforms)',
      'Tripwire alerts for critical regressions',
      'Quarterly review call',
    ],
    cta: { label: 'Start monitoring', href: '/sentinel#contact' },
  },
];

export default function SentinelOfferStack() {
  return (
    <section
      id="sentinel-offer"
      aria-label="Sentinel packages and pricing"
      className="w-full"
      style={{
        padding: 'clamp(32px, 4vw, 80px) clamp(20px, 3vw, 48px)',
        background: 'linear-gradient(180deg, rgba(2,6,23,1) 0%, rgba(15,23,42,1) 100%)',
      }}
    >
      <div className="mx-auto max-w-6xl">
        <header style={{ marginBottom: 'clamp(24px, 2.6vw, 40px)' }}>
          <h2
            className="font-semibold text-white"
            style={{ fontSize: 'clamp(1.4rem, 2.4vw, 2.2rem)', letterSpacing: '-0.01em' }}
          >
            Four ways to start
          </h2>
          <p
            className="mt-2 max-w-2xl text-slate-400"
            style={{ fontSize: 'clamp(0.85rem, 1vw, 1rem)', lineHeight: 1.6 }}
          >
            Service-led delivery. Founder-attended audits. Productised pricing — no quote
            roulette, no enterprise demo gauntlet.
          </p>
        </header>

        <ul
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 'clamp(12px, 1.2vw, 18px)',
          }}
        >
          {TIERS.map((tier) => (
            <li
              key={tier.name}
              className={`relative flex flex-col rounded-2xl border text-slate-200 ${
                tier.highlighted
                  ? 'border-sky-400/60 bg-slate-900/80 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]'
                  : 'border-white/[0.08] bg-slate-900/50'
              }`}
              style={{
                padding: 'clamp(18px, 1.8vw, 28px)',
                gap: 'clamp(10px, 1vw, 14px)',
              }}
            >
              {tier.highlighted && (
                <span
                  className="absolute right-4 top-4 rounded-full border border-sky-400/40 bg-sky-400/10 font-medium uppercase tracking-wide text-sky-200"
                  style={{
                    padding: '2px 8px',
                    fontSize: 'clamp(0.6rem, 0.7vw, 0.7rem)',
                    letterSpacing: '0.08em',
                  }}
                >
                  Most popular
                </span>
              )}

              <h3
                className="font-semibold text-white"
                style={{ fontSize: 'clamp(1.1rem, 1.3vw, 1.35rem)' }}
              >
                {tier.name}
              </h3>

              <div className="flex items-baseline gap-2">
                <span
                  className="font-bold text-white"
                  style={{ fontSize: 'clamp(1.6rem, 2.2vw, 2.1rem)', letterSpacing: '-0.02em' }}
                >
                  {tier.price}
                </span>
                <span className="text-slate-400" style={{ fontSize: 'clamp(0.75rem, 0.85vw, 0.9rem)' }}>
                  {tier.cadence}
                </span>
              </div>

              <p
                className="text-slate-300"
                style={{ fontSize: 'clamp(0.85rem, 0.95vw, 0.95rem)', lineHeight: 1.5 }}
              >
                {tier.pitch}
              </p>

              <ul
                className="mt-1 flex flex-col text-slate-300"
                style={{ gap: 'clamp(6px, 0.7vw, 10px)', fontSize: 'clamp(0.8rem, 0.9vw, 0.9rem)' }}
              >
                {tier.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0 text-emerald-400" aria-hidden="true">✓</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-4">
                <Link
                  href={tier.cta.href}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-full border font-medium no-underline shadow-sm transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 ${
                    tier.highlighted
                      ? 'border-sky-400/60 bg-gradient-to-r from-sky-400/40 via-emerald-300/40 to-indigo-400/40 text-white hover:border-sky-300 hover:from-sky-400/55 hover:via-emerald-300/55 hover:to-indigo-400/55 focus-visible:ring-sky-400/80'
                      : 'border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-purple-100 hover:border-purple-400 hover:from-purple-600/30 hover:to-pink-600/30 focus-visible:ring-purple-400/70'
                  }`}
                  style={{
                    padding: 'clamp(10px, 1vw, 14px) clamp(14px, 1.4vw, 20px)',
                    fontSize: 'clamp(0.85rem, 0.95vw, 0.95rem)',
                  }}
                >
                  <span className={tier.highlighted ? 'text-white' : 'text-purple-100'}>
                    {tier.cta.label}
                  </span>
                </Link>
              </div>
            </li>
          ))}
        </ul>

        <p
          className="mt-6 text-center text-slate-500"
          style={{ fontSize: 'clamp(0.75rem, 0.85vw, 0.85rem)' }}
        >
          Founding cohort pricing. Scope and cadence agreed in writing before delivery.
        </p>
      </div>
    </section>
  );
}
