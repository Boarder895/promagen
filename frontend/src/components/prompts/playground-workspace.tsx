// src/components/prompts/playground-workspace.tsx
// ============================================================================
// PLAYGROUND WORKSPACE v5.0.0 — Simplified Coverage + Colour Flow
// ============================================================================
// v5.0.0 (Mar 2026):
// - Stripped v4 decision UI (AssessmentBox, decisions, sideNotes, toggles).
// - Call 1 returns matched phrases → text colours up → coverage pills show.
// - User edits text and re-generates, or proceeds to Call 2.
// - coverageData (from useCategoryAssessment) passed to children for
//   text overlay colouring and category coverage pills.
//
// v3.0.0 (Mar 2026) — AI DISGUISE ORCHESTRATOR:
// - Lifts useTierGeneration, useDriftDetection hooks HERE so state persists
//   across provider ↔ no-provider component switches.
//
// Authority: prompt-lab.md
// Existing features preserved: Yes (standard builder untouched).
// ============================================================================

'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import PromptBuilder from '@/components/providers/prompt-builder';
import EnhancedEducationalPreview from '@/components/prompts/enhanced-educational-preview';
import { Combobox } from '@/components/ui/combobox';
import type { Provider } from '@/types/providers';
import type { PromptBuilderProvider } from '@/components/providers/prompt-builder';

// AI Disguise hooks — lifted here so state persists across provider switches
import { useTierGeneration } from '@/hooks/use-tier-generation';
import type { TierGenerationProviderContext } from '@/hooks/use-tier-generation';
import { useDriftDetection } from '@/hooks/use-drift-detection';

// Call 1: Category assessment with matched phrases
import { useCategoryAssessment } from '@/hooks/use-category-assessment';

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
// PROVIDER SELECTOR COMPONENT (unchanged)
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

  // ── AI Disguise: Drift Detection ──────────────────────────────────
  const {
    isDrifted,
    changeCount: driftChangeCount,
    markSynced: markDriftSynced,
  } = useDriftDetection(humanText);

  // ── Call 1: Category Assessment (matched phrases for text colouring) ──
  const {
    assessment,
    isChecking,
    error: assessmentError,
    assess,
    clear: clearAssessment,
  } = useCategoryAssessment();

  // Track previous provider for re-fire detection
  const prevProviderIdRef = useRef<string | null>(null);

  // ── Clear everything ──────────────────────────────────────────────
  const handleDescribeClear = useCallback(() => {
    setHumanText('');
    clearTiers();
    clearAssessment();
    markDriftSynced('');
  }, [clearTiers, clearAssessment, markDriftSynced]);

  // ── Provider selection handler ────────────────────────────────────
  const handleProviderSelect = useCallback(
    (providerId: string) => {
      setSelectedProviderId(providerId);
      onProviderChange?.(true);
    },
    [onProviderChange],
  );

  // ── Auto-re-fire Call 2 when provider changes ─────────────────────
  // Provider change does NOT trigger re-assessment (Call 1 assesses
  // content, not provider). Only re-fire Call 2 if tiers already generated.
  useEffect(() => {
    const prevId = prevProviderIdRef.current;
    prevProviderIdRef.current = selectedProviderId;

    if (
      selectedProviderId !== null &&
      selectedProviderId !== prevId &&
      humanText.trim().length > 0 &&
      aiTierPrompts !== null
    ) {
      const provider = providers.find((p) => p.id === selectedProviderId);
      if (provider) {
        const ctx = buildProviderContext(selectedProviderId, provider.name);
        generateTiers(humanText, selectedProviderId, ctx);
      }
    }
  }, [selectedProviderId, humanText, providers, generateTiers, aiTierPrompts]);

  // ── Callback: DescribeYourImage text changes ──────────────────────
  const handleDescribeTextChange = useCallback((text: string) => {
    setHumanText(text);
  }, []);

  // ── Callback: DescribeYourImage "Generate Prompt" clicked ─────────
  // Fires Call 1 (assess — matched phrases) and Call 2 (tier generation)
  // IN PARALLEL. Text colours up when Call 1 returns (~1-2s), tiers fill
  // when Call 2 returns (~2-3s). One click, both fire. No extra friction.
  // Human factors: §6 Temporal Compression — progressive reveal.
  const handleDescribeGenerate = useCallback(
    (sentence: string) => {
      const trimmed = sentence.trim();
      if (!trimmed) return;

      // Clear previous results (fresh generation)
      clearTiers();
      clearAssessment();

      // Build provider context for Call 2
      let ctx: TierGenerationProviderContext | null = null;
      if (selectedProviderId) {
        const provider = providers.find((p) => p.id === selectedProviderId);
        if (provider) {
          ctx = buildProviderContext(selectedProviderId, provider.name);
        }
      }

      // Fire Call 1 (assess — matched phrases for text colouring)
      // and Call 2 (tier generation — 4 tier prompts) in PARALLEL
      assess(trimmed);
      generateTiers(trimmed, selectedProviderId, ctx);

      // Sync drift detection baseline
      markDriftSynced(trimmed);
    },
    [assess, clearTiers, clearAssessment, generateTiers, markDriftSynced, selectedProviderId, providers],
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
          // Coverage data for text colouring + category pills
          skipInternalParse
          externalLoading={isChecking}
          coverageData={assessment}
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
          // Coverage data for text colouring + category pills
          skipInternalParse
          externalLoading={isChecking}
          coverageData={assessment}
        />
      )}

      {/* Assessment error display */}
      {assessmentError && (
        <p
          className="text-red-400"
          style={{
            marginTop: 'clamp(6px, 0.5vw, 8px)',
            padding: '0 clamp(12px, 1vw, 16px)',
            fontSize: 'clamp(0.65rem, 0.7vw, 0.78rem)',
          }}
        >
          {assessmentError.message}
        </p>
      )}
    </div>
  );
}
