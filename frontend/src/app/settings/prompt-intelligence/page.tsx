// src/app/settings/prompt-intelligence/page.tsx
// ============================================================================
// PROMPT INTELLIGENCE SETTINGS PAGE
// ============================================================================
// Settings page for Prompt Intelligence preferences.
// Authority: docs/authority/prompt-intelligence.md §10
// ============================================================================

import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import IntelligenceSettingsClient from '@/components/settings/intelligence-settings-client';

// ============================================================================
// METADATA (SEO)
// ============================================================================

export const metadata: Metadata = {
  title: 'Prompt Intelligence Settings — Promagen',
  description: 'Customize your Prompt Intelligence preferences for smarter prompt building.',
};

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default function PromptIntelligenceSettingsPage() {
  return (
    <main className="min-h-screen bg-slate-950">
      {/* Navigation */}
      <nav className="border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link
            href="/providers"
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Providers
          </Link>
        </div>
      </nav>
      
      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <IntelligenceSettingsClient />
      </div>
    </main>
  );
}
