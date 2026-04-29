// src/components/home/sentinel-led-homepage.tsx
// ============================================================================
// SENTINEL-LED HOMEPAGE — Pure commercial homepage
// ============================================================================
// v10.2.0: Stripped of all platform/leaderboard/lab content. The homepage now
// commits 100% to the Sentinel commercial story. Platform intelligence
// remains fully accessible via /platforms, /providers/leaderboard,
// /inspire and the top-nav, but does not compete with Sentinel above the
// fold.
//
// Section order:
//   1. SentinelHero     — primary commercial headline + dual CTA
//   2. SentinelPillars  — Watch / Detect / Cite / Report
//   3. SentinelDemo     — show, don't tell (page audit + Monday report)
//   4. SentinelProof    — Promagen as live proof + deliberate leaderboard link
//   5. SentinelCta      — final commercial CTA
//   6. Footer           — discreet Resources section (preserves internal SEO)
//
// Removed in v10.2.0:
//   - IntelligenceBand    (competing CTAs to /platforms)
//   - NewHomepageClient   (the embedded Inspire grid)
//   - AuthorityBand       (methodology + prompt-formats + Lab card)
//
// All Sentinel sections are presentational server components — this wrapper
// no longer needs 'use client' or any client-side state.
// ============================================================================

import React from 'react';
import SentinelHero from '@/components/sentinel/sentinel-hero';
import SentinelPillars from '@/components/sentinel/sentinel-pillars';
import SentinelDemo from '@/components/sentinel/sentinel-demo';
import SentinelProof from '@/components/sentinel/sentinel-proof';
import SentinelCta from '@/components/sentinel/sentinel-cta';
import Footer from '@/components/layout/footer';

export default function SentinelLedHomepage() {
  return (
    <main
      className="h-full overflow-y-auto bg-slate-950 text-slate-100"
      data-testid="sentinel-led-homepage"
    >
      <SentinelHero variant="homepage" />
      <SentinelPillars />
      <SentinelDemo />
      <SentinelProof />
      <SentinelCta />
      <Footer />
    </main>
  );
}
