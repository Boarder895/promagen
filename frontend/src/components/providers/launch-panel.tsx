// src/components/providers/launch-panel.tsx
// ============================================================================
// LAUNCH PANEL (v1.2.0)
// ============================================================================
// v1.2.0 (10 Apr 2026):
// - FIX: Grey text violations corrected. text-slate-400 → text-slate-200,
//   text-slate-500 → text-slate-300. Promagen code standard: minimum
//   brightness #E2E8F0 (slate-200), no banned dim greys.
// - FIX: Doc reference corrected to analytics-build-plan-v1.3-FINAL.md.
// - NOTE: Prop 'src' retained temporarily for back-compat; maps to
//   'surface' in the GA4 payload.
//
// v1.1.0 (10 Apr 2026):
// - trackProviderLaunch → trackProviderOutbound (analytics consolidation).
// - Import path changed from deleted @/lib/analytics/providers.
//
// Authority: docs/authority/prompt-builder-page.md,
//            analytics-build-plan-v1.3-FINAL.md §5 Part 5
// Existing features preserved: Yes
// ============================================================================

'use client';

import React from 'react';

import AffiliateBadge from '@/components/common/affiliate-badge';
import { trackProviderOutbound } from '@/lib/analytics/events';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface LaunchPanelProvider {
  /** Provider slug, e.g. "midjourney" */
  id: string;
  /** Human-readable name, e.g. "Midjourney" */
  name: string;
  /** Whether this provider requires affiliate disclosure */
  requiresDisclosure?: boolean;
  /** Optional one-liner about the provider */
  tagline?: string;
}

export interface LaunchPanelProps {
  provider: LaunchPanelProvider;
  /** Analytics surface tag — defaults to 'prompt_builder'. Legacy prop name retained for back-compat. */
  src?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function LaunchPanel({ provider, src = 'prompt_builder' }: LaunchPanelProps) {
  // Authority: all outbound links go through /go/[id] (never direct external URLs)
  const launchHref = `/go/${encodeURIComponent(provider.id)}?src=${encodeURIComponent(src)}`;

  const handleLaunchClick = () => {
    trackProviderOutbound({
      providerId: provider.id,
      providerName: provider.name,
      href: launchHref,
      surface: src,
    });
  };

  return (
    <section
      aria-label={`Launch ${provider.name}`}
      className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-slate-700 bg-slate-950/60 p-6 text-center"
    >
      {/* Optional provider tagline */}
      {provider.tagline && (
        <p className="max-w-md text-sm text-slate-200">{provider.tagline}</p>
      )}

      {/* Primary CTA — large, prominent button */}
      <a
        href={launchHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleLaunchClick}
        aria-label={`Open ${provider.name} in a new tab`}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-sky-600 px-8 py-3 text-base font-semibold text-white shadow-lg transition-colors hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 cursor-pointer"
      >
        <span>Open {provider.name}</span>
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14 5h5m0 0v5m0-5L10 14"
          />
        </svg>
      </a>

      {/* Affiliate disclosure — only shown when required */}
      {provider.requiresDisclosure && (
        <div className="mt-1">
          <AffiliateBadge />
        </div>
      )}

      {/* Workflow hint */}
      <p className="text-xs text-slate-300">
        Your prompt is ready — paste it into {provider.name} to generate.
      </p>
    </section>
  );
}

export default LaunchPanel;
