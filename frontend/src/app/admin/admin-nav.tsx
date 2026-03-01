'use client';

// src/app/admin/admin-nav.tsx
// ============================================================================
// ADMIN NAV — Client-side navigation with active link highlighting
// ============================================================================
//
// Extracted as a client component so the server layout can remain a
// server component (required for metadata export). Uses usePathname()
// to highlight the current page.
//
// Version: 2.0.0 — Phase 7.11a (add Scoring Health link)
// Created: 2026-02-27
//
// Existing features preserved: Yes.
// ============================================================================

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_LINKS = [
  { href: '/admin/scoring-health',  label: 'Scoring Health' },
  { href: '/admin/vocab-submissions', label: 'Vocab Queue' },
  { href: '/admin/scene-candidates',  label: 'Scene Candidates' },
  { href: '/admin/providers',         label: 'Providers' },
  { href: '/admin/exchanges',         label: 'Exchanges' },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 overflow-x-auto">
      {NAV_LINKS.map(({ href, label }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`shrink-0 rounded-md px-3 py-1 transition-colors ${
              isActive
                ? 'bg-white/15 text-white ring-1 ring-white/30'
                : 'text-white/40 hover:bg-white/5 hover:text-white/70'
            }`}
            style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
