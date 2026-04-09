// src/app/platforms/layout.tsx
// ============================================================================
// AUTHORITY PAGES LAYOUT
// ============================================================================
// Provides:
//   1. Scrollable container (root layout is overflow:hidden)
//   2. Dark background context for readability on content-heavy pages
//   3. Organization JSON-LD (site-wide authority signal)
//
// Authority: promagen-ai-authority-pages-FINAL-v1.2.md §5
// Existing features preserved: Yes — root layout unchanged.
// ============================================================================

import React from 'react';
import type { Metadata } from 'next';
import { env } from '@/lib/env';
import { AuthorityNav } from '@/components/authority/authority-nav';

const BASE = env.siteUrl;

export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

const ORG_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Promagen',
  url: BASE,
  description:
    'Prompt builder for 40 AI image generators. Platform-specific prompt optimisation, quality benchmarking, and prompt compatibility intelligence.',
  logo: `${BASE}/og.png`,
};

export default function PlatformsLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSON_LD) }}
      />
      <div
        className="h-full overflow-y-auto overflow-x-hidden"
        style={{ background: 'linear-gradient(165deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)' }}
      >
        <AuthorityNav />
        {children}
      </div>
    </>
  );
}
