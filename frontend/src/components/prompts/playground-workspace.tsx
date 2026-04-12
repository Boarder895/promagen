// src/components/prompts/playground-workspace.tsx
// ============================================================================
// PLAYGROUND WORKSPACE v7.0.0 — Phase A: Coverage Seed Wiring
// ============================================================================
// v7.0.0 (13 Apr 2026): Phase A — coverageSeed downstream wiring
//   - Imports buildCoverageSeed from category-assessment types
//   - On provider-change re-fire, passes Call 1's coverageSeed to Call 2
//   - First fire: coverageSeed absent (Call 1/Call 2 parallel, Call 1 not back yet)
//   - Re-fire: coverageSeed present (Call 1 already returned)
//   - No user-visible change — prep for Phase B anatomy array
//
// v6.1.0 (2 Apr 2026):
// - Added onHumanTextChange callback — exposes human text to page client
//   for Call 4 scoring payload.
// - Added onAssembledPromptChange callback — passes through to EEP,
//   exposes Call 3 input text to page client for Call 4 scoring payload.
//
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
import { buildCoverageSeed } from '@/types/category-assessment';
import type { GeneratedPrompts } from '@/types/prompt-intelligence';
import { useCategoryAssessment } from '@/hooks/use-category-assessment';

// Platform data for building provider context
import { getPlatformTierId } from '@/data/platform-tiers';
import { getPlatformFormat } from '@/lib/prompt-builder';

// ★ Lab Gate — generation limiter + overlay
import { useLabGate } from '@/hooks/use-lab-gate';
import { LabGateOverlay, FreeGenerationBadge } from '@/components/prompts/lab-gate-overlay';

// ★ Index Rating — track Prompt Lab engagement
import { useIndexRatingEvents } from '@/hooks/use-index-rating-events';

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
  /** Callback when human text changes — for Call 4 scoring */
  onHumanTextChange?: (text: string) => void;
  /** Callback when assembled prompt (Call 3 input) changes — for Call 4 scoring */
  onAssembledPromptChange?: (text: string) => void;
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
        label="Provider"
        options={options}
        selected={selected}
        customValue=""
        onSelectChange={handleSelectChange}
        onCustomChange={handleCustomChange}
        placeholder="Select Provider..."
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

