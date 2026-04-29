// src/components/layout/footer.tsx
// ============================================================================
// FOOTER (v2.0.0) — Discreet Resources + About + brand strip
// ============================================================================
// The footer is the only place on the homepage where leaderboard, platform
// intelligence and Lab links appear. It is deliberately low-prominence
// (slate-500 text, plain links, below the final CTA) so it does not compete
// with the Sentinel sales narrative above the fold, while still preserving
// internal-link equity for SEO.
//
// Authority: docs/authority/commercial-strategy.md §4
// ============================================================================

import React from 'react';
import Link from 'next/link';

type FooterLink = { label: string; href: string };

const RESOURCES: FooterLink[] = [
  { label: 'Live leaderboard', href: '/platforms' },
  { label: 'Provider rankings', href: '/providers/leaderboard' },
  { label: 'Use-case guides', href: '/guides/best-generator-for' },
  { label: 'Prompt format guide', href: '/guides/prompt-formats' },
];

const ABOUT: FooterLink[] = [
  { label: 'How we score', href: '/about/how-we-score' },
  { label: 'Sentinel', href: '/sentinel' },
  { label: 'Contact', href: 'mailto:hello@promagen.com?subject=Sentinel%20enquiry' },
];

function Column({ heading, links }: { heading: string; links: FooterLink[] }) {
  return (
    <div className="flex flex-col" style={{ gap: 'clamp(8px, 0.8vw, 12px)' }}>
      <h3
        className="font-mono uppercase tracking-wide text-slate-500"
        style={{
          fontSize: 'clamp(0.65rem, 0.75vw, 0.75rem)',
          letterSpacing: '0.1em',
        }}
      >
        {heading}
      </h3>
      <ul className="flex flex-col" style={{ gap: 'clamp(6px, 0.6vw, 8px)' }}>
        {links.map((link) => {
          const isMail = link.href.startsWith('mailto:');
          const className =
            'no-underline text-slate-400 transition-colors hover:text-white';
          const style = { fontSize: 'clamp(0.8rem, 0.9vw, 0.9rem)' };
          return (
            <li key={link.label}>
              {isMail ? (
                <a href={link.href} className={className} style={style}>
                  <span className="text-slate-400 hover:text-white">{link.label}</span>
                </a>
              ) : (
                <Link href={link.href} className={className} style={style}>
                  <span className="text-slate-400 hover:text-white">{link.label}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer
      className="w-full border-t border-white/[0.06] bg-slate-950"
      aria-label="Site footer"
    >
      <div
        className="mx-auto max-w-6xl"
        style={{ padding: 'clamp(24px, 2.6vw, 40px) clamp(20px, 3vw, 48px)' }}
      >
        <div
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'clamp(20px, 2.4vw, 36px)',
          }}
        >
          {/* Brand */}
          <div className="flex flex-col" style={{ gap: 'clamp(8px, 0.8vw, 12px)' }}>
            <span
              className="font-semibold text-white"
              style={{ fontSize: 'clamp(0.95rem, 1vw, 1.05rem)' }}
            >
              Promagen
            </span>
            <p
              className="text-slate-500"
              style={{ fontSize: 'clamp(0.78rem, 0.85vw, 0.85rem)', lineHeight: 1.55 }}
            >
              AI Visibility Intelligence and AI Platform Intelligence.
            </p>
          </div>

          <Column heading="Resources" links={RESOURCES} />
          <Column heading="About" links={ABOUT} />
        </div>

        <div
          className="mt-8 flex flex-wrap items-center justify-between border-t border-white/[0.06] pt-6 text-slate-500"
          style={{ fontSize: 'clamp(0.7rem, 0.8vw, 0.8rem)', gap: '8px' }}
        >
          <span>© {year} Promagen Ltd</span>
          <span className="text-slate-600">
            Some links to AI image platforms are affiliate links.{' '}
            <Link
              href="/about/how-we-score"
              className="text-slate-500 underline decoration-slate-700 underline-offset-2 hover:text-slate-300 hover:decoration-slate-500"
            >
              <span className="text-slate-500 hover:text-slate-300">How we score</span>
            </Link>
            .
          </span>
        </div>
      </div>
    </footer>
  );
}
