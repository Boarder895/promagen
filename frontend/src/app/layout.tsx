import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

import { PauseProvider } from '@/state/pause';
import ErrorBoundary from '@/components/error-boundary';
import { ChunkErrorBoundary } from '@/components/chunk-error-boundary';
import { GoogleAnalytics } from '@/components/analytics/google-analytics';
import { AiCitationDetector } from '@/components/analytics/ai-citation-detector';
import { QuickSaveToastGlobal } from '@/components/prompts/library/quick-save-toast-global';
import { env } from '@/lib/env';
import MobileBottomNav from '@/components/layout/mobile-bottom-nav';
import PortraitLockOverlay from '@/components/layout/portrait-lock-overlay';

// Vercel Pro: Web Analytics + Speed Insights (no visual impact)
import { Analytics as VercelAnalytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

const SITE = env.siteUrl;

// Only emit analytics/speed beacons from production deployments.
// (Previews are for safe iteration and should not burn data points.)
const IS_VERCEL_PROD = process.env.VERCEL_ENV === 'production';

// Cost-control: sample Speed Insights so you don't spray data points everywhere.
// 0.2 = 20% of sessions (tune later if you want more/less signal).
const SPEED_INSIGHTS_SAMPLE_RATE = 0.2;

export const metadata: Metadata = {
  title: 'Promagen',
  description:
    'Most prompts lose detail between what you imagine and what the platform receives. Promagen rebuilds your words in each platform\'s native language. 40 platforms. One click.',
  metadataBase: new URL(SITE),
  robots: { index: true, follow: true },
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Promagen: Prompt Builder for 40 Image Platforms',
    description:
      'Most prompts lose detail between what you imagine and what the platform receives. Promagen rebuilds your words in each platform\'s native language. 40 platforms. One click.',
    type: 'website',
    url: SITE,
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Promagen — prompt builder for 40 image platforms',
      },
    ],
    siteName: 'Promagen',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Promagen: Prompt Builder for 40 Image Platforms',
    description:
      'Most prompts lose detail between what you imagine and what the platform receives. Promagen rebuilds your words in each platform\'s native language. 40 platforms. One click.',
    images: ['/og.png'],
  },
  other: {
    'impact-site-verification': 'd8a78461-61a8-4e5a-a53c-97459178bd78',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full overflow-hidden">
      {/*
        CRITICAL: Body is exactly viewport height with NO overflow.
        All scrolling happens inside individual containers (providers table, exchange rails).
        ProvenanceFooter is now inside homepage-grid, not here.
      */}
      <body className="h-dvh overflow-hidden antialiased text-slate-900">
        <ClerkProvider>
          <PauseProvider>
            {/* Portrait lock — pure CSS, shows rotate prompt on portrait phones */}
            <PortraitLockOverlay />
            {/* ────────────────────────────────────────────────────────────
                MOBILE-AWARE FLEX WRAPPER (Part 1 — Mobile Nav)
                ────────────────────────────────────────────────────────────
                Flex column layout that gives the mobile bottom nav its
                space at the bottom while content fills the rest.

                Desktop/Tablet (≥768px): MobileBottomNav is md:hidden
                (display:none), so the content div gets 100% of the
                viewport height. Zero visual change.

                Mobile (<768px): MobileBottomNav renders at ~60px,
                content div gets the remainder. homepage-grid uses
                h-full (not h-dvh) so it respects this constraint.
                ──────────────────────────────────────────────────────── */}
            <div className="flex h-full flex-col">
              <div className="min-h-0 flex-1">
                <ErrorBoundary>
                  {/*
                    ChunkErrorBoundary: Catches stale deployment chunk errors.
                    When a user has old JS bundles and navigates after a new deploy,
                    this catches the ChunkLoadError and auto-reloads to get fresh assets.
                    Works alongside Vercel Skew Protection (vercel.json: "skewProtection": "7d").
                    @see docs/authority/best-working-practice.md § Deployment Resilience
                  */}
                  <ChunkErrorBoundary>{children}</ChunkErrorBoundary>
                </ErrorBoundary>
              </div>

              {/* Mobile bottom nav — md:hidden, zero impact on desktop/tablet */}
              <MobileBottomNav />
            </div>
          </PauseProvider>

          {/* Quick Save Toast — global mount for 💾 save feedback on all pages */}
          <QuickSaveToastGlobal />

          {/* Global analytics for every page */}
          <GoogleAnalytics />

          {/* AI citation referral detection — no UI, fires once per session.
              Detects arrivals from ChatGPT/Perplexity/Claude/Gemini and logs
              ai_citation_landing to GA4. Respects ANALYTICS_ENABLED gate. */}
          <AiCitationDetector />

          {IS_VERCEL_PROD ? (
            <>
              <VercelAnalytics />
              <SpeedInsights sampleRate={SPEED_INSIGHTS_SAMPLE_RATE} />
            </>
          ) : null}
        </ClerkProvider>
      </body>
    </html>
  );
}