export default function PlaygroundWorkspace({ providers, onProviderChange, onProviderIdChange, externalProviderId, onAssessmentChange, onTierGenerationChange, onOptimisationChange, onHumanTextChange, onAssembledPromptChange }: PlaygroundWorkspaceProps) {
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

  // ── Index Rating: track Prompt Lab engagement ────────────────────
  const { trackLabSelect, trackLabGenerate } = useIndexRatingEvents();

  // ── Provider selection state ──────────────────────────────────────
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);

  // ── Human text tracking (persists across provider switches) ───────
  const [humanText, setHumanText] = useState('');

  // ── AI Disguise: Tier Generation (Call 2) ─────────────────────────
  const {
    aiTierPrompts,
    isGenerating: isTierGenerating,
    error: tierError,
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

  // ── Expose human text to parent (for Call 4 scoring) ──
  useEffect(() => {
    onHumanTextChange?.(humanText);
  }, [humanText, onHumanTextChange]);

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
      // ★ Index Rating: provider selected in Prompt Lab (4pts, K=20)
      trackLabSelect(providerId, 'prompt_lab_selector');
    },
    [onProviderChange, onProviderIdChange, trackLabSelect],
  );

  // ── External provider sync REMOVED from workspace level ────────
  // Previously, externalProviderId set the workspace's selectedProviderId,
  // which resolved builderProvider, which switched from EEP to standard
  // builder. Now we pass it directly to EEP as railSelectedProviderId
  // so the EEP syncs its own internal state without triggering the view switch.

  // ── Ref for latest assessment (avoids stale closure in provider-change effect) ──
  const assessmentRef = useRef(assessment);
  useEffect(() => { assessmentRef.current = assessment; }, [assessment]);

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
        // On re-fire, Call 1 has already returned — pass coverageSeed from ref
        const current = assessmentRef.current;
        const seed = current ? buildCoverageSeed(current) : undefined;
        generateTiers(humanText, selectedProviderId, ctx, undefined, undefined, seed);
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

      // ★ Index Rating: prompt generated in Prompt Lab (7pts, K=28)
      if (effectiveProviderId) {
        trackLabGenerate(effectiveProviderId, 'prompt_lab_generate');
      }

      // Sync drift detection baseline
      markDriftSynced(trimmed);

      // ★ markUsed() is NOT called here — it fires via useEffect below
      // when aiTierPrompts transitions from null to non-null (successful generation).
      // This prevents losing the free generation on API failure.
    },
    [assess, canGenerate, clearTiers, clearAssessment, generateTiers, markDriftSynced, selectedProviderId, providers, trackLabGenerate],
  );

  // ── Derived state ─────────────────────────────────────────────────

  // ★ Fire markUsed() AFTER successful generation — not on click.
  // Only counts when aiTierPrompts exists AND no tier error.
  // If Call 2 failed (even partially), quota is preserved.
  const hasMarkedUsedRef = useRef(false);
  useEffect(() => {
    if (aiTierPrompts && !tierError && !hasMarkedUsedRef.current) {
      hasMarkedUsedRef.current = true;
      markUsed();
    }
  }, [aiTierPrompts, tierError, markUsed]);

  // Reset the ref when tiers are cleared (new generation cycle)
  useEffect(() => {
    if (!aiTierPrompts) {
      hasMarkedUsedRef.current = false;
    }
  }, [aiTierPrompts]);

  // ── Template fallback — when Call 2 fails, build from user's text ────
  // Not AI-generated, no quota consumed. User sees their own text arranged
  // into tier cards so they have something to copy. They can retry for AI.
  const fallbackPrompts = useMemo<GeneratedPrompts | null>(() => {
    // Only build fallback when Call 2 failed AND user has text
    // Don't build for content policy — user should change their content
    if (aiTierPrompts || !tierError || !humanText.trim()) return null;
    if (tierError.type === 'content-policy') return null;

    const text = humanText.trim();

    // Extract matched phrases from Call 1 if available
    const keywords: string[] = [];
    if (assessment?.coverage) {
      for (const data of Object.values(assessment.coverage)) {
        if (data.matchedPhrases) {
          keywords.push(...data.matchedPhrases);
        }
      }
    }

    // Tier 1 (CLIP): comma-separated keywords, or raw text if no keywords
    const t1 = keywords.length > 0
      ? keywords.join(', ') + ', high quality, detailed'
      : text;

    return {
      tier1: t1,
      tier2: text,     // Tier 2 (Midjourney): raw text
      tier3: text,     // Tier 3 (Natural Language): raw text
      tier4: text,     // Tier 4 (Plain Language): raw text
      negative: { tier1: '', tier2: '', tier3: '', tier4: '' },
    };
  }, [aiTierPrompts, tierError, humanText, assessment]);

  // ── Effective tier prompts — AI-generated or fallback ─────────────
  const effectiveTierPrompts = aiTierPrompts ?? fallbackPrompts;

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
      {/* ★ Lab Gate: quota check ────────────────────────────────────────── */}
      {/* Not ready: render nothing until Clerk resolves AND usage is read */}
      {isReady && isExhausted && !aiTierPrompts ? (
        /* Exhausted quota AND no active results showing.
           Anonymous → sign-in CTA. Free → upgrade CTA. */
        <LabGateOverlay requiresSignIn={!isAuthenticated} />
      ) : (
        /* Authenticated + has quota (or Pro) OR has active results showing.
           When isExhausted=true but aiTierPrompts exists, the workspace stays
           visible so the user can see their results, copy, use optimizer.
           The Generate button is already blocked by canGenerate check. */
        <>
          {/* Free generation badge — passed to child header for inline display */}

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
                {isAuthenticated
                  ? 'Your free generations are used for today.'
                  : 'Your free prompt is used for today. Sign in for 2 daily prompts.'}
              </span>
              <a
                href={isAuthenticated ? '/pro-promagen' : '/sign-in'}
                className="no-underline cursor-pointer font-medium transition-colors hover:text-amber-200"
                style={{ fontSize: 'clamp(0.6rem, 0.7vw, 0.8rem)', color: 'rgb(251, 191, 36)' }}
              >
                {isAuthenticated ? 'Unlock unlimited prompts →' : 'Sign in →'}
              </a>
            </div>
          )}

          {builderProvider ? (
            <PromptBuilder
              provider={builderProvider}
              providerSelector={providerSelectorElement}
              freeBadge={!isPro && remaining > 0 ? <FreeGenerationBadge remaining={remaining} /> : undefined}
              // AI Disguise callbacks (passed through to DescribeYourImage)
              onDescribeTextChange={handleDescribeTextChange}
              onDescribeGenerate={handleDescribeGenerate}
              onDescribeClear={handleDescribeClear}
              isDrifted={isDrifted}
              driftChangeCount={driftChangeCount}
              aiTierPrompts={effectiveTierPrompts}
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
              onProviderIdChange={onProviderIdChange}
              freeBadge={!isPro && remaining > 0 ? <FreeGenerationBadge remaining={remaining} /> : undefined}
              // AI Disguise callbacks + tier data
              onDescribeTextChange={handleDescribeTextChange}
              onDescribeGenerate={handleDescribeGenerate}
              onDescribeClear={handleDescribeClear}
              isDrifted={isDrifted}
              driftChangeCount={driftChangeCount}
              aiTierPrompts={effectiveTierPrompts}
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
              // Call 4 data: assembled prompt (Call 3 input text)
              onAssembledPromptChange={onAssembledPromptChange}
              // Rail navigator selection — syncs EEP internal provider
              railSelectedProviderId={externalProviderId}
            />
          )}

          {/* ── Error displays ──────────────────────────────────────────── */}

          {/* Call 2 (tier generation) error — critical, shown prominently */}
          {tierError && (
            <div
              className="flex items-center justify-center rounded-lg"
              style={{
                marginTop: 'clamp(6px, 0.5vw, 8px)',
                padding: 'clamp(6px, 0.5vw, 10px) clamp(12px, 1vw, 18px)',
                gap: 'clamp(6px, 0.5vw, 10px)',
                background: tierError.type === 'content-policy'
                  ? 'rgba(239, 68, 68, 0.08)'
                  : 'rgba(251, 146, 60, 0.08)',
                border: tierError.type === 'content-policy'
                  ? '1px solid rgba(239, 68, 68, 0.2)'
                  : '1px solid rgba(251, 146, 60, 0.2)',
              }}
            >
              <span
                style={{
                  fontSize: 'clamp(0.6rem, 0.7vw, 0.8rem)',
                  color: tierError.type === 'content-policy' ? '#F87171' : '#FBBF24',
                }}
              >
                {fallbackPrompts
                  ? 'Optimisation unavailable — showing your description as a starting point. Try again for full prompts.'
                  : tierError.message}
              </span>
            </div>
          )}

          {/* Call 1 (assessment) error — non-critical, subtle when any prompts exist */}
          {assessmentError && (
            <p
              style={{
                marginTop: 'clamp(6px, 0.5vw, 8px)',
                padding: '0 clamp(12px, 1vw, 16px)',
                fontSize: 'clamp(0.6rem, 0.65vw, 0.72rem)',
                color: effectiveTierPrompts ? '#94A3B8' : '#F87171',
              }}
            >
              {effectiveTierPrompts
                ? 'Text highlighting unavailable — prompts generated successfully.'
                : assessmentError.message}
            </p>
          )}
        </>
      )}
    </div>
  );
}
