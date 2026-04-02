// src/components/prompts/playground-workspace.tsx
// ============================================================================
// PLAYGROUND WORKSPACE v6.0.0 — Lab Gate + Free Generation Limit
// ============================================================================
// v6.0.0 (Mar 2026):
// - Lab Gate: 1 free generation/day for signed-in free users, unlimited Pro.
// - Anonymous users see sign-in overlay.
// - Free users see "1 free generation — make it count" badge.
// - After exhausting free quota, inline overlay shows upgrade CTA.
// - Generation handler wrapped with gate check + markUsed() on success.
//
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
// Authority: prompt-lab.md, paid_tier.md §5.13
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
import type { CoverageAssessment } from '@/types/category-assessment';
import type { GeneratedPrompts } from '@/types/prompt-intelligence';
import { useCategoryAssessment } from '@/hooks/use-category-assessment';

// Platform data for building provider context
import { getPlatformTierId } from '@/data/platform-tiers';
import { getPlatformFormat } from '@/lib/prompt-builder';

// ★ Lab Gate — generation limiter + overlay
import { useLabGate } from '@/hooks/use-lab-gate';
import { LabGateOverlay, FreeGenerationBadge } from '@/components/prompts/lab-gate-overlay';

// ============================================================================
// TYPES
// ============================================================================

