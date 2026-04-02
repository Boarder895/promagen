// src/app/studio/playground/playground-page-client.tsx
// ============================================================================
// PROMPT LAB CLIENT WRAPPER (v4.1.0)
// ============================================================================
// Client component for /studio/playground (Prompt Lab).
// Same pattern as homepage-client.tsx and library-client.tsx.
//
// v4.1.0 (2 Apr 2026):
// - Call 4 wiring fix: humanText, assembledPrompt, categoryRichness
//   now populated from workspace/EEP callbacks instead of empty strings.
// - call3Mode read from platform-config.json SSOT instead of hardcoded.
// - Reverted wasOptimisingRef (React 18 batching prevented true→false
//   detection) back to prevOptimiseRef reference comparison — reliable.
//
// v4.0.0 (2 Apr 2026):
// - Exchange rails replaced with intelligence rails:
//   Left:  PlatformMatchRail — 40-platform tier-grouped navigator
//   Right: PipelineXRay — Glass Case dormant state (Phase 0)
// - Provider selection lifted to page level — shared between
//   left rail navigator and centre PlaygroundWorkspace.
// - useIndicesQuotes removed (no exchange cards = no index data needed,
//   saves API calls).
// - useExchangeOrder kept — `ordered` still flows to HomepageGrid
//   for Engine Bay / Mission Control / MarketPulseOverlay.
//
// v3.0.0 (30 Mar 2026):
// - Added useIndicesQuotes + indexByExchange map for exchange cards.
//
// v2.0.0 (18 Mar 2026):
// - Uses useExchangeOrder() for Pro-aware exchange rail ordering.
//
// v1.0.0: Initial client wrapper with dynamic Listen text.
//
// Authority: docs/authority/lefthand-rail.md v1.2.0, docs/authority/righthand-rail.md v1.2.0
// Existing features preserved: Yes — Engine Bay, Mission Control, Hero Window,
//   centre PlaygroundWorkspace, MobileBuilderGate all unchanged.
// ============================================================================

'use client';

import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import HomepageGrid from '@/components/layout/homepage-grid';
import PlaygroundWorkspace from '@/components/prompts/playground-workspace';
import type { Exchange } from '@/data/exchanges/types';
import type { ExchangeWeatherData } from '@/components/exchanges/types';
import type { Provider } from '@/types/providers';
import type { CoverageAssessment } from '@/types/category-assessment';
import type { GeneratedPrompts } from '@/types/prompt-intelligence';
import type { AiOptimiseResult } from '@/hooks/use-ai-optimisation';
import { useExchangeOrder } from '@/hooks/use-exchange-order';
import { usePromptScore } from '@/hooks/use-prompt-score';
import { getRawPlatformConfig } from '@/data/providers/platform-config';
import MobileBuilderGate from '@/components/layout/mobile-builder-gate';

// ── Intelligence rails ────────────────────────────────────────────────
import { PlatformMatchRail } from '@/components/prompt-lab/platform-match-rail';
import { PipelineXRay } from '@/components/prompt-lab/pipeline-xray';

// ============================================================================
// SPEECH TEXT — British female voice (same pattern as homepage/library/pro)
// ============================================================================

/** Listen text when no provider is selected — invitation to explore */
const HERO_TEXT_NO_PROVIDER =
  "Every platform speaks its own language. On the standard builder, you write for one. " +
  "Here, you write for all of them. Pick your subject, your style, your mood " +
  "— then switch platforms and watch the same idea reshape itself. " +
  "Your selections stay. The syntax transforms. That's the Lab.";

/** Listen text when a provider is selected — guidance */
const HERO_TEXT_WITH_PROVIDER =
  "Same selections, different output. Switch platforms freely " +
  "— your choices stay put, the prompt reshapes to match.";

// ============================================================================
// GLASS CASE — Right rail panel override (righthand-rail.md §11)
// ============================================================================
// The standard rail panel is `rounded-3xl bg-slate-950/70 ring-1 ring-white/10`.
// For the Glass Case, the outer HomepageGrid section is layout-only (transparent).
// The glass case visual chrome (brass frame, glass reflection, box-shadow) lives
// on the PipelineXRay component itself — this avoids needing inline styles on the
// HomepageGrid section, which only accepts className (no style prop).
const GLASS_CASE_CLASS =
  'flex min-h-0 flex-1 flex-col p-0 bg-transparent shadow-none ring-0';

// ============================================================================
// TYPES
// ============================================================================

export interface PlaygroundPageClientProps {
  /** All AI providers */
  providers: Provider[];
  /** All exchanges (flat, east→west from server) */
  exchanges: ReadonlyArray<Exchange>;
  /** Weather data indexed by exchange ID */
  weatherIndex: Map<string, ExchangeWeatherData>;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function PlaygroundPageClient({
  providers,
  exchanges,
  weatherIndex,
}: PlaygroundPageClientProps) {
  // ── Provider selection state (lifted — shared between left rail + workspace)
  const [hasProvider, setHasProvider] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);

