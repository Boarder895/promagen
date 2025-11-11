/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from 'next/og';
import { env } from '@/lib/env';

export const runtime = 'edge';
export const alt = `${env.siteName} preview`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Minimal, dependency-free OG card (no external fonts).
export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(180deg, #0b1220 0%, #111827 100%)',
          color: 'white',
          padding: 48,
          justifyContent: 'space-between',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ fontSize: 44, fontWeight: 700 }}>{env.siteName}</div>
        <div
          style={{
            fontSize: 28,
            opacity: 0.9,
            maxWidth: 900,
            lineHeight: 1.25,
          }}
        >
          AI creativity × market mood — calm, data-rich and beautifully simple.
        </div>
        <div style={{ display: 'flex', fontSize: 20, opacity: 0.7 }}>
          {env.siteUrl.replace(/^https?:\/\//, '')}
        </div>
      </div>
    ),
    { ...size }
  );
}
