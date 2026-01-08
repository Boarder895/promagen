// src/components/prompts/playground-workspace.tsx
// ============================================================================
// PLAYGROUND WORKSPACE - Client Component
// ============================================================================
// Wraps PromptBuilder with a provider selector dropdown.
// Allows users to switch providers instantly and see how their prompt changes.
//
// Key difference from ProviderWorkspace:
// - ProviderWorkspace: Provider pre-selected from URL, static header
// - PlaygroundWorkspace: Provider selected via dropdown, dynamic header
//
// FIX v1.2.0 (Jan 2026):
// - Fixed TypeScript TS2345: check `name` for undefined directly instead of
//   relying on array length check (TypeScript doesn't narrow array[0] after
//   length > 0 check)
//
// FIX v1.1.0 (Jan 2026):
// - Added custom sort to put numeric-prefixed names (like "123RF AI...") at the end
// - Added singleColumn prop to Combobox for easier alphabetical scanning
//
// Authority: docs/authority/prompt-intelligence.md §9
// ============================================================================

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import PromptBuilder from '@/components/providers/prompt-builder';
import { Combobox } from '@/components/ui/combobox';
import type { Provider } from '@/types/providers';
import type { PromptBuilderProvider } from '@/components/providers/prompt-builder';

// ============================================================================
// TYPES
// ============================================================================

export interface PlaygroundWorkspaceProps {
  /** All providers from the catalog */
  providers: Provider[];
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Maps the canonical Provider type to the shape PromptBuilder expects.
 */
function toPromptBuilderProvider(provider: Provider): PromptBuilderProvider {
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
 * Custom sort comparator that:
 * 1. Puts numeric-prefixed names (like "123RF AI Image Generator") at the END
 * 2. Sorts everything else alphabetically
 * 
 * This ensures:
 * - A-Z providers appear first in alphabetical order
 * - Numeric-prefixed names (which sort before 'A' in localeCompare) go last
 */
function sortProvidersWithNumbersLast(a: string, b: string): number {
  const aStartsWithNumber = /^\d/.test(a);
  const bStartsWithNumber = /^\d/.test(b);
  
  // If one starts with number and other doesn't, number goes last
  if (aStartsWithNumber && !bStartsWithNumber) return 1;
  if (!aStartsWithNumber && bStartsWithNumber) return -1;
  
  // Otherwise, standard alphabetical sort
  return a.localeCompare(b);
}

// ============================================================================
// PROVIDER SELECTOR COMPONENT
// ============================================================================

interface ProviderSelectorProps {
  providers: Provider[];
  selectedId: string | null;
  onSelect: (providerId: string) => void;
}

function ProviderSelector({ providers, selectedId, onSelect }: ProviderSelectorProps) {
  // Build name -> id lookup map
  const nameToId = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of providers) {
      map.set(p.name, p.id);
    }
    return map;
  }, [providers]);

  // Build id -> name lookup map
  const idToName = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of providers) {
      map.set(p.id, p.name);
    }
    return map;
  }, [providers]);

  // Options are provider names - custom sorted:
  // - Alphabetical A-Z
  // - Numeric-prefixed names (like "123RF") at the very end
  const options = useMemo(() => {
    return providers
      .map((p) => p.name)
      .sort(sortProvidersWithNumbersLast);
  }, [providers]);

  // Selected as array of names (single-select so max 1 item)
  const selected = useMemo(() => {
    if (!selectedId) return [];
    const name = idToName.get(selectedId);
    return name ? [name] : [];
  }, [selectedId, idToName]);

  // Handle selection change - map name back to ID
  // FIX: Access array element first, then check for undefined
  // This satisfies TypeScript's type narrowing (TS2345)
  const handleSelectChange = useCallback(
    (selectedNames: string[]) => {
      const name = selectedNames[0];
      // Guard: undefined check satisfies TypeScript
      if (name === undefined) return;
      
      const id = nameToId.get(name);
      if (id !== undefined) {
        onSelect(id);
      }
    },
    [nameToId, onSelect]
  );

  // No-op for custom value (we don't allow free text for provider selection)
  const handleCustomChange = useCallback(() => {
    // Intentionally empty - no free text allowed
  }, []);

  return (
    <div className="w-[220px]">
      <Combobox
        id="playground-provider-selector"
        label="AI Provider"
        options={options}
        selected={selected}
        customValue=""
        onSelectChange={handleSelectChange}
        onCustomChange={handleCustomChange}
        placeholder="Select AI Provider..."
        maxSelections={1}
        allowFreeText={false}
        isLocked={false}
        compact
        singleColumn
      />
    </div>
  );
}

