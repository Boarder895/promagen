// src/components/providers/provider-workspace.tsx
//
// ProviderWorkspace: the centre panel of the prompt builder page.
// Vertically stacks PromptBuilder (top ~60%) and LaunchPanel (bottom ~40%).
//
// Authority: docs/authority/prompt-builder-page.md

'use client';

import React from 'react';

import PromptBuilder from '@/components/providers/prompt-builder';
import LaunchPanel from '@/components/providers/launch-panel';
import type { Provider } from '@/types/providers';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ProviderWorkspaceProps {
  /** Full provider object from the catalogue */
  provider: Provider;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapping helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps the canonical Provider type to the shape PromptBuilder expects.
 * This keeps PromptBuilder decoupled from the full Provider interface.
 */
function toPromptBuilderProvider(provider: Provider) {
  return {
    id: provider.id,
    name: provider.name,
    websiteUrl: provider.website,
    url: provider.url ?? provider.website,
    description: provider.tagline,
    tags: provider.tags,
  };
}

/**
 * Maps the canonical Provider type to the shape LaunchPanel expects.
 */
function toLaunchPanelProvider(provider: Provider) {
  return {
    id: provider.id,
    name: provider.name,
    requiresDisclosure: provider.requiresDisclosure,
    tagline: provider.tagline,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function ProviderWorkspace({ provider }: ProviderWorkspaceProps) {
  const builderProvider = toPromptBuilderProvider(provider);
  const launchProvider = toLaunchPanelProvider(provider);

  return (
    <div
      className="flex flex-col gap-4"
      data-testid="provider-workspace"
    >
      {/* Top section (~60%): Prompt builder with textarea and copy button */}
      <div className="flex-[3]">
        <PromptBuilder provider={builderProvider} />
      </div>

      {/* Bottom section (~40%): Launch panel with CTA and affiliate disclosure */}
      <div className="flex-[2]">
        <LaunchPanel provider={launchProvider} />
      </div>
    </div>
  );
}

export default ProviderWorkspace;
