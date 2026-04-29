// src/components/nav/top-nav.tsx
// ============================================================================
// TOP NAV (v3.0.0)
// ============================================================================
// v3.0.0 (current — strict commercial-strategy.md):
// - Three items only: Sentinel | About | Contact.
// - No Platforms, no Lab, no Inspire, no My Prompts in the top-nav.
//   Those surfaces remain reachable via direct URL, the homepage Proof
//   block, and the footer Resources section.
//
// v2.0.0:
// - Added Sentinel as lead nav item.
// - Added Platforms, kept Lab + My Prompts (later removed in v3.0.0).
//
// Authority: docs/authority/commercial-strategy.md §4
// Buttons:   docs/authority/buttons.md (all <a> tags need explicit child
//            colours — see span text-* below).
// ============================================================================

'use client';

import Link from 'next/link';
import { trackNavClick } from '@/lib/analytics/events';

export default function TopNav() {
  return (
    <nav className="sticky top-0 z-40 w-full border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold no-underline">
          <span className="text-zinc-100">Promagen</span>
        </Link>

        <div className="flex items-center gap-3 text-sm">
          {/* Sentinel — primary commercial CTA */}
          <Link
            href="/sentinel"
            onClick={() => trackNavClick({ label: 'Sentinel', href: '/sentinel' })}
            className="inline-flex items-center gap-2 rounded-xl border border-sky-400/50 bg-gradient-to-r from-sky-400/15 via-emerald-300/10 to-indigo-400/15 px-3 py-1.5 no-underline shadow-sm transition-all hover:border-sky-300 hover:from-sky-400/25 hover:via-emerald-300/20 hover:to-indigo-400/25 cursor-pointer"
            title="Sentinel — AI Visibility Intelligence"
          >
            <span aria-hidden="true" className="text-sky-200">✦</span>
            <span className="font-semibold text-sky-100">Sentinel</span>
          </Link>

          {/* About — methodology */}
          <Link
            href="/about/how-we-score"
            onClick={() => trackNavClick({ label: 'About', href: '/about/how-we-score' })}
            className="inline-flex items-center rounded-xl border border-zinc-700 px-3 py-1.5 no-underline transition-colors hover:border-zinc-600 hover:bg-zinc-800 cursor-pointer"
            title="How we score — methodology"
          >
            <span className="text-zinc-200">About</span>
          </Link>

          {/* Contact — deep link to Sentinel CTA block */}
          <Link
            href="/sentinel#contact"
            onClick={() => trackNavClick({ label: 'Contact', href: '/sentinel#contact' })}
            className="inline-flex items-center rounded-xl border border-zinc-700 px-3 py-1.5 no-underline transition-colors hover:border-zinc-600 hover:bg-zinc-800 cursor-pointer"
            title="Start a Sentinel conversation"
          >
            <span className="text-zinc-200">Contact</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
