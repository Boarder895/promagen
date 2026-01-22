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
// UPDATE v2.0.0 (Jan 2026):
// - When no provider selected, show EnhancedEducationalPreview instead of
//   EmptyState. This gives users a working prompt builder experience while
//   they explore, with full 4-tier preview, intelligence panel, and vocabulary.
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
import EnhancedEducationalPreview from '@/components/prompts/enhanced-educational-preview';
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
    return providers.map((p) => p.name).sort(sortProvidersWithNumbersLast);
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
    [nameToId, onSelect],
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
  const providerSelectorElement = useMemo(
    () => (
      <ProviderSelector
        providers={providers}
        selectedId={selectedProviderId}
        onSelect={handleProviderSelect}
      />
    ),
    [providers, selectedProviderId, handleProviderSelect],
  );

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="playground-workspace">
      {builderProvider ? (
        <PromptBuilder
          provider={builderProvider}
          providerSelector={providerSelectorElement}
          // No key prop: state persists when switching providers
          // The assembled prompt will re-compute with new provider's formatting
        />
      ) : (
        // v2.0.0: Show EnhancedEducationalPreview instead of EmptyState
        // Users can build prompts and see 4-tier preview even without selecting a provider
        <EnhancedEducationalPreview providers={providers} onSelectProvider={handleProviderSelect} />
      )}
    </div>
  );
}
