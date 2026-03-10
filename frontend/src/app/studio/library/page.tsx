// src/app/studio/library/page.tsx
// ============================================================================
// PROMPT LIBRARY PAGE - Server Component
// ============================================================================
// Your saved prompts. Save, organise, and reload favourites.
//
// UPDATED v3.0.0 (9 March 2026): Simplified for new library design.
//   - Exchange and weather fetches REMOVED (library page no longer has
//     exchange rails — replaced by library-specific left/right rails)
//   - Only fetches providers (for Engine Bay icon grid)
//   - No longer force-dynamic (providers are static catalog data)
//
// Server responsibilities:
//   - Load all providers from catalog
//   - SEO metadata
//
// Client responsibilities (LibraryClient):
//   - Manage saved prompts (localStorage)
//   - Filter, sort, folder operations
//   - Card grid with selection state
//   - Preview panel with actions
//   - Import/export functionality
//
// Authority: docs/authority/saved-page.md §14
// Existing features preserved: Yes
// ============================================================================

import React from 'react';
import type { Metadata } from 'next';

import LibraryClient from '@/components/prompts/library/library-client';
import { getProviders } from '@/lib/providers/api';

// ============================================================================
// METADATA (SEO)
// ============================================================================

export const metadata: Metadata = {
  title: 'Prompt Library — Promagen',
  description: 'Your saved prompts. Save, organise, and reload your favourite AI image prompts.',
};

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default async function LibraryPage() {
  const providers = await Promise.resolve(getProviders());

  return <LibraryClient providers={providers} />;
}