// ============================================================================
// EMPTY STATE COMPONENT
// ============================================================================

interface EmptyStateProps {
  providers: Provider[];
  onSelect: (providerId: string) => void;
}

function EmptyState({ providers, onSelect }: EmptyStateProps) {
  return (
    <section
      className="flex h-full min-h-0 flex-col rounded-3xl bg-slate-950/70 shadow-sm ring-1 ring-white/10"
      aria-label="Prompt Playground - Select a provider"
    >
      {/* Header matching PromptBuilder style */}
      <header className="shrink-0 border-b border-slate-800/50 p-4 md:px-6 md:pt-5">
        <div className="flex items-center gap-3">
          <ProviderSelector
            providers={providers}
            selectedId={null}
            onSelect={onSelect}
          />
          <span className="text-sm text-slate-400">· Prompt builder</span>
        </div>
      </header>

      {/* Empty state content */}
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
        <div className="rounded-full bg-slate-800/50 p-6">
          <svg
            className="h-12 w-12 text-slate-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
            />
          </svg>
        </div>
        <div className="max-w-sm space-y-2">
          <h3 className="text-lg font-semibold text-slate-50">
            Select an AI Provider
          </h3>
          <p className="text-sm text-slate-400">
            Choose a provider from the dropdown above to start building your prompt.
            Switch providers anytime to see how your prompt adapts to different platforms.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 text-xs text-slate-500">
          <span className="rounded-full bg-slate-800/50 px-3 py-1">
            Midjourney
          </span>
          <span className="rounded-full bg-slate-800/50 px-3 py-1">
            DALL·E
          </span>
          <span className="rounded-full bg-slate-800/50 px-3 py-1">
            Stable Diffusion
          </span>
          <span className="rounded-full bg-slate-800/50 px-3 py-1">
            Leonardo
          </span>
          <span className="rounded-full bg-slate-800/50 px-3 py-1">
            +38 more
          </span>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PlaygroundWorkspace({ providers }: PlaygroundWorkspaceProps) {
  // Selected provider ID (null = none selected)
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);

  // Find the selected provider object
  const selectedProvider = useMemo(() => {
    if (!selectedProviderId) return null;
    return providers.find((p) => p.id === selectedProviderId) ?? null;
  }, [providers, selectedProviderId]);

  // Convert to PromptBuilder format
  const builderProvider = useMemo(() => {
    if (!selectedProvider) return null;
    return toPromptBuilderProvider(selectedProvider);
  }, [selectedProvider]);

  // Handle provider selection
  const handleProviderSelect = useCallback((providerId: string) => {
    setSelectedProviderId(providerId);
  }, []);

  // Provider selector element to pass to PromptBuilder
  const providerSelectorElement = useMemo(() => (
    <ProviderSelector
      providers={providers}
      selectedId={selectedProviderId}
      onSelect={handleProviderSelect}
    />
  ), [providers, selectedProviderId, handleProviderSelect]);

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      data-testid="playground-workspace"
    >
      {builderProvider ? (
        <PromptBuilder
          provider={builderProvider}
          providerSelector={providerSelectorElement}
          // No key prop: state persists when switching providers
          // The assembled prompt will re-compute with new provider's formatting
        />
      ) : (
        <EmptyState 
          providers={providers}
          onSelect={handleProviderSelect}
        />
      )}
    </div>
  );
}
