// frontend/src/app/layout.tsx

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

import { PauseProvider } from '@/state/pause';
import ProvenanceFooter from '@/components/core/provenance-footer';
import ErrorBoundary from '@/components/error-boundary';
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
  description: 'Calm, precise, and fast.',
  metadataBase: new URL(SITE),
  robots: { index: true, follow: true },
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Promagen',
    description: 'Calm, precise, and fast.',
    type: 'website',
    url: SITE,
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Promagen',
      },
    ],
    siteName: 'Promagen',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Promagen',
    description: 'Calm, precise, and fast.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full">
      {/* Background + gradient come from globals.css to keep a single source of truth */}
      <body className="min-h-dvh antialiased text-slate-900">
        <PauseProvider>
          <ErrorBoundary>
            {children}
            <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
              <ProvenanceFooter />
            </div>
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
      </body>
    </html>
  );
}