export interface PlaygroundWorkspaceProps {
  /** All providers from the catalog */
  providers: Provider[];
  /** Callback when provider selection changes (null = no provider selected) */
  onProviderChange?: (hasProvider: boolean) => void;
  /** Callback with the actual provider ID when selection changes */
  onProviderIdChange?: (providerId: string | null) => void;
  /** External provider ID — when set, drives the internal selection (controlled from outside, e.g., left rail navigator) */
  externalProviderId?: string | null;
  /** Callback when Call 1 assessment state changes — for Pipeline X-Ray Phase 1 */
  onAssessmentChange?: (assessment: CoverageAssessment | null, isChecking: boolean) => void;
  /** Callback when Call 2 tier generation state changes — for Pipeline X-Ray Phase 2 */
  onTierGenerationChange?: (tierPrompts: GeneratedPrompts | null, isGenerating: boolean) => void;
  /** Callback when Call 3 optimisation state changes — for Pipeline X-Ray Phase 3 */
  onOptimisationChange?: (result: import('@/hooks/use-ai-optimisation').AiOptimiseResult | null, isOptimising: boolean) => void;
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

export default function PlaygroundWorkspace({ providers, onProviderChange, onProviderIdChange, externalProviderId, onAssessmentChange, onTierGenerationChange, onOptimisationChange }: PlaygroundWorkspaceProps) {
  // ── Lab Gate: auth + generation limiter ──────────────────────────────
  const {
    canGenerate,
    isExhausted,
    isPro,
    isAuthenticated,
    isReady,
    markUsed,
    remaining,
  } = useLabGate();

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

  // ── Expose assessment state to parent (for Pipeline X-Ray Phase 1) ──
  useEffect(() => {
    onAssessmentChange?.(assessment, isChecking);
  }, [assessment, isChecking, onAssessmentChange]);

  // ── Expose tier generation state to parent (for Pipeline X-Ray Phase 2) ──
  useEffect(() => {
    onTierGenerationChange?.(aiTierPrompts, isTierGenerating);
  }, [aiTierPrompts, isTierGenerating, onTierGenerationChange]);

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
      onProviderIdChange?.(providerId);
    },
    [onProviderChange, onProviderIdChange],
  );

  // ── External provider sync (driven from left rail navigator) ────
  // When externalProviderId changes and differs from internal state,
  // update internal selection. This makes the workspace controllable
  // from outside while still managing its own state for the dropdown.
  const prevExternalRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (
      externalProviderId != null &&
      externalProviderId !== prevExternalRef.current &&
      externalProviderId !== selectedProviderId
    ) {
      setSelectedProviderId(externalProviderId);
      onProviderChange?.(true);
    }
    prevExternalRef.current = externalProviderId;
  }, [externalProviderId, selectedProviderId, onProviderChange]);

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
  //
  // v6.0.0: Gate check — free users consume 1 daily generation on fire.
  // v6.1.0: Accepts optional childProviderId from EnhancedEducationalPreview
  // so Call 2 uses the correct provider context even when the workspace-level
  // selectedProviderId is null (provider selected inside the child).
  const handleDescribeGenerate = useCallback(
    (sentence: string, childProviderId?: string | null) => {
      const trimmed = sentence.trim();
      if (!trimmed) return;

      // ★ Lab Gate: block if user has exhausted free quota
      if (!canGenerate) return;

      // Use child's provider if provided, fall back to workspace-level
      const effectiveProviderId = childProviderId ?? selectedProviderId;

      // Clear previous results (fresh generation)
      clearTiers();
      clearAssessment();

      // Build provider context for Call 2
      let ctx: TierGenerationProviderContext | null = null;
      if (effectiveProviderId) {
        const provider = providers.find((p) => p.id === effectiveProviderId);
        if (provider) {
          ctx = buildProviderContext(effectiveProviderId, provider.name);
        }
      }

      // Fire Call 1 (assess — matched phrases for text colouring)
      // and Call 2 (tier generation — 4 tier prompts) in PARALLEL
      assess(trimmed);
      generateTiers(trimmed, effectiveProviderId, ctx);

      // Sync drift detection baseline
      markDriftSynced(trimmed);

      // ★ markUsed() is NOT called here — it fires via useEffect below
      // when aiTierPrompts transitions from null to non-null (successful generation).
      // This prevents losing the free generation on API failure.
    },
    [assess, canGenerate, clearTiers, clearAssessment, generateTiers, markDriftSynced, selectedProviderId, providers],
  );

  // ── Derived state ─────────────────────────────────────────────────

  // ★ Fire markUsed() AFTER successful generation — not on click.
  // Watches aiTierPrompts: null → non-null = success. Ref prevents
  // double-firing on provider-switch re-generation.
  const hasMarkedUsedRef = useRef(false);
  useEffect(() => {
    if (aiTierPrompts && !hasMarkedUsedRef.current) {
      hasMarkedUsedRef.current = true;
      markUsed();
    }
  }, [aiTierPrompts, markUsed]);

  // Reset the ref when tiers are cleared (new generation cycle)
  useEffect(() => {
    if (!aiTierPrompts) {
      hasMarkedUsedRef.current = false;
    }
  }, [aiTierPrompts]);

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
      {/* ★ Lab Gate: auth + quota check ────────────────────────────────── */}
      {/* Not ready: render nothing until Clerk resolves AND usage is read */}
      {!isReady ? null : !isAuthenticated ? (
        /* Anonymous: must sign in first */
        <LabGateOverlay requiresSignIn />
      ) : isExhausted && !aiTierPrompts ? (
        /* Free user exhausted quota AND no active results showing.
           This is the "next visit" state — they come back, no results in memory,
           they see the upgrade overlay. */
        <LabGateOverlay />
      ) : (
        /* Authenticated + has quota (or Pro) OR has active results showing.
           When isExhausted=true but aiTierPrompts exists, the workspace stays
           visible so the user can see their results, copy, use optimizer.
           The Generate button is already blocked by canGenerate check. */
        <>
          {/* Free generation badge — shown to free users with remaining quota */}
          {!isPro && remaining > 0 && (
            <div style={{ marginBottom: 'clamp(8px, 0.7vw, 14px)' }}>
              <FreeGenerationBadge remaining={remaining} />
            </div>
          )}

          {/* ★ Exhausted banner — shown inline when quota used but results visible.
              User can still see/copy/optimize their prompt. Generate is blocked. */}
          {isExhausted && aiTierPrompts && (
            <div
              className="flex items-center justify-center rounded-lg"
              style={{
                padding: 'clamp(6px, 0.5vw, 10px) clamp(12px, 1vw, 18px)',
                marginBottom: 'clamp(8px, 0.7vw, 14px)',
                gap: 'clamp(6px, 0.5vw, 10px)',
                background: 'rgba(251, 146, 60, 0.08)',
                border: '1px solid rgba(251, 146, 60, 0.2)',
              }}
            >
              <span
                className="text-amber-400"
                style={{ fontSize: 'clamp(0.6rem, 0.7vw, 0.8rem)' }}
              >
                Your free generation is used for today.
              </span>
              <a
                href="/pro-promagen"
                className="no-underline cursor-pointer font-medium transition-colors hover:text-amber-200"
                style={{ fontSize: 'clamp(0.6rem, 0.7vw, 0.8rem)', color: 'rgb(251, 191, 36)' }}
              >
                Unlock unlimited prompts →
              </a>
            </div>
          )}

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
              // Human text for Call 3 cross-referencing
              humanText={humanText}
              // Pipeline X-Ray Phase 3 callback
              onOptimisationChange={onOptimisationChange}
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
        </>
      )}
    </div>
  );
}
