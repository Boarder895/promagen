// src/app/studio/page.tsx
// ============================================================================
// STUDIO INDEX PAGE - Server Component
// ============================================================================
// Hub for all prompt-related features: Library, Explore, Learn, Playground.
// Authority: docs/authority/prompt-intelligence.md §9.3
//
// UPDATED: Renamed from /prompts to /studio for clearer branding.
// Server component provides metadata, client component handles auth UI.
// ============================================================================

import React from 'react';
import type { Metadata } from 'next';
import StudioPageClient from './studio-page-client';

// ============================================================================
// METADATA (SEO)
// ============================================================================

export const metadata: Metadata = {
  title: 'Studio — Promagen',
  description: 'Build, save, and explore AI image prompts with intelligent suggestions.',
};

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default function StudioIndexPage() {
  return <StudioPageClient />;
}
