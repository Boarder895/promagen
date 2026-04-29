// src/components/sentinel/sentinel-cta.tsx
// ============================================================================
// SENTINEL CTA STRIP — Final commercial CTA on /sentinel and homepage
// ============================================================================
// Single conversion target: get the buyer to start a conversation. Uses a
// mailto: link by default — the simplest reliable channel before a booking
// flow exists. The href is a prop so a future booking page (Cal.com / form)
// can drop in without touching component internals.
//
// Authority: docs/authority/commercial-positioning.md
// Buttons: docs/authority/buttons.md §2.1, §5
// ============================================================================

import React from 'react';
import Link from 'next/link';

export interface SentinelCtaProps {
  /** Where the primary CTA goes. Defaults to mailto: until a booking page exists. */
  contactHref?: string;
  /** Optional anchor id so the button on Sentinel offer cards can deep-link here. */
  id?: string;
}

export default function SentinelCta({
  contactHref = 'mailto:hello@promagen.com?subject=Sentinel%20enquiry',
  id = 'contact',
}: SentinelCtaProps) {
  return (
    <section
      id={id}
      aria-label="Start a Sentinel conversation"
      className="w-full"
      style={{
        padding: 'clamp(40px, 5vw, 96px) clamp(20px, 3vw, 48px)',
        background:
          'radial-gradient(ellipse at center, rgba(56,189,248,0.08) 0%, rgba(2,6,23,0) 70%), rgba(2,6,23,1)',
      }}
    >
      <div className="mx-auto flex max-w-4xl flex-col items-center text-center" style={{ gap: 'clamp(16px, 1.8vw, 24px)' }}>
        <h2
          className="font-semibold text-white"
          style={{
            fontSize: 'clamp(1.6rem, 3vw, 2.6rem)',
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
          }}
        >
          Ready to see how AI engines see your site?
        </h2>

        <p
          className="max-w-2xl text-slate-300"
          style={{ fontSize: 'clamp(0.95rem, 1.15vw, 1.15rem)', lineHeight: 1.6 }}
        >
          Tell us your domain and your top three competitors. We&rsquo;ll come back with what
          a Sentinel Snapshot would cover for you, and how soon we can deliver it.
        </p>

        <div className="flex flex-wrap items-center justify-center" style={{ gap: 'clamp(10px, 1vw, 16px)' }}>
          <a
            href={contactHref}
            className="group inline-flex items-center gap-2 rounded-2xl border border-sky-400/60 bg-gradient-to-r from-sky-400/40 via-emerald-300/40 to-indigo-400/40 font-semibold text-white no-underline shadow-sm transition-all hover:border-sky-300 hover:from-sky-400/55 hover:via-emerald-300/55 hover:to-indigo-400/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/80 cursor-pointer"
            style={{
              padding: 'clamp(14px, 1.3vw, 18px) clamp(22px, 2.2vw, 32px)',
              fontSize: 'clamp(0.95rem, 1.05vw, 1.1rem)',
            }}
          >
            <span aria-hidden="true" className="text-white">✦</span>
            <span className="text-white">Start a Sentinel conversation</span>
          </a>

          <Link
            href="/platforms"
            className="inline-flex items-center gap-2 rounded-full border border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 font-medium no-underline shadow-sm transition-all hover:border-purple-400 hover:from-purple-600/30 hover:to-pink-600/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70 cursor-pointer"
            style={{
              padding: 'clamp(12px, 1.2vw, 16px) clamp(18px, 1.8vw, 26px)',
              fontSize: 'clamp(0.85rem, 0.95vw, 1rem)',
            }}
          >
            <span className="text-purple-100">Or browse platform intelligence first</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
