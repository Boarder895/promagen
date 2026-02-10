// frontend/src/app/opengraph-image.tsx
//
// Dynamic Open Graph image generated at request time via @vercel/og.
// Shows in social shares (Twitter/X, LinkedIn, Slack, Discord, iMessage, etc.)
//
// Copy aligned with SEO metadata in page.tsx / layout.tsx / seo.ts.
// Domain: promagen.com (not promagen.ai — that was a typo in the original).

import { ImageResponse } from 'next/og';

// Run this only on the edge runtime (what @vercel/og expects)
export const runtime = 'edge';

// Tell Next this route is fully dynamic – do NOT prerender at build.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// OG metadata
export const alt = 'Promagen — AI prompt builder for 42+ image generators';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 64,
          background: 'linear-gradient(188deg, #0b1220 0%, #111827 100%)',
          color: 'white',
          boxSizing: 'border-box',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        }}
      >
        {/* Top content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
          }}
        >
          {/* Title */}
          <div style={{ fontSize: 52, fontWeight: 700, letterSpacing: -1 }}>
            Promagen
          </div>

          {/* Tagline — matches SEO title */}
          <div
            style={{
              fontSize: 26,
              opacity: 0.9,
              maxWidth: 900,
              lineHeight: 1.35,
            }}
          >
            AI Prompt Builder for 42+ Image Generators
          </div>

          {/* Subtitle — matches SEO description keywords */}
          <div
            style={{
              fontSize: 20,
              opacity: 0.65,
              maxWidth: 900,
              lineHeight: 1.4,
            }}
          >
            10,000+ phrase vocabulary · Elo-ranked leaderboard · Live financial
            market data
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            fontSize: 20,
            opacity: 0.7,
          }}
        >
          {/* Hostname with live indicator */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 9999,
                background:
                  'radial-gradient(circle at 30% 30%, #4ade80 0%, #22c55e 40%, #15803d 100%)',
              }}
            />
            <span>promagen.com</span>
          </div>
        </div>
      </div>
    ),
    {
      width: size.width,
      height: size.height,
    },
  );
}
