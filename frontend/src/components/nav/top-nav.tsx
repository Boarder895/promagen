// src/components/nav/top-nav.tsx
// ============================================================================
// TOP NAV (v1.2.0)
// ============================================================================
// v1.2.0 (current):
// - Prompt Lab moved from /studio/playground → /prompt-lab (route swap
//   with /inspire → /). Updated href + label accordingly; kept analytics
//   label as "Prompt Lab" for clarity.
//
// v1.1.0 (10 Apr 2026):
// - FIX: Import path changed from deleted @/lib/analytics/nav to events.ts.
// - FIX: Broken className strings repaired (rounded-xl...-3 → proper classes).
// - FIX: Routes updated to current Promagen routes (/studio/playground,
//   /studio/library) — were stale (/designer, /saved).
// - FIX: Text colours updated to comply with no-grey-text standard.
//
// Authority: analytics-build-plan-v1.3-FINAL.md §5 Part 3
// Existing features preserved: Yes
// ============================================================================

'use client';

import Link from 'next/link';
import { BrainIcon, BookmarkIcon } from '@/components/ui/emoji';
import { trackNavClick } from '@/lib/analytics/events';

export default function TopNav() {
  return (
    <nav className="sticky top-0 z-40 w-full border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold text-zinc-100">
          Promagen
        </Link>

        <div className="flex items-center gap-4 text-sm">
          <Link
            href="/prompt-lab"
            onClick={() => trackNavClick({ label: 'Prompt Lab', href: '/prompt-lab' })}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-1.5 text-zinc-200 hover:border-zinc-600 hover:bg-zinc-800 cursor-pointer"
            title="Prompt Lab — build prompts for 40 AI platforms"
          >
            <BrainIcon /> Prompt Lab
          </Link>

          <Link
            href="/studio/library"
            onClick={() => trackNavClick({ label: 'My Prompts', href: '/studio/library' })}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-1.5 text-zinc-200 hover:border-zinc-600 hover:bg-zinc-800 cursor-pointer"
            title="Saved prompts library"
          >
            <BookmarkIcon /> My Prompts
          </Link>
        </div>
      </div>
    </nav>
  );
}
