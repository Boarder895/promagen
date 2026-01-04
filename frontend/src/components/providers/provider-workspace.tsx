// src/components/providers/provider-workspace.tsx
//
// ProviderWorkspace: the centre panel of the prompt builder page.
// Contains only the PromptBuilder — fills full height to align with exchange rails.
//
// Authority: docs/authority/prompt-builder-page.md

'use client';

import React from 'react';

import PromptBuilder from '@/components/providers/prompt-builder';
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

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function ProviderWorkspace({ provider }: ProviderWorkspaceProps) {
  const builderProvider = toPromptBuilderProvider(provider);

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      data-testid="provider-workspace"
    >
      {/* PromptBuilder fills entire height — aligns with exchange rails */}
      <PromptBuilder provider={builderProvider} />
    </div>
  );
}

export default ProviderWorkspace;
