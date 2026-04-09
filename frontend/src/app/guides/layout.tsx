// src/app/guides/layout.tsx
// ============================================================================
// GUIDES LAYOUT — Authority guide pages
// ============================================================================
// Provides the same scrollable dark-gradient shell as /platforms/layout.tsx
// for visual consistency across all authority content.
//
// Authority: promagen-ai-authority-pages-FINAL-v1.2.md §5
// Existing features preserved: Yes — no existing routes modified.
// ============================================================================

import React from 'react';
import type { Metadata } from 'next';
import { AuthorityNav } from '@/components/authority/authority-nav';

export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

export default function GuidesLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div
      className="h-full overflow-y-auto overflow-x-hidden"
      style={{ background: 'linear-gradient(165deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)' }}
    >
      <AuthorityNav />
      {children}
    </div>
  );
}