  // ── Pipeline X-Ray state (Call 1 assessment data for Phase 1 Decoder)
  const [xrayAssessment, setXrayAssessment] = useState<CoverageAssessment | null>(null);
  const [xrayIsChecking, setXrayIsChecking] = useState(false);

  // ── Pipeline X-Ray state (Call 2 tier data for Phase 2 Switchboard)
  const [xrayTierPrompts, setXrayTierPrompts] = useState<GeneratedPrompts | null>(null);
  const [xrayIsTierGenerating, setXrayIsTierGenerating] = useState(false);

  // ── Pipeline X-Ray state (Call 3 optimisation data for Phase 3 Alignment)
  const [xrayOptimiseResult, setXrayOptimiseResult] = useState<AiOptimiseResult | null>(null);
  const [xrayIsOptimising, setXrayIsOptimising] = useState(false);

  const generationIdRef = useRef(0);
  const [generationId, setGenerationId] = useState(0);

  // ── Call 4 data: humanText + assembledPrompt (refs — no re-render needed) ──
  const humanTextRef = useRef('');
  const assembledPromptRef = useRef('');

  // ── Derive platform metadata for X-Ray Alignment badge + gauge ────
  const selectedPlatformMeta = useMemo(() => {
    if (!selectedProviderId) return null;
    const provider = providers.find((p) => p.id === selectedProviderId);
    const config = getRawPlatformConfig(selectedProviderId);
    return {
      name: provider?.name ?? selectedProviderId,
      tier: config?.tier ?? 3,
      maxChars: config?.maxChars ?? null,
    };
  }, [selectedProviderId, providers]);

  // Workspace reports boolean (existing contract)
  const handleProviderChange = useCallback((selected: boolean) => {
    setHasProvider(selected);
  }, []);

  // Workspace reports actual ID (new v4.0.0 contract)
  const handleProviderIdChange = useCallback((providerId: string | null) => {
    setSelectedProviderId(providerId);
    setHasProvider(providerId !== null);
  }, []);

  // Left rail navigator selects a platform
  const handleRailSelectProvider = useCallback((providerId: string) => {
    setSelectedProviderId(providerId);
    setHasProvider(true);
  }, []);

  // Workspace reports assessment state changes → X-Ray Phase 1
  const handleAssessmentChange = useCallback((
    assessment: CoverageAssessment | null,
    isChecking: boolean,
  ) => {
    // Increment generation ID when a new check starts (cancellation model)
    if (isChecking) {
      generationIdRef.current += 1;
      setGenerationId(generationIdRef.current);
    }
    setXrayAssessment(assessment);
    setXrayIsChecking(isChecking);
  }, []);

  // Workspace reports tier generation state changes → X-Ray Phase 2
  const handleTierGenerationChange = useCallback((
    tierPrompts: GeneratedPrompts | null,
    isGenerating: boolean,
  ) => {
    setXrayTierPrompts(tierPrompts);
    setXrayIsTierGenerating(isGenerating);
  }, []);

  // Workspace reports optimisation state changes → X-Ray Phase 3
  const handleOptimisationChange = useCallback((
    result: AiOptimiseResult | null,
    isOptimising: boolean,
  ) => {
    setXrayOptimiseResult(result);
    setXrayIsOptimising(isOptimising);
  }, []);

  // Workspace reports human text changes → stored for Call 4
  const handleHumanTextChange = useCallback((text: string) => {
    humanTextRef.current = text;
  }, []);

  // EEP reports assembled prompt changes → stored for Call 4
  const handleAssembledPromptChange = useCallback((text: string) => {
    assembledPromptRef.current = text;
  }, []);

  // ── Call 4: Prompt Scoring (auto-fires after Call 3) ──────────────
  const {
    result: scoreResult,
    isScoring,
    error: scoreError,
    score: fireScore,
  } = usePromptScore();

