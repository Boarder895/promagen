// src/components/prompts/playground-workspace.tsx
// ============================================================================
// PLAYGROUND WORKSPACE v4.0.0 — Check → Assess → Decide → Generate
// ============================================================================
// v4.0.0 (Mar 2026) — PROMPT LAB V4 FLOW:
// - Sequential 4-phase flow replaces parallel Call 1 + Call 2 firing.
// - Phase 1 (Check): Call 1 fires in assess mode → coverage map returned.
// - Phase 2 (Assess): AssessmentBox shows coverage. User clicks Generate.
// - Phase 3 (Decide): [Part 3] Engine/Manual toggles for gaps.
// - Phase 4 (Generate): Call 2 fires with categoryDecisions.
// - DescribeYourImage now uses skipInternalParse (orchestrator handles Call 1).
// - Text edits invalidate assessment (§13 state machine).
// - Provider change does NOT re-assess, only re-fires Call 2 if tiers exist.
//
// v3.0.0 (Mar 2026) — AI DISGUISE ORCHESTRATOR:
// - Lifts useTierGeneration, useDriftDetection hooks HERE so state persists
//   across provider ↔ no-provider component switches.
//
// Authority: prompt-lab-v4-flow.md §2, §13, §16
// Existing features preserved: Yes (standard builder untouched).
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

