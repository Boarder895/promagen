// src/app/sentinel/page.tsx
// ============================================================================
// SENTINEL — Public product / landing page
// ============================================================================
// The dedicated commercial page for Sentinel. Distinct from /admin/sentinel
// (the internal weekly digest dashboard). This page sells the offering;
// /admin/sentinel runs it.
//
// Section order (Stage 2b — qualify, explain, set expectation, prove, sell):
//   1. SentinelHero       (variant="product")
//   2. SentinelWho        — qualification: who this is for / not for
//   3. SentinelWhy        — urgency: why AI visibility matters now
//   4. SentinelPillars    — WHAT: Watch / Detect / Cite / Report
//   5. SentinelDemo       — HOW: page audit + Monday report (concrete artefact)
//   6. SentinelIntake     — WHAT WE NEED: domain / competitors / queries / pages
//   7. SentinelProof      — Promagen as live case study
//   8. SentinelCaseStudy  — applied case study
//   9. SentinelOfferStack — Snapshot / Audit / Fix Sprint / Monitor
//  10. SentinelDeliverables
//  11. SentinelCta
//
// Public, indexable. ISR daily — content here changes slowly.
//
// Authority: docs/authority/commercial-positioning.md, docs/authority/sentinel.md
// Existing features preserved: Yes — this is an additive route. No existing
// page, component, or API is modified.
// ============================================================================

import React from 'react';
import type { Metadata } from 'next';

import SentinelHero from '@/components/sentinel/sentinel-hero';
import SentinelWho from '@/components/sentinel/sentinel-who';
import SentinelWhy from '@/components/sentinel/sentinel-why';
import SentinelPillars from '@/components/sentinel/sentinel-pillars';
import SentinelDemo from '@/components/sentinel/sentinel-demo';
import SentinelIntake from '@/components/sentinel/sentinel-intake';
import SentinelProof from '@/components/sentinel/sentinel-proof';
import SentinelCaseStudy from '@/components/sentinel/sentinel-case-study';
import SentinelOfferStack from '@/components/sentinel/sentinel-offer-stack';
import SentinelDeliverables from '@/components/sentinel/sentinel-deliverables';
import SentinelCta from '@/components/sentinel/sentinel-cta';

export const revalidate = 86400; // 24h ISR — sales content, not live data

export const metadata: Metadata = {
  title: 'Sentinel by Promagen — AI Visibility Intelligence',
  description:
    'Sentinel watches whether AI systems can find, read, cite and send traffic to your content — then tells you exactly what to fix next, every week. Snapshot, Audit, Fix Sprint and Monitor packages.',
  alternates: { canonical: '/sentinel' },
  openGraph: {
    title: 'Sentinel by Promagen — AI Visibility Intelligence',
    description:
      'AI Platform Intelligence and AI Visibility Intelligence. Crawl, citation tracking, weekly action report. Live on Promagen as proof.',
    type: 'website',
    siteName: 'Promagen',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sentinel by Promagen — AI Visibility Intelligence',
    description:
      'AI Platform Intelligence and AI Visibility Intelligence. Weekly action report. Live on Promagen as proof.',
  },
  robots: { index: true, follow: true },
};

export default function SentinelPage() {
  return (
    <main
      className="h-full overflow-y-auto bg-slate-950 text-slate-100"
      data-testid="sentinel-product-page"
    >
      <SentinelHero variant="product" />
      <SentinelWho />
      <SentinelWhy />
      <SentinelPillars />
      <SentinelDemo />
      <SentinelIntake />
      <SentinelProof />
      <SentinelCaseStudy />
      <SentinelOfferStack />
      <SentinelDeliverables />
      <SentinelCta />
    </main>
  );
}