  // Auto-fire Call 4 when Call 3 completes with a new result
  const prevOptimiseRef = useRef<AiOptimiseResult | null>(null);
  useEffect(() => {
    // Fire when optimiseResult transitions to a new non-null result
    if (
      xrayOptimiseResult &&
      !xrayIsOptimising &&
      xrayOptimiseResult !== prevOptimiseRef.current &&
      selectedPlatformMeta &&
      selectedProviderId
    ) {
      const config = getRawPlatformConfig(selectedProviderId);
      if (config) {
        // Derive categoryRichness from Call 1 assessment (already in page state)
        const richness: Record<string, number> = {};
        if (xrayAssessment?.coverage) {
          for (const [cat, data] of Object.entries(xrayAssessment.coverage)) {
            if (data.matchedPhrases.length > 0) {
              richness[cat] = data.matchedPhrases.length;
            }
          }
        }

        fireScore({
          optimisedPrompt: xrayOptimiseResult.optimised,
          humanText: humanTextRef.current,
          assembledPrompt: assembledPromptRef.current,
          negativePrompt: xrayOptimiseResult.negative,
          platformId: selectedProviderId,
          platformName: selectedPlatformMeta.name,
          tier: selectedPlatformMeta.tier as 1 | 2 | 3 | 4,
          promptStyle: config.promptStyle as 'keywords' | 'natural',
          maxChars: config.maxChars ?? 500,
          idealMin: config.idealMin ?? 50,
          idealMax: config.idealMax ?? 200,
          negativeSupport: (config.negativeSupport as 'separate' | 'inline' | 'none') ?? 'none',
          call3Changes: xrayOptimiseResult.changes,
          call3Mode: (config.call3Mode as 'reorder_only' | 'format_only' | 'gpt_rewrite' | 'pass_through' | 'mj_deterministic') ?? 'gpt_rewrite',
          categoryRichness: richness,
        });
      }
    }
    prevOptimiseRef.current = xrayOptimiseResult;
  }, [xrayOptimiseResult, xrayIsOptimising, selectedProviderId, selectedPlatformMeta, xrayAssessment, fireScore]);

  // Pro-aware exchange ordering — `ordered` still needed for HomepageGrid
  // (Engine Bay, Mission Control, MarketPulseOverlay). Left/right split
  // no longer used — exchange rails removed from Prompt Lab.
  const { ordered } = useExchangeOrder(exchanges);

  // Speech text changes based on provider selection
  const heroText = hasProvider ? HERO_TEXT_WITH_PROVIDER : HERO_TEXT_NO_PROVIDER;

  // Provider IDs for market pulse
  const providerIds = providers.map((p) => p.id);

  // ── LEFT RAIL: Platform Match Navigator ─────────────────────────────
  const leftContent = (
    <PlatformMatchRail
      providers={providers}
      selectedProviderId={selectedProviderId}
      onSelectProvider={handleRailSelectProvider}
    />
  );

  // ── CENTRE: Playground workspace with bidirectional provider sync ───
  // externalProviderId: when left rail navigator selects, workspace follows.
  // onProviderIdChange: when workspace dropdown selects, left rail highlights.
  const centreContent = (
    <MobileBuilderGate
      title="Prompt Lab"
      description="Write once, generate for all 40 platforms. Pick your subject, style, and mood — then switch platforms and watch the same idea reshape itself."
      features={[
        '9-category prompt builder with 10,000+ phrases',
        'Switch platforms instantly — your selections stay, syntax transforms',
        'Side-by-side tier comparison (T1 → T4)',
        'Live weather-driven vocabulary injection',
      ]}
    >
      <PlaygroundWorkspace
        providers={providers}
        onProviderChange={handleProviderChange}
        onProviderIdChange={handleProviderIdChange}
        externalProviderId={selectedProviderId}
        onAssessmentChange={handleAssessmentChange}
        onTierGenerationChange={handleTierGenerationChange}
        onOptimisationChange={handleOptimisationChange}
        onHumanTextChange={handleHumanTextChange}
        onAssembledPromptChange={handleAssembledPromptChange}
      />
    </MobileBuilderGate>
  );

  // ── RIGHT RAIL: Pipeline X-Ray Glass Case (replaces exchange list) ──
  const rightContent = (
    <PipelineXRay
      assessment={xrayAssessment}
      isChecking={xrayIsChecking}
      tierPrompts={xrayTierPrompts}
      isTierGenerating={xrayIsTierGenerating}
      optimiseResult={xrayOptimiseResult}
      isOptimising={xrayIsOptimising}
      platformName={selectedPlatformMeta?.name ?? null}
      platformTier={selectedPlatformMeta?.tier ?? null}
      maxChars={selectedPlatformMeta?.maxChars ?? null}
      scoreResult={scoreResult}
      isScoring={isScoring}
      scoreError={scoreError}
      generationId={generationId}
    />
  );

  return (
    <HomepageGrid
      mainLabel="Prompt Lab — Build and compare prompts across all platforms"
      headingText="Promagen — Prompt Lab"
      heroTextOverride={heroText}
      leftContent={leftContent}
      centre={centreContent}
      rightContent={rightContent}
      showFinanceRibbon={false}
      exchanges={ordered}
      displayedProviderIds={providerIds}
      providers={providers}
      showEngineBay
      showMissionControl
      weatherIndex={weatherIndex}
      isStudioSubPage
      // Glass Case styling for right rail panel (replaces standard ring-white/10)
      rightRailClassName={GLASS_CASE_CLASS}
    />
  );
}