// Prompt Lab v4: Category Assessment (prompt-lab-v4-flow.md §8, §13)
import { useCategoryAssessment } from '@/hooks/use-category-assessment';
import { AssessmentBox } from '@/components/prompt-lab/assessment-box';
import type { CategoryDecision, SideNote } from '@/types/category-assessment';
import type { PromptCategory } from '@/types/prompt-builder';

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

  // ── Prompt Lab v4: Category Assessment (Call 1 in assess mode) ────
  const {
    assessment,
    isChecking,
    error: assessmentError,
    sentText: _assessmentSentText,
    assess,
    clear: clearAssessment,
  } = useCategoryAssessment();

  // ── Prompt Lab v4: Phase 3 Decision state ─────────────────────────
  // Persists across retry (§13: failed-generate → deciding preserves decisions)
  const [decisions, setDecisions] = useState<CategoryDecision[]>([]);
  const [sideNotes, setSideNotes] = useState<SideNote[]>([]);
  /** OD-6: Incremented after re-assessment auto-clears to pulse surviving pills */
  const [sideNotePulseKey, setSideNotePulseKey] = useState(0);

  // Track previous provider for re-fire detection
  const prevProviderIdRef = useRef<string | null>(null);

  // ── Clear everything (Fix 1+2: clear button + stale optimised text) ──
  const handleDescribeClear = useCallback(() => {
    setHumanText('');
    clearTiers();
    clearAssessment();
    setDecisions([]);
    setSideNotes([]);
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

  // ── Auto-re-fire Call 2 when provider changes (ai-disguise.md §7) ──
  // §13: Provider change does NOT trigger re-assessment (Call 1 assesses
  // content, not provider). Only re-fire Call 2 if tiers already generated.
  // Preserves the same gapIntent + decisions from the last generation.
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
        // Determine gapIntent from current state (same logic as handleAssessmentGenerate)
        const hasGaps = assessment && !assessment.allSatisfied;
        if (!hasGaps) {
          generateTiers(humanText, selectedProviderId, ctx, 'all-satisfied', []);
        } else if (decisions.length > 0) {
          generateTiers(humanText, selectedProviderId, ctx, 'user-decided', decisions);
        } else {
          generateTiers(humanText, selectedProviderId, ctx);
        }
      }
    }
  }, [selectedProviderId, humanText, providers, generateTiers, aiTierPrompts, assessment, decisions]);

  // ── Callback: DescribeYourImage text changes ──────────────────────
  // §13: Text edit invalidates assessment + decisions. Side notes persist
  // (attached to categories, not the assessment — §13 table row "deciding").
  const handleDescribeTextChange = useCallback((text: string) => {
    setHumanText(text);
    // Assessment and tiers persist across text edits. The drift indicator
    // shows the user their text has changed since last assessment. They
    // click Generate Prompt again to re-assess. This prevents the
    // destructive behaviour of nuking everything on the first keystroke.
    // sideNotes also persist — §7: they're attached to categories, not text.
  }, []);

  // ── Callback: DescribeYourImage "Generate Prompt" clicked ─────────
  // v4 flow: Fires Call 1 in ASSESS mode (not Call 2).
  // Call 2 fires later from AssessmentBox when user clicks Generate there.
  // Non-regression rule #1: Call 2 NEVER fires during Phase 1.
  // Bug 2 fix: If assessment already exists and text hasn't drifted,
  // do nothing — the assessment is still valid.
  const handleDescribeGenerate = useCallback(
    async (sentence: string) => {
      const trimmed = sentence.trim();
      if (!trimmed) return;

      // Assessment already valid for this text — don't re-fire Call 1
      if (assessment && !isDrifted) return;

      // Clear previous tiers and decisions (fresh check)
      clearTiers();
      setDecisions([]);
      // sideNotes persist — §7: they're attached to categories, not the assessment

      // Fire Call 1 in assess mode (Phase 1: Check)
      const result = await assess(trimmed);

      // §7 D20: Auto-clear side notes when re-assessment covers their category
      // with HIGH confidence. Medium confidence preserves the user's deliberate
      // manual choice — the user's expert term is stronger than a vague implication.
      if (result) {
        setSideNotes((prev) => {
          const kept = prev.filter((note) => {
            const coverage = result.coverage[note.category];
            if (coverage.covered && coverage.confidence === 'high') {
              return false;
            }
            return true;
          });
          // OD-6: Pulse surviving pills if any were auto-cleared
          if (kept.length !== prev.length && kept.length > 0) {
            setSideNotePulseKey((k) => k + 1);
          }
          return kept.length === prev.length ? prev : kept;
        });
      }

      // Sync drift detection baseline
      markDriftSynced(trimmed);
    },
    [assess, clearTiers, markDriftSynced, assessment, isDrifted],
  );

  // ── Callback: Remove a single side note (pill × button) ──────────
  // §7: User can remove side notes manually at any time.
  // Also removes the corresponding decision (reverts to Engine default).
  const handleRemoveSideNote = useCallback(
    (category: PromptCategory) => {
      setSideNotes((prev) => prev.filter((s) => s.category !== category));
      setDecisions((prev) => {
        const filtered = prev.filter((d) => d.category !== category);
        // Re-add as engine default so it's explicit in the decisions array
        return [...filtered, { category, fill: 'engine' as const }];
      });
    },
    [],
  );

  // ── Callback: AssessmentBox "Generate" clicked ────────────────────
  // v4 Phase 4: User approved assessment → fire Call 2 with gapIntent
  // and categoryDecisions from the decisions state.
  // §9: gapIntent determines the discriminated union shape.
  const handleAssessmentGenerate = useCallback(() => {
    const trimmed = humanText.trim();
    if (!trimmed) return;

    let ctx: TierGenerationProviderContext | null = null;
    if (selectedProviderId) {
      const provider = providers.find((p) => p.id === selectedProviderId);
      if (provider) {
        ctx = buildProviderContext(selectedProviderId, provider.name);
      }
    }

    // Determine gapIntent from assessment state
    const hasGaps = assessment && !assessment.allSatisfied;
    const hasDecisions = decisions.length > 0;

    if (!hasGaps) {
      // All 12 satisfied — no decisions needed
      generateTiers(trimmed, selectedProviderId, ctx, 'all-satisfied', []);
    } else if (hasDecisions) {
      // User made decisions about gaps
      generateTiers(trimmed, selectedProviderId, ctx, 'user-decided', decisions);
    } else {
      // Gaps exist but no explicit decisions — all default to engine
      // Build implicit engine-fill decisions for all gap categories
      const gapCategories = assessment
        ? (Object.entries(assessment.coverage) as Array<[string, { covered: boolean }]>)
            .filter(([, v]) => !v.covered)
            .map(([cat]) => ({ category: cat, fill: 'engine' }))
        : [];
      generateTiers(trimmed, selectedProviderId, ctx, 'user-decided', gapCategories);
    }
  }, [humanText, selectedProviderId, providers, generateTiers, assessment, decisions]);

  // ── Callback: AssessmentBox "Skip gaps" clicked ───────────────────
  // v4 §5: User acknowledges gaps but ignores them. gapIntent: "skipped".
  // Call 2 fires with human text only, no gap-filling instructions.
  const handleSkipGaps = useCallback(() => {
    const trimmed = humanText.trim();
    if (!trimmed) return;

    let ctx: TierGenerationProviderContext | null = null;
    if (selectedProviderId) {
      const provider = providers.find((p) => p.id === selectedProviderId);
      if (provider) {
        ctx = buildProviderContext(selectedProviderId, provider.name);
      }
    }

    // Fire Call 2 with "skipped" intent — no categoryDecisions
    generateTiers(trimmed, selectedProviderId, ctx, 'skipped', []);
  }, [humanText, selectedProviderId, providers, generateTiers]);

  // ── Callback: Decision changed (Engine/Manual toggle or term pick) ──
  // §5: Updates decisions array + sideNotes array.
  // §7: Side note created when user selects Manual dropdown term.
  const handleDecisionChange = useCallback(
    (category: PromptCategory, fill: 'engine' | string) => {
      // Update decisions
      setDecisions((prev) => {
        const filtered = prev.filter((d) => d.category !== category);
        return [...filtered, { category, fill }];
      });

      // Update sideNotes — add/update when manual, remove when engine
      if (fill === 'engine') {
        setSideNotes((prev) => prev.filter((s) => s.category !== category));
      } else {
        setSideNotes((prev) => {
          const filtered = prev.filter((s) => s.category !== category);
          return [...filtered, { category, term: fill }];
        });
      }
    },
    [],
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

  // ── v4: Assessment element (rendered between DYI and category grid) ──
  const assessmentElement = useMemo(() => {
    if (!assessment) return undefined;

    return (
      <div style={{ marginTop: 'clamp(8px, 0.7vw, 12px)' }}>
        <AssessmentBox
          assessment={assessment}
          onGenerate={handleAssessmentGenerate}
          onSkipGaps={handleSkipGaps}
          isGenerating={isTierGenerating}
          decisions={decisions}
          sideNotes={sideNotes}
          onDecisionChange={handleDecisionChange}
          sentenceLength={humanText.trim().length}
        />
        {/* Assessment error display */}
        {assessmentError && (
          <p
            className="text-red-400"
            style={{
              marginTop: 'clamp(6px, 0.5vw, 8px)',
              fontSize: 'clamp(0.65rem, 0.7vw, 0.78rem)',
            }}
          >
            {assessmentError.message}
          </p>
        )}
      </div>
    );
  }, [assessment, assessmentError, handleAssessmentGenerate, handleSkipGaps, isTierGenerating, decisions, sideNotes, handleDecisionChange, humanText]);

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
          // v4: Assessment flow
          assessmentElement={assessmentElement}
          skipInternalParse
          externalLoading={isChecking}
          sideNotes={sideNotes}
          onRemoveSideNote={handleRemoveSideNote}
          sideNotePulseKey={sideNotePulseKey}
          generateDisabled={assessment !== null && !isDrifted}
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
          // v4: Assessment flow
          assessmentElement={assessmentElement}
          skipInternalParse
          externalLoading={isChecking}
          sideNotes={sideNotes}
          onRemoveSideNote={handleRemoveSideNote}
          sideNotePulseKey={sideNotePulseKey}
          generateDisabled={assessment !== null && !isDrifted}
        />
      )}
    </div>
  );
}
