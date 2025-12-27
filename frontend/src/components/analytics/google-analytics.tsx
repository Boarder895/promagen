// frontend/src/components/analytics/google-analytics.tsx

'use client';

import Script from 'next/script';

/**
 * Pro posture (Vercel):
 * - No hard-coded GA IDs (prevents polluting your data + avoids “mystery tracking” in previews).
 * - Opt-in via env vars.
 * - Host gate: only runs on your canonical site URL (previews won’t contaminate production metrics).
 * - Optional sampling to reduce metered analytics volume.
 *
 * Env (client-safe):
 * - NEXT_PUBLIC_GA_MEASUREMENT_ID   (required to enable)
 * - NEXT_PUBLIC_GA_ENABLED          ("on" | "off", default: on)
 * - NEXT_PUBLIC_ANALYTICS_ENABLED   ("on" | "off", default: on)
 * - NEXT_PUBLIC_SITE_URL            (recommended; used to stop GA on preview domains)
 * - NEXT_PUBLIC_GA_SAMPLE_RATE      (0..1, default: 1)  e.g. 0.1 = 10% of sessions
 */

const GA_MEASUREMENT_ID = (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? '').trim();

const ANALYTICS_ENABLED =
  (process.env.NEXT_PUBLIC_ANALYTICS_ENABLED ?? 'on').toLowerCase() === 'on';

const GA_ENABLED = (process.env.NEXT_PUBLIC_GA_ENABLED ?? 'on').toLowerCase() === 'on';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim();

function parseSampleRate(): number {
  const raw = (process.env.NEXT_PUBLIC_GA_SAMPLE_RATE ?? '').trim();
  if (!raw) return 1;

  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;

  // Clamp 0..1
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function canonicalOriginFromSiteUrl(siteUrl: string): string | null {
  try {
    if (!siteUrl) return null;
    return new URL(siteUrl).origin;
  } catch {
    return null;
  }
}

function isOnCanonicalHost(): boolean {
  // If no SITE_URL set, don’t block. (Some people prefer GA everywhere.)
  const canonicalOrigin = canonicalOriginFromSiteUrl(SITE_URL);
  if (!canonicalOrigin) return true;

  // Client-only check.
  if (typeof window === 'undefined') return false;

  return window.location.origin === canonicalOrigin;
}

function shouldSampleSession(sampleRate: number): boolean {
  if (sampleRate >= 1) return true;
  if (sampleRate <= 0) return false;

  // Keep sampling stable across a tab/session
  if (typeof window === 'undefined') return false;

  try {
    const key = 'promagen_ga_sampled';
    const existing = window.sessionStorage.getItem(key);
    if (existing === '1') return true;
    if (existing === '0') return false;

    const decision = Math.random() < sampleRate;
    window.sessionStorage.setItem(key, decision ? '1' : '0');
    return decision;
  } catch {
    // If storage is blocked, fall back to a one-off decision
    return Math.random() < sampleRate;
  }
}

/**
 * GoogleAnalytics
 *
 * Injects GA4 gtag.js. Safe defaults:
 * - disabled unless you set NEXT_PUBLIC_GA_MEASUREMENT_ID
 * - does not run on preview domains if NEXT_PUBLIC_SITE_URL is set
 */
export function GoogleAnalytics() {
  if (!ANALYTICS_ENABLED || !GA_ENABLED) return null;
  if (!GA_MEASUREMENT_ID) return null;

  // Prevent preview deployments contaminating real metrics (when SITE_URL is configured).
  if (!isOnCanonicalHost()) return null;

  const sampleRate = parseSampleRate();
  if (!shouldSampleSession(sampleRate)) return null;

  return (
    <>
      <Script
        id="ga-gtag-src"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      />
      <Script id="ga-gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){window.dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', {
            page_path: window.location.pathname,
          });
        `}
      </Script>
    </>
  );
}
