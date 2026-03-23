// src/components/prompts/playground-workspace.tsx
// ============================================================================
// PLAYGROUND WORKSPACE v3.0.0 — AI Disguise Orchestrator
// ============================================================================
// v3.0.0 (Mar 2026) — AI DISGUISE ORCHESTRATOR:
// - Lifts useTierGeneration, useDriftDetection hooks HERE so state persists
//   across provider ↔ no-provider component switches.
// - Fires Call 2 (AI tier generation) in parallel with Call 1 (extraction).
// - Auto-re-fires Call 2 when provider changes (if human text exists).
// - Passes AI data + callbacks down to PromptBuilder and EnhancedEducationalPreview.
//
// v2.0.0 (Jan 2026):
// - When no provider selected, show EnhancedEducationalPreview instead of
//   EmptyState.
//
// Authority: ai-disguise.md §7, §11. prompt-intelligence.md §9
// Existing features preserved: Yes.
// ============================================================================

'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import PromptBuilder from '@/components/providers/prompt-builder';
import EnhancedEducationalPreview from '@/components/prompts/enhanced-educational-preview';
import { Combobox } from '@/components/ui/combobox';
import type { Provider } from '@/types/providers';
import type { PromptBuilderProvider } from '@/components/providers/prompt-builder';

// AI Disguise hooks (ai-disguise.md §5, Improvement 1)
import { useTierGeneration } from '@/hooks/use-tier-generation';
import type { TierGenerationProviderContext } from '@/hooks/use-tier-generation';
import { useDriftDetection } from '@/hooks/use-drift-detection';

// Platform data for building provider context
import { getPlatformTierId } from '@/data/platform-tiers';
import { getPlatformFormat } from '@/lib/prompt-builder';

// ============================================================================
// TYPES
// ============================================================================

export interface PlaygroundWorkspaceProps {
  /** All providers from the catalog */
  providers: Provider[];
  /** Callback when provider selection changes (null = no provider selected) */
  onProviderChange?: (hasProvider: boolean) => void;
}

// ============================================================================
// HELPERS
// ============================================================================

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

function sortProvidersWithNumbersLast(a: string, b: string): number {
  const aStartsWithNumber = /^\d/.test(a);
  const bStartsWithNumber = /^\d/.test(b);
  if (aStartsWithNumber && !bStartsWithNumber) return 1;
  if (!aStartsWithNumber && bStartsWithNumber) return -1;
  return a.localeCompare(b);
}

/**
 * Build Call 2 provider context from platform data files.
 */
function buildProviderContext(
  providerId: string,
  providerName: string,
): TierGenerationProviderContext | null {
  const tier = getPlatformTierId(providerId);
  if (!tier) return null;

  const format = getPlatformFormat(providerId);

  return {
    tier,
    name: providerName,
    promptStyle: format.promptStyle,
    sweetSpot: format.sweetSpot ?? 100,
    tokenLimit: format.tokenLimit ?? 200,
    qualityPrefix: format.qualityPrefix,
    weightingSyntax: format.weightingSyntax,
    supportsWeighting: format.supportsWeighting,
    negativeSupport: format.negativeSupport,
  };
}

// ============================================================================
// PROVIDER SELECTOR COMPONENT (unchanged from v2.0.0)
// ============================================================================

interface ProviderSelectorProps {
  providers: Provider[];
  selectedId: string | null;
  onSelect: (providerId: string) => void;
}

function ProviderSelector({ providers, selectedId, onSelect }: ProviderSelectorProps) {
  const nameToId = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of providers) map.set(p.name, p.id);
    return map;
  }, [providers]);

  const idToName = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of providers) map.set(p.id, p.name);
    return map;
  }, [providers]);

  const options = useMemo(
    () => providers.map((p) => p.name).sort(sortProvidersWithNumbersLast),
    [providers],
  );

  const selected = useMemo(() => {
    if (!selectedId) return [];
    const name = idToName.get(selectedId);
    return name ? [name] : [];
  }, [selectedId, idToName]);

  const handleSelectChange = useCallback(
    (selectedNames: string[]) => {
      const name = selectedNames[0];
      if (name === undefined) return;
      const id = nameToId.get(name);
      if (id !== undefined) onSelect(id);
    },
    [nameToId, onSelect],
  );

  const handleCustomChange = useCallback(() => {}, []);

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

