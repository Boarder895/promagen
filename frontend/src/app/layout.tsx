import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

import { PauseProvider } from '@/state/pause';
import ErrorBoundary from '@/components/error-boundary';
import { ChunkErrorBoundary } from '@/components/chunk-error-boundary';
import { GoogleAnalytics } from '@/components/analytics/google-analytics';
import { env } from '@/lib/env';

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
    'AI prompt builder with 10,000+ phrases for 42+ image generators. Elo-ranked leaderboard and live financial market data.',
  metadataBase: new URL(SITE),
  robots: { index: true, follow: true },
  alternates: { canonical: '/' },
  openGraph: {
    title: 'AI Prompt Builder for 42+ Image Generators | Promagen',
    description:
      'Build prompts for Midjourney, DALL·E & 40+ AI image generators. 10,000+ phrase vocabulary, Elo-ranked leaderboard, and live financial market data.',
    type: 'website',
    url: SITE,
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Promagen — AI prompt builder for 42+ image generators',
      },
    ],
    siteName: 'Promagen',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Prompt Builder for 42+ Image Generators | Promagen',
    description:
      'Build prompts for Midjourney, DALL·E & 40+ AI image generators. 10,000+ phrase vocabulary, Elo-ranked leaderboard, and live financial market data.',
    images: ['/og.png'],
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
          </PauseProvider>

          {/* Global analytics for every page */}
          <GoogleAnalytics />

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