export default function PlaygroundWorkspace({ providers, onProviderChange }: PlaygroundWorkspaceProps) {
  // ── Provider selection state ──────────────────────────────────────
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);

  // ── Human text tracking (persists across provider switches) ───────
  const [humanText, setHumanText] = useState('');

  // ── AI Disguise: Tier Generation (Call 2) ─────────────────────────
  const {
    aiTierPrompts,
    isGenerating: isTierGenerating,
    generatedForProvider,
    generate: generateTiers,
    clear: clearTiers,
  } = useTierGeneration();

  // ── AI Disguise: Drift Detection (Improvement 1) ──────────────────
  const {
    isDrifted,
    changeCount: driftChangeCount,
    markSynced: markDriftSynced,
  } = useDriftDetection(humanText);

  // Track previous provider for re-fire detection
  const prevProviderIdRef = useRef<string | null>(null);

  // ── Clear everything (Fix 1+2: clear button + stale optimised text) ──
  const handleDescribeClear = useCallback(() => {
    setHumanText('');
    clearTiers();
    markDriftSynced('');
  }, [clearTiers, markDriftSynced]);

  // ── Provider selection handler ────────────────────────────────────
  const handleProviderSelect = useCallback(
    (providerId: string) => {
      setSelectedProviderId(providerId);
      onProviderChange?.(true);
    },
    [onProviderChange],
  );

  // ── Auto-re-fire Call 2 when provider changes (ai-disguise.md §7) ──
  useEffect(() => {
    const prevId = prevProviderIdRef.current;
    prevProviderIdRef.current = selectedProviderId;

    // Re-fire if provider changed (including null → provider) AND human text exists
    if (
      selectedProviderId !== null &&
      selectedProviderId !== prevId &&
      humanText.trim().length > 0
    ) {
      const provider = providers.find((p) => p.id === selectedProviderId);
      if (provider) {
        const ctx = buildProviderContext(selectedProviderId, provider.name);
        generateTiers(humanText, selectedProviderId, ctx);
      }
    }
  }, [selectedProviderId, humanText, providers, generateTiers]);

  // ── Callback: DescribeYourImage text changes ──────────────────────
  const handleDescribeTextChange = useCallback((text: string) => {
    setHumanText(text);
  }, []);

  // ── Callback: DescribeYourImage "Generate Prompt" clicked ─────────
  // Fires Call 2 in parallel with Call 1 (Call 1 fires inside DescribeYourImage)
  const handleDescribeGenerate = useCallback(
    (sentence: string) => {
      const trimmed = sentence.trim();
      if (!trimmed) return;

      let ctx: TierGenerationProviderContext | null = null;
      if (selectedProviderId) {
        const provider = providers.find((p) => p.id === selectedProviderId);
        if (provider) {
          ctx = buildProviderContext(selectedProviderId, provider.name);
        }
      }

      // Fire Call 2 in parallel
      generateTiers(trimmed, selectedProviderId, ctx);
      // Sync drift detection baseline
      markDriftSynced(trimmed);
    },
    [selectedProviderId, providers, generateTiers, markDriftSynced],
  );

  // ── Derived state ─────────────────────────────────────────────────
  const selectedProvider = useMemo(() => {
    if (!selectedProviderId) return null;
    return providers.find((p) => p.id === selectedProviderId) ?? null;
  }, [providers, selectedProviderId]);

  const builderProvider = useMemo(() => {
    if (!selectedProvider) return null;
    return toPromptBuilderProvider(selectedProvider);
  }, [selectedProvider]);

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
          // AI Disguise callbacks (passed through to DescribeYourImage)
          onDescribeTextChange={handleDescribeTextChange}
          onDescribeGenerate={handleDescribeGenerate}
          onDescribeClear={handleDescribeClear}
          isDrifted={isDrifted}
          driftChangeCount={driftChangeCount}
          aiTierPrompts={aiTierPrompts}
          isTierGenerating={isTierGenerating}
          generatedForProvider={generatedForProvider}
        />
      ) : (
        <EnhancedEducationalPreview
          providers={providers}
          onProviderChange={onProviderChange}
          // AI Disguise callbacks + tier data
          onDescribeTextChange={handleDescribeTextChange}
          onDescribeGenerate={handleDescribeGenerate}
          onDescribeClear={handleDescribeClear}
          isDrifted={isDrifted}
          driftChangeCount={driftChangeCount}
          aiTierPrompts={aiTierPrompts}
          isTierGenerating={isTierGenerating}
          generatedForProvider={generatedForProvider}
        />
      )}
    </div>
  );
}
