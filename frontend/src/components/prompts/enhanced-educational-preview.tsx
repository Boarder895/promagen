// src/components/prompts/enhanced-educational-preview.tsx
// ============================================================================
// ENHANCED EDUCATIONAL PREVIEW v2.1.0
// ============================================================================
// Full prompt builder experience for /studio/playground when no provider selected.
// Educational mode: shows all 4 tiers, or single tier when provider selected.
//
// v2.1.0 (Jan 2026):
// - Fixed DNA bar: now stretches FULL WIDTH between dropdown and Market Mood
// - DNA bar shows 12 category segment indicators
// - Beautiful gradient progress bar
// - Creative, visually impressive design
//
// v2.0.0 (Jan 2026):
// - DNA bar moved to header (inline between dropdown and Market Mood)
// - Removed "· Prompt builder" text
// - Provider selection stays on page, shows single tier only
// - All 12 categories in 2-column grid (same order as real prompt builder)
// - Button styling matches /providers/{provider} page
// - Save button added (opens SavePromptModal)
// - Clear button clears provider selection AND selections
//
// Authority: docs/authority/prompt-intelligence.md §9
// ============================================================================

'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Combobox } from '@/components/ui/combobox';
import { FourTierPromptPreview } from '@/components/prompt-builder/four-tier-prompt-preview';
import { IntelligencePanel } from '@/components/prompt-builder/intelligence-panel';
import { SceneSelector } from '@/components/providers/scene-selector';
import { DescribeYourImage } from '@/components/providers/describe-your-image';
import { CompositionModeToggle } from '@/components/composition-mode-toggle';
import { AspectRatioSelector } from '@/components/providers/aspect-ratio-selector';
import { ExploreDrawer } from '@/components/providers/explore-drawer';
import { TextLengthOptimizer } from '@/components/providers/text-length-optimizer';
import { LengthIndicator } from '@/components/providers/length-indicator';
import { OptimizationTransparencyPanel } from '@/components/providers/optimization-transparency-panel';
import { SavePromptModal, type SavePromptData } from '@/components/prompts/save-prompt-modal';
import { SaveIcon } from '@/components/prompts/library/save-icon';
import { useSavedPrompts } from '@/hooks/use-saved-prompts';
import { usePromptAnalysis } from '@/hooks/prompt-intelligence';
import { usePromptOptimization } from '@/hooks/use-prompt-optimization';
import { useAiOptimisation } from '@/hooks/use-ai-optimisation';
import type { OptimisationProviderContext } from '@/hooks/use-ai-optimisation';
import { AlgorithmCycling } from '@/components/prompt-lab/algorithm-cycling';
import { useFeedbackMemory } from '@/hooks/use-feedback-memory';
import FeedbackInvitation from '@/components/ux/feedback-invitation';
import FeedbackMemoryBanner from '@/components/ux/feedback-memory-banner';
import {
  storeFeedbackPending,
  readFeedbackPending,
  isDismissedRecently,
} from '@/lib/feedback/feedback-client';
import type { FeedbackPendingData } from '@/lib/feedback/feedback-client';
import type { FeedbackRating } from '@/types/feedback';
import {
  assemblePrompt,
  assembleStatic,
  formatPromptForCopy,
  getPlatformFormat,
} from '@/lib/prompt-builder';
import { assembleCompositionPack } from '@/lib/composition-engine';
import { postProcessAssembled } from '@/lib/prompt-post-process';
import { incrementLifetimePrompts } from '@/lib/lifetime-counter';
import { rewriteWithSynergy } from '@/lib/weather/synergy-rewriter';
import { loadCategoryVocabulary, detectDominantFamily, type CategoryKey } from '@/lib/vocabulary/vocabulary-loader';
import { getOrderedOptions } from '@/lib/prompt-intelligence';
import { getEnhancedCategoryConfig } from '@/lib/prompt-builder';
import { getPlatformTier } from '@/lib/compress';
import type { AspectRatioId } from '@/types/composition';
import {
  CATEGORY_COLOURS,
  CATEGORY_LABELS,
  CATEGORY_EMOJIS,
  buildTermIndexFromSelections,
  parsePromptIntoSegments,
} from '@/lib/prompt-colours';
import { usePromagenAuth } from '@/hooks/use-promagen-auth';
import {
  CATEGORY_ORDER,
  CATEGORY_META,
  EMPTY_SELECTIONS,
  STANDARD_LIMITS,
  TIER_CONFIGS,
  type PlatformTier,
  type PromptCategory,
  type PromptSelections,
  type GeneratedPrompts,
  type ConflictWarning,
  type StyleSuggestion,
} from '@/types/prompt-intelligence';
import type { CategoryState } from '@/types/prompt-builder';
import type { Provider } from '@/types/providers';
import { getPlatformTierId } from '@/data/platform-tiers';
import { getPromptLimit } from '@/lib/prompt-trimmer';

// ============================================================================
// TYPES
// ============================================================================

export interface EnhancedEducationalPreviewProps {
  providers: Provider[];
  /** Notify parent when provider selection changes (for Listen text only — does NOT trigger view switch) */
  onProviderChange?: (hasProvider: boolean) => void;
  // ── AI Disguise pass-through (lifted from playground-workspace) ────
  /** Called on every "Describe Your Image" textarea change */
  onDescribeTextChange?: (text: string) => void;
  /** Called when "Generate Prompt" clicked — fires Call 2 in parallel */
  onDescribeGenerate?: (sentence: string) => void;
  /** Called when user clicks Clear — resets AI state */
  onDescribeClear?: () => void;
  /** Whether the current text has drifted from last generation */
  isDrifted?: boolean;
  /** Number of word-level changes detected */
  driftChangeCount?: number;
  /** AI-generated tier prompts (overrides template tiers in 4-tier preview) */
  aiTierPrompts?: GeneratedPrompts | null;
  /** Whether AI tier generation is in progress */
  isTierGenerating?: boolean;
  /** Provider name the AI tiers were generated for */
  generatedForProvider?: string | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** All categories in the correct order (matching real prompt builder) */
const DISPLAY_CATEGORIES: PromptCategory[] = CATEGORY_ORDER;

/** Default tier for educational mode when no provider selected */
const DEFAULT_TIER: PlatformTier = 1;

/** Representative platform per tier for 4-tier educational comparison.
 *  assemblePrompt() needs a platformId to format correctly per tier. */
const TIER_REPRESENTATIVE: Record<PlatformTier, string> = {
  1: 'stability',    // CLIP-based (weights, parentheses)
  2: 'midjourney',   // MJ syntax (::weight, --params)
  3: 'openai',       // Natural language (DALL·E 3)
  4: 'canva',        // Plain, simple
};

/** Midjourney family platforms for AR parameter injection */
const MIDJOURNEY_FAMILY = ['midjourney', 'bluewillow', 'niji'];

/** Category dot colors for Selection Echo Strip and Fill Heatmap */
const CATEGORY_COLORS: Record<PromptCategory, string> = {
  subject: '#f472b6',     // pink-400
  action: '#fb923c',      // orange-400
  style: '#a78bfa',       // violet-400
  environment: '#34d399',  // emerald-400
  composition: '#60a5fa',  // blue-400
  camera: '#38bdf8',      // sky-400
  lighting: '#fbbf24',    // amber-400
  atmosphere: '#94a3b8',  // slate-400
  colour: '#f87171',      // red-400
  materials: '#a3e635',   // lime-400
  fidelity: '#2dd4bf',    // teal-400
  negative: '#e879f9',    // fuchsia-400
};

/** Category icon+color map for IntelligencePanel suggestion chips */
const INTELLIGENCE_CATEGORY_META: Record<string, { icon: string; color: string }> = Object.fromEntries(
  CATEGORY_ORDER.map((cat) => [
    cat,
    { icon: CATEGORY_META[cat]?.icon ?? '🔹', color: CATEGORY_COLORS[cat] ?? '#6366f1' },
  ]),
);

// ============================================================================
// LIVE DIFF VIEW — Shows what intelligence adds when toggling Static↔Dynamic
// ============================================================================
// Human factor: Transparency builds trust. Curiosity Gap — users toggle
// back and forth to see what changes. No other prompt builder does this.
// ============================================================================

/** Normalise term for comparison — strip CLIP weight syntax, lowercase, trim */
function normaliseTerm(term: string): string {
  return term
    .replace(/\({1,2}([^)]+?)(?::[0-9.]+)?\){1,2}/g, '$1')
    .replace(/\{+([^}]+?)\}+/g, '$1')
    .replace(/::[0-9.]+/g, '')
    .toLowerCase()
    .trim();
}

interface DiffResult {
  index: number;
  type: 'added' | 'modified';
}

/** Compute term-level diff between old and new prompt text */
function computePromptDiff(oldText: string, newText: string, separator: string = ', '): DiffResult[] {
  if (!oldText.trim() || !newText.trim()) return [];
  const oldTerms = oldText.split(separator).map((t) => t.trim()).filter(Boolean);
  const newTerms = newText.split(separator).map((t) => t.trim()).filter(Boolean);
  const oldNormalised = new Set(oldTerms.map(normaliseTerm));
  const oldExact = new Set(oldTerms);
  const diffs: DiffResult[] = [];
  for (let i = 0; i < newTerms.length; i++) {
    const term = newTerms[i]!;
    const norm = normaliseTerm(term);
    if (!oldNormalised.has(norm)) {
      diffs.push({ index: i, type: 'added' });
    } else if (!oldExact.has(term)) {
      diffs.push({ index: i, type: 'modified' });
    }
  }
  return diffs;
}

/** Render prompt text with highlighted diff terms that fade out */
function DiffHighlightedText({
  text, diffs, separator = ', ', fadingOut,
}: {
  text: string; diffs: DiffResult[]; separator?: string; fadingOut: boolean;
}) {
  const terms = text.split(separator).map((t) => t.trim()).filter(Boolean);
  const diffMap = new Map(diffs.map((d) => [d.index, d.type]));
  return (
    <>
      {terms.map((term, i) => {
        const diffType = diffMap.get(i);
        const isLast = i === terms.length - 1;
        const suffix = !isLast ? separator : '';
        if (!diffType) return <React.Fragment key={i}>{term}{suffix}</React.Fragment>;
        const baseClass = diffType === 'added'
          ? 'bg-emerald-500/25 text-emerald-200 rounded px-0.5 -mx-0.5'
          : 'bg-purple-500/20 text-purple-200 rounded px-0.5 -mx-0.5';
        return (
          <React.Fragment key={i}>
            <span className={`${baseClass} transition-all duration-1000 ease-out ${fadingOut ? 'bg-transparent !text-inherit' : ''}`}>
              {term}
            </span>
            {suffix}
          </React.Fragment>
        );
      })}
    </>
  );
}

// ============================================================================
// DNA BAR (FULL WIDTH HEADER VERSION)
// ============================================================================

interface DnaBarProps {
  selections: PromptSelections;
  dominantFamily: string | null;
  /** Real health score from prompt intelligence engine (0–100) */
  healthScore: number;
  /** Number of detected conflicts */
  conflictCount: number;
  /** Whether any hard conflicts exist */
  hasHardConflicts: boolean;
}

function DnaBar({ selections, dominantFamily, healthScore: _healthScore, conflictCount, hasHardConflicts }: DnaBarProps) {
  // Calculate which categories have selections
  const filledCategories = useMemo(() => {
    return CATEGORY_ORDER.filter((cat: PromptCategory) => selections[cat].length > 0);
  }, [selections]);

  const totalFilled = filledCategories.length;
  const totalCategories = CATEGORY_ORDER.length;

  // ── DNA Score v3.0 — Continuous Weighted Model ───────────────────────
  // 7 scoring dimensions that reward what users actually create:
  //
  //   1. Fill rate (diminishing returns)     0–42 pts
  //   2. Core Identity (graduated S/E/Sty)   0–16 pts
  //   3. Visual Craft (Cam/Comp/Light/Fid)   0–12 pts
  //   4. Style Signal (visual language)      0–5  pts
  //   5. Coherence (family + harmony)        0–6  pts
  //   6. Richness (total term count)         0–7  pts
  //   7. Harmony (conflicts: soft=-2, hard=-6, clean=+7)
  //
  //   Max theoretical: 42+16+12+5+6+7+7 = 95%
  //
  //   Rich photography 11/12: 40+16+12+5+6+7+7  = 93%
  //   Landscape 9/12:         36+13+9+5+6+5+7   = 81%
  //   Decent 6/12:            27+8+3+5+0+3+7    = 53%
  //   Sparse 3/12:            18+8+0+0+0+0+7    = 33%
  //   12/12 with 2 hard:      42+16+12+5+6+7-5  = 83%
  // ─────────────────────────────────────────────────────────────────────
  const score = useMemo(() => {
    if (totalFilled === 0) return 0;

    // ── 1. Fill rate — diminishing returns curve (0–42) ──────────────
    // Power curve: rewards getting to 9+ categories generously,
    // but first 3 categories still earn meaningful points.
    const fillScore = Math.round(42 * Math.pow(totalFilled / 12, 0.55));

    // ── 2. Core Identity — graduated (0–16) ─────────────────────────
    const hasSubject = (selections.subject?.length ?? 0) > 0;
    const hasEnvironment = (selections.environment?.length ?? 0) > 0;
    const hasStyle = (selections.style?.length ?? 0) > 0;
    const coreCount = (hasSubject ? 1 : 0) + (hasEnvironment ? 1 : 0) + (hasStyle ? 1 : 0);
    const identityScore = coreCount === 3 ? 16 : coreCount === 2 ? 13 : coreCount === 1 ? 8 : 0;

    // ── 3. Visual Craft — Camera, Composition, Lighting, Fidelity (0–12) ─
    const craftCategories = [
      (selections.camera?.length ?? 0) > 0,
      (selections.composition?.length ?? 0) > 0,
      (selections.lighting?.length ?? 0) > 0,
      (selections.fidelity?.length ?? 0) > 0,
    ];
    const craftCount = craftCategories.filter(Boolean).length;
    const craftScore = craftCount === 4 ? 12 : craftCount === 3 ? 9 : craftCount === 2 ? 6 : craftCount === 1 ? 3 : 0;

    // ── 4. Style Signal (0–5) ────────────────────────────────────────
    const styleScore = hasStyle ? 5 : 0;

    // ── 5. Coherence — family detection (0–6) ────────────────────────
    // Family detected = strong signal. No family but clean = implicit coherence.
    const familyScore = dominantFamily ? 6 : (conflictCount === 0 && totalFilled >= 3 ? 3 : 0);

    // ── 6. Richness — total terms across all categories (0–7) ────────
    const totalTerms = CATEGORY_ORDER.reduce(
      (sum: number, cat: PromptCategory) => sum + (selections[cat]?.length ?? 0), 0,
    );
    const richnessScore = totalTerms >= 15 ? 7 : totalTerms >= 10 ? 5 : totalTerms >= 5 ? 3 : 0;

    // ── 7. Harmony — conflicts with soft/hard distinction ────────────
    // Clean prompt: +7 bonus. Soft conflicts: -2 each. Hard: -6 each.
    // Floor at -15 so conflicts can't nuke the entire score.
    let harmonyScore = 7; // start with clean bonus
    if (conflictCount > 0) {
      if (hasHardConflicts) {
        // Assume at least 1 hard; remaining are soft
        harmonyScore = 7 - 6 - ((conflictCount - 1) * 2);
      } else {
        // All soft
        harmonyScore = 7 - (conflictCount * 2);
      }
      harmonyScore = Math.max(-15, harmonyScore);
    }

    const total = fillScore + identityScore + craftScore + styleScore + familyScore + richnessScore + harmonyScore;
    return Math.max(0, Math.min(100, total));
  }, [totalFilled, selections, dominantFamily, conflictCount, hasHardConflicts]);

  // Color based on score
  const scoreColor =
    score > 70 ? 'text-emerald-400' : score > 40 ? 'text-yellow-400' : 'text-slate-400';

  const barGradient =
    score > 70
      ? 'from-emerald-500 via-teal-400 to-cyan-400'
      : score > 40
        ? 'from-yellow-500 via-amber-400 to-orange-400'
        : 'from-slate-500 via-slate-400 to-slate-500';

  return (
    <div className="flex-1 flex items-center gap-3 rounded-xl bg-gradient-to-r from-slate-900/90 to-slate-800/90 border border-white/10 px-4 py-2.5 min-w-0">
      {/* DNA Icon + Label */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-lg">🧬</span>
        <span className="text-xs font-medium text-white/60 hidden sm:inline">Prompt DNA</span>
      </div>

      {/* Progress Bar Container - Stretches to fill */}
      <div className="flex-1 min-w-0">
        {/* Main progress bar — score only, no secondary bar */}
        <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${barGradient} transition-all duration-700 ease-out`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      {/* Score Display */}
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-xl font-bold tabular-nums ${scoreColor}`}>{score}%</span>
        <div className="flex flex-col shrink-0 hidden md:flex">
          <span className="text-slate-400" style={{ fontSize: 'clamp(9px, 0.6vw, 11px)' }}>
            {totalFilled}/{totalCategories} filled
          </span>
          {conflictCount > 0 && (
            <span className="text-amber-400" style={{ fontSize: 'clamp(9px, 0.6vw, 11px)' }}>
              ⚠ {conflictCount} conflict{conflictCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Family Badge */}
      {dominantFamily && (
        <div className="shrink-0 px-2.5 py-1 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/40 rounded-full">
          <span className="font-medium text-purple-300 capitalize whitespace-nowrap" style={{ fontSize: 'clamp(9px, 0.6vw, 11px)' }}>
            {dominantFamily}
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CATEGORY DROPDOWN COMPONENT
// ============================================================================

interface CategoryDropdownProps {
  category: PromptCategory;
  selections: string[];
  onSelectionChange: (selections: string[]) => void;
  disabled?: boolean;
  tier: PlatformTier;
  /** Smart-reordered options (Phase L6) — when provided, replaces default vocabulary order */
  reorderedOptions?: string[];
  /** Pro Promagen: colour for category label heading */
  labelColour?: string;
}

function CategoryDropdown({
  category,
  selections,
  onSelectionChange,
  disabled = false,
  tier,
  reorderedOptions,
  labelColour,
}: CategoryDropdownProps) {
  const meta = CATEGORY_META[category];
  const limit = STANDARD_LIMITS[tier][category];

  // Load vocabulary for this category
  const vocabulary = useMemo(() => {
    return loadCategoryVocabulary(category as CategoryKey);
  }, [category]);

  // Use reordered options if provided, otherwise default vocabulary order
  const displayOptions = reorderedOptions ?? vocabulary.dropdownOptions;

  const handleSelectChange = useCallback(
    (newSelections: string[]) => {
      // Enforce limit
      const limited = newSelections.slice(0, limit);
      onSelectionChange(limited);
    },
    [limit, onSelectionChange],
  );

  const handleCustomChange = useCallback(() => {
    // No-op for now
  }, []);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-base">{meta.icon}</span>
        <span
          className="text-xs font-medium text-slate-300"
          style={labelColour ? { color: labelColour } : undefined}
        >
          {meta.label}
        </span>
        {selections.length > 0 && (
          <span className="text-xs text-emerald-400">
            {selections.length}/{limit}
          </span>
        )}
      </div>
      <Combobox
        id={`edu-${category}`}
        label={meta.label}
        options={displayOptions}
        selected={selections}
        customValue=""
        onSelectChange={handleSelectChange}
        onCustomChange={handleCustomChange}
        placeholder={`Select ${meta.label.toLowerCase()}...`}
        maxSelections={limit}
        allowFreeText={category === 'negative'}
        isLocked={disabled}
        compact
      />
    </div>
  );
}

// ============================================================================
// PROVIDER SELECTOR COMPONENT
// ============================================================================

interface ProviderSelectorProps {
  providers: Provider[];
  selectedId: string | null;
  onSelect: (providerId: string | null) => void;
}

function ProviderSelector({ providers, selectedId, onSelect }: ProviderSelectorProps) {
  const nameToId = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of providers) {
      map.set(p.name, p.id);
    }
    return map;
  }, [providers]);

  const idToName = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of providers) {
      map.set(p.id, p.name);
    }
    return map;
  }, [providers]);

  const options = useMemo(() => {
    return providers
      .map((p) => p.name)
      .sort((a, b) => {
        const aNum = /^\d/.test(a);
        const bNum = /^\d/.test(b);
        if (aNum && !bNum) return 1;
        if (!aNum && bNum) return -1;
        return a.localeCompare(b);
      });
  }, [providers]);

  const selected = useMemo(() => {
    if (!selectedId) return [];
    const name = idToName.get(selectedId);
    return name ? [name] : [];
  }, [selectedId, idToName]);

  const handleSelectChange = useCallback(
    (selectedNames: string[]) => {
      if (selectedNames.length === 0) {
        onSelect(null);
        return;
      }
      const name = selectedNames[0];
      if (name === undefined) return;
      const id = nameToId.get(name);
      if (id !== undefined) {
        onSelect(id);
      }
    },
    [nameToId, onSelect],
  );

  const handleCustomChange = useCallback(() => {}, []);

  return (
    <div className="w-[220px] shrink-0">
      <Combobox
        id="edu-provider-selector"
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
// REAL INTELLIGENCE — Wired to the full prompt-intelligence engine
// ============================================================================
// Replaces the former useMockIntelligence (v2.1.0) which had 1 hardcoded
// conflict pair. Now uses the same analyzePrompt() pipeline as the real
// prompt builder — 85 conflict groups, real DNA scoring, real suggestions.
//
// Maps real engine types (DetectedConflict, SuggestedOption) to the shapes
// IntelligencePanel expects (ConflictWarning, StyleSuggestion) so the panel
// component requires zero changes.
// ============================================================================

function useRealIntelligence(
  selections: PromptSelections,
  selectedProviderId: string | null,
  hasContent: boolean,
) {
  // Build PromptState from educational preview selections
  // Use 'stability' as default platformId when none selected (Tier 1, CLIP-based)
  const platformId = selectedProviderId ?? 'stability';

  const { analysis, conflictCount, hasHardConflicts, healthScore } = usePromptAnalysis(
    {
      subject: selections.subject?.[0] ?? '',
      selections: selections as Partial<Record<PromptCategory, string[]>>,
      negatives: selections.negative ?? [],
      platformId,
    },
    {
      enabled: hasContent,
      debounceMs: 200,
    },
  );

  // Map DetectedConflict[] → ConflictWarning[] for IntelligencePanel
  const conflicts: ConflictWarning[] = useMemo(() => {
    if (!analysis?.conflicts?.conflicts) return [];
    return analysis.conflicts.conflicts.map((c) => ({
      term1: c.terms[0] ?? '',
      term2: c.terms[1] ?? c.terms[0] ?? '',
      severity: (c.severity === 'hard' ? 'high' : 'medium') as ConflictWarning['severity'],
      reason: c.reason,
      category1: c.categories[0] ?? ('style' as PromptCategory),
      category2: c.categories[1] ?? c.categories[0] ?? ('style' as PromptCategory),
    }));
  }, [analysis]);

  // Map SuggestedOption[] → StyleSuggestion[] for IntelligencePanel
  // Store category in familyId so click handler can route to correct category
  const suggestions: StyleSuggestion[] = useMemo(() => {
    if (!analysis?.suggestions?.suggestions) return [];
    const all: StyleSuggestion[] = [];
    for (const [category, opts] of Object.entries(analysis.suggestions.suggestions)) {
      if (!opts) continue;
      for (const opt of opts) {
        all.push({
          term: opt.option,
          reason: opt.reason,
          familyId: category, // Used by click handler to route to correct category
          confidence: Math.min(1, opt.score / 100),
        });
      }
    }
    // Sort by confidence descending, take top 6
    all.sort((a, b) => b.confidence - a.confidence);
    return all.slice(0, 6);
  }, [analysis]);

  // Real platform hints from analysis
  const platformHints: string[] = useMemo(() => {
    const tier = getPlatformTier(platformId);
    const hints: string[] = [];
    if (tier === 1) hints.push('💡 Tier 1 (CLIP): Use (term:1.2) weights for emphasis');
    if (tier === 2) hints.push('💡 Tier 2 (MJ): Add --ar 16:9 for aspect ratio');
    if (tier === 3) hints.push('💡 Tier 3 (NatLang): Write naturally, describe the scene');
    if (tier === 4) hints.push('💡 Tier 4 (Plain): Keep it simple, fewer terms work better');
    if (conflictCount > 0) {
      hints.push(`⚠️ ${conflictCount} conflict${conflictCount > 1 ? 's' : ''} detected — review your selections`);
    }
    return hints;
  }, [platformId, conflictCount]);

  // Weather suggestions from market mood (if available)
  const weatherSuggestions: string[] = useMemo(() => {
    if (!analysis?.marketSuggestions?.length) return [];
    return analysis.marketSuggestions.map((s) => s.option);
  }, [analysis]);

  return { conflicts, suggestions, platformHints, weatherSuggestions, healthScore, hasHardConflicts, conflictCount };
}

// ============================================================================
// STAGE BADGE — shows pipeline stage: Static | Dynamic | Optimized | Optimal
// Matches standard builder's StageBadge (prompt-builder.tsx)
// ============================================================================

function StageBadge({
  compositionMode,
  isOptimizerEnabled,
  wasOptimized,
}: {
  compositionMode: 'static' | 'dynamic';
  isOptimizerEnabled: boolean;
  wasOptimized: boolean;
}) {
  if (compositionMode === 'static') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md border border-slate-600/50 bg-slate-800/60 px-1.5 py-0.5 font-medium text-slate-200"
        style={{ fontSize: 'clamp(10px, 0.65vw, 11px)' }}
        title="Raw selections — no intelligence applied. What you pick is what you get."
      >
        📋 Static
      </span>
    );
  }
  if (isOptimizerEnabled && wasOptimized) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-medium text-emerald-400"
        style={{ fontSize: 'clamp(10px, 0.65vw, 11px)' }}
        title="Platform-formatted AND trimmed to optimal length for best results."
      >
        ⚡ Optimized
      </span>
    );
  }
  if (isOptimizerEnabled && !wasOptimized) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-950/30 px-1.5 py-0.5 font-medium text-emerald-400"
        style={{ fontSize: 'clamp(10px, 0.65vw, 11px)' }}
        title="Platform-formatted and already within optimal length."
      >
        ✓ Optimal
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border border-purple-500/30 bg-purple-500/10 px-1.5 py-0.5 font-medium text-purple-400"
      style={{ fontSize: 'clamp(10px, 0.65vw, 11px)' }}
      title="Platform intelligence applied — reordered, weighted, quality tags added."
    >
      ✨ Dynamic
    </span>
  );
}

// ============================================================================
// CATEGORY COLOUR LEGEND — Pro-only tooltip showing 13 category→colour map
// Matches standard builder's restyled legend (prompt-builder.tsx)
// 400ms close delay, solid bg, no opacity, min 10px font
// ============================================================================

function LabCategoryColourLegend({ isPro }: { isPro: boolean }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const closeTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const startCloseDelay = React.useCallback(() => {
    closeTimerRef.current = setTimeout(() => setIsOpen(false), 400);
  }, []);
  const cancelCloseDelay = React.useCallback(() => {
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
  }, []);
  React.useEffect(() => {
    return () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); };
  }, []);

  if (!isPro) return null;

  const categories: PromptCategory[] = [
    'subject', 'action', 'style', 'environment', 'composition', 'camera',
    'lighting', 'colour', 'atmosphere', 'materials', 'fidelity', 'negative',
  ];

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-lg px-1.5 py-1 transition-all cursor-pointer bg-white/5 hover:bg-white/10"
        style={{ fontSize: 'clamp(18px, 1.4vw, 22px)' }}
        onMouseEnter={() => { cancelCloseDelay(); setIsOpen(true); }}
        onMouseLeave={startCloseDelay}
        onClick={() => setIsOpen((o) => !o)}
        title="Prompt colour key — Pro Promagen"
        aria-label="Show category colour legend"
      >
        🎨
      </button>
      {isOpen && (
        <div
          className="absolute left-1/2 -translate-x-1/2 top-full z-[9999] mt-2 rounded-xl border border-slate-700 shadow-2xl"
          style={{
            width: 'clamp(280px, 22vw, 340px)',
            background: 'rgba(15, 23, 42, 0.97)',
            backdropFilter: 'blur(16px)',
          }}
          onMouseEnter={cancelCloseDelay}
          onMouseLeave={startCloseDelay}
        >
          {/* Ethereal glow overlay */}
          <div className="pointer-events-none absolute inset-0 rounded-xl overflow-hidden">
            <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(56,189,248,0.06), transparent)' }} />
          </div>
          {/* Arrow */}
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-3 w-3 rotate-45 border-l border-t border-slate-700" style={{ background: 'rgba(15, 23, 42, 0.97)' }} />
          <div className="relative px-4 py-3">
            <p className="font-semibold text-white mb-3" style={{ fontSize: 'clamp(12px, 0.85vw, 14px)' }}>
              Category Colour Key
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {categories.map((cat) => (
                <div key={cat} className="flex items-center gap-2">
                  <span className="inline-block rounded-full flex-shrink-0" style={{ width: 'clamp(8px, 0.6vw, 10px)', height: 'clamp(8px, 0.6vw, 10px)', backgroundColor: CATEGORY_COLOURS[cat] }} />
                  <span className="truncate" style={{ fontSize: 'clamp(11px, 0.75vw, 13px)', color: CATEGORY_COLOURS[cat] }}>
                    {CATEGORY_EMOJIS[cat]} {CATEGORY_LABELS[cat]}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <span className="inline-block rounded-full flex-shrink-0" style={{ width: 'clamp(8px, 0.6vw, 10px)', height: 'clamp(8px, 0.6vw, 10px)', backgroundColor: CATEGORY_COLOURS.structural }} />
                <span className="truncate" style={{ fontSize: 'clamp(11px, 0.75vw, 13px)', color: CATEGORY_COLOURS.structural }}>
                  ✏️ Structural
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </span>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function EnhancedEducationalPreview({
  providers,
  onProviderChange: _onProviderChange,
  // AI Disguise pass-through (from playground-workspace orchestrator)
  onDescribeTextChange,
  onDescribeGenerate,
  onDescribeClear,
  isDrifted,
  driftChangeCount,
  aiTierPrompts,
  isTierGenerating,
  generatedForProvider,
}: EnhancedEducationalPreviewProps) {
  // State
  const [selections, setSelections] = useState<PromptSelections>(EMPTY_SELECTIONS);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savedConfirmation, setSavedConfirmation] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedOptimized, setCopiedOptimized] = useState(false);
  const [copiedAssembled, setCopiedAssembled] = useState(false);

  // Composition mode: 'static' = raw selections, 'dynamic' = platform-formatted
  const [compositionMode, setCompositionMode] = useState<'static' | 'dynamic'>('dynamic');

  // Aspect ratio state (Phase L3)
  const [aspectRatio, setAspectRatio] = useState<AspectRatioId | null>(null);

  // Live Diff state — tracks previous prompt for comparison
  const prevPromptRef = useRef<string>('');
  const [diffData, setDiffData] = useState<{ diffs: DiffResult[]; text: string } | null>(null);
  const [diffFading, setDiffFading] = useState(false);
  const prevModeRef = useRef(compositionMode);

  // Explore Drawer accordion state — only one category expanded at a time
  const [expandedExploreCategory, setExpandedExploreCategory] = useState<PromptCategory | null>(null);

  // Feedback system state (Phase L7)
  const [feedbackPending, setFeedbackPending] = useState<FeedbackPendingData | null>(null);
  const { getOverlap } = useFeedbackMemory();

  // Check for pending feedback on mount
  useEffect(() => {
    if (isDismissedRecently()) return;
    const pending = readFeedbackPending();
    if (pending) setFeedbackPending(pending);
  }, []);

  // Feedback overlap detection
  const feedbackOverlap = useMemo(
    () => getOverlap(
      selectedProviderId ?? 'playground',
      selections as PromptSelections,
    ),
    [selections, getOverlap, selectedProviderId],
  );

  // Save hook
  const { savePrompt } = useSavedPrompts();

  // ── Pro Promagen: Auth + colour-coded prompt anatomy ───────────────────
  const { userTier } = usePromagenAuth({
    platformId: selectedProviderId ?? undefined,
  });
  const isPro = userTier === 'paid';

  // Build term → category index for colour coding (same as standard builder)
  const colourTermIndex = useMemo(() => {
    if (!isPro) return new Map<string, PromptCategory>();
    return buildTermIndexFromSelections(selections);
  }, [isPro, selections]);

  // Scene Starters state
  const [_activeSceneId, setActiveSceneId] = useState<string | undefined>(undefined);

  // ── CategoryState adapter for SceneSelector ──
  // SceneSelector reads/writes Record<PromptCategory, CategoryState>.
  // Educational preview uses PromptSelections (Record<string, string[]>).
  // This adapter bridges the two formats without changing either component.
  const categoryStateForScene = useMemo(() => {
    const state: Record<PromptCategory, CategoryState> = {} as Record<PromptCategory, CategoryState>;
    for (const cat of CATEGORY_ORDER) {
      state[cat] = {
        selected: selections[cat] ?? [],
        customValue: '',
      };
    }
    return state;
  }, [selections]);

  const setCategoryStateAdapter: React.Dispatch<
    React.SetStateAction<Record<PromptCategory, CategoryState>>
  > = useCallback(
    (action) => {
      setSelections((prev) => {
        // Build current categoryState from prev selections
        const currentCatState: Record<PromptCategory, CategoryState> = {} as Record<PromptCategory, CategoryState>;
        for (const cat of CATEGORY_ORDER) {
          currentCatState[cat] = {
            selected: prev[cat] ?? [],
            customValue: '',
          };
        }
        // Apply the action (function or value)
        const nextCatState =
          typeof action === 'function' ? action(currentCatState) : action;
        // Convert back to PromptSelections — merge customValue into selected
        // so terms that didn't match vocabulary aren't silently dropped.
        // The Combobox will display them as custom chips.
        const nextSelections: PromptSelections = { ...prev };
        for (const cat of CATEGORY_ORDER) {
          const catState = nextCatState[cat];
          const selected = catState?.selected ?? [];
          const customTerms = catState?.customValue?.trim()
            ? catState.customValue
                .split(',')
                .map((t: string) => t.trim())
                .filter((t: string) => t.length > 0 && !selected.includes(t))
            : [];
          nextSelections[cat] = [...selected, ...customTerms];
        }
        return nextSelections;
      });
    },
    [],
  );

  const handleActiveSceneChange = useCallback(
    (sceneId: string | undefined, _prefills?: Record<string, string[]>) => {
      setActiveSceneId(sceneId);
    },
    [],
  );

  // Active tier — clickable by user OR set by provider selection
  const [activeTier, setActiveTier] = useState<PlatformTier>(DEFAULT_TIER);

  // Sync activeTier when provider changes
  useEffect(() => {
    if (selectedProviderId) {
      const tier = getPlatformTier(selectedProviderId) as PlatformTier;
      setActiveTier(tier);
    }
  }, [selectedProviderId]);

  // Get selected provider object
  const selectedProvider = useMemo(() => {
    if (!selectedProviderId) return null;
    return providers.find((p) => p.id === selectedProviderId) ?? null;
  }, [selectedProviderId, providers]);

  // Detect dominant family from selections
  const dominantFamily = useMemo(() => {
    const allTerms = Object.values(selections).flat();
    return detectDominantFamily(allTerms);
  }, [selections]);

  // ============================================================================
  // 3-Stage Assembly Pipeline (One Brain)
  // ============================================================================
  // Stage 1 (Static):  assembleStatic()  — raw comma join in CATEGORY_ORDER
  // Stage 2 (Dynamic): assemblePrompt(skipTrim: true) — platform formatting
  // Post-process: postProcessAssembled() — polish pass (Dynamic only)
  //
  // Runs once per tier using representative platforms, producing the same
  // GeneratedPrompts shape the FourTierPromptPreview expects.
  // ============================================================================

  const generatedPrompts: GeneratedPrompts = useMemo(() => {
    const result: GeneratedPrompts = {
      tier1: '', tier2: '', tier3: '', tier4: '',
      negative: { tier1: '', tier2: '', tier3: '', tier4: '' },
    };

    // Synergy rewrite (Dynamic only) — same pass the real builder runs
    const rewritten = compositionMode === 'dynamic'
      ? rewriteWithSynergy(selections).selections
      : selections;

    for (const tier of [1, 2, 3, 4] as PlatformTier[]) {
      // Use selected provider for its tier, representative for others
      const platformId = (selectedProviderId && getPlatformTier(selectedProviderId) === tier)
        ? selectedProviderId
        : TIER_REPRESENTATIVE[tier];

      let assembled;
      if (compositionMode === 'static') {
        // Stage 1: Raw user selections, no intelligence
        assembled = assembleStatic(platformId, selections);
      } else {
        // Stage 2: Full platform-specific formatting (skipTrim — no optimizer in preview)
        const raw = assemblePrompt(platformId, rewritten, undefined, { skipTrim: true });
        // Post-process polish (leak phrases, dedup, grammar)
        const atmosHint = (selections.atmosphere ?? []).join(' ');
        assembled = postProcessAssembled(raw, tier, atmosHint);
      }

      const tierKey = `tier${tier}` as keyof Omit<GeneratedPrompts, 'negative'>;
      result[tierKey] = formatPromptForCopy(assembled);
      result.negative[tierKey as keyof GeneratedPrompts['negative']] = assembled.negative ?? '';
    }

    return result;
  }, [selections, compositionMode, selectedProviderId]);

  // ============================================================================
  // Aspect Ratio Composition Pack (Phase L3)
  // ============================================================================
  const compositionPack = useMemo(() => {
    if (!aspectRatio) return null;
    const platformId = selectedProviderId ?? 'stability';
    return assembleCompositionPack(platformId, aspectRatio, compositionMode, selections);
  }, [aspectRatio, selectedProviderId, compositionMode, selections]);

  // Active tier prompt text (for copy, diff, and "What If")
  // Fix 6: Prefers AI tier text (Call 2) when available. Falls back to template text.
  // This is THE critical fix — the assembled prompt box and Call 3 input both use this,
  // so AI-quality text flows through the entire pipeline, not lossy template text.
  const activeTierPromptText = useMemo(() => {
    const tierKey = `tier${activeTier}` as keyof Omit<GeneratedPrompts, 'negative'>;

    // AI tier text takes priority when available
    const source = aiTierPrompts ?? generatedPrompts;
    let text = source[tierKey] ?? '';

    // Inject AR composition if present (applies to both AI and template text)
    if (compositionPack) {
      const platformId = selectedProviderId ?? TIER_REPRESENTATIVE[activeTier];
      if (compositionPack.text) {
        // Inject composition text before --no for MJ family
        const isMJ = MIDJOURNEY_FAMILY.includes(platformId.toLowerCase());
        if (isMJ && text.includes(' --no ')) {
          const parts = text.split(' --no ');
          text = `${(parts[0] ?? '').trim()}, ${compositionPack.text} --no ${parts[1] ?? ''}`;
        } else if (text) {
          text = `${text.trim()}, ${compositionPack.text}`;
        }
      }
      if (compositionPack.useNativeAR && compositionPack.arParameter) {
        text = `${text.trim()} ${compositionPack.arParameter}`;
      }
    }
    return text;
  }, [generatedPrompts, aiTierPrompts, activeTier, compositionPack, selectedProviderId]);

  // ============================================================================
  // Live Diff — tracks mode changes and computes visual diff (3s fade)
  // ============================================================================
  useEffect(() => {
    if (prevModeRef.current !== compositionMode && prevPromptRef.current && activeTierPromptText) {
      const diffs = computePromptDiff(prevPromptRef.current, activeTierPromptText);
      if (diffs.length > 0) {
        setDiffData({ diffs, text: activeTierPromptText });
        setDiffFading(false);
        // Start fade after 1.5s, clear after 3s
        const fadeTimer = setTimeout(() => setDiffFading(true), 1500);
        const clearTimer = setTimeout(() => setDiffData(null), 3000);
        prevModeRef.current = compositionMode;
        prevPromptRef.current = activeTierPromptText;
        return () => { clearTimeout(fadeTimer); clearTimeout(clearTimer); };
      }
    }
    prevModeRef.current = compositionMode;
    prevPromptRef.current = activeTierPromptText;
  }, [compositionMode, activeTierPromptText]);

  // ============================================================================
  // Smart Dropdown Reorder (Phase L6)
  // ============================================================================
  // Options reorder by relevance as user builds — cyberpunk-adjacent terms
  // float to the top when cyberpunk is selected. Same engine as real builder.
  // Human factor: Optimal Stimulation — options rearrange, creating discovery.
  // ============================================================================
  const reorderedOptionsMap = useMemo(() => {
    const map = new Map<PromptCategory, string[]>();
    const anyContent = Object.values(selections).some((arr) => arr.length > 0);
    if (!anyContent) return map;

    for (const cat of DISPLAY_CATEGORIES) {
      if (cat === 'negative') continue;
      const config = getEnhancedCategoryConfig(cat);
      if (!config || config.options.length === 0) continue;

      const scored = getOrderedOptions({
        options: config.options,
        category: cat,
        selections: selections as Partial<Record<PromptCategory, string[]>>,
      });

      map.set(cat, scored.map((s) => s.option));
    }
    return map;
  }, [selections]);

  // Check if we have any content
  const hasContent = useMemo(() => {
    return Object.values(selections).some((arr) => arr.length > 0);
  }, [selections]);

  // Get intelligence data — real engine (85 conflict groups, DNA scoring, suggestions)
  const { conflicts, suggestions, platformHints, weatherSuggestions, healthScore: realHealthScore, hasHardConflicts: realHasHardConflicts, conflictCount: realConflictCount } =
    useRealIntelligence(selections, selectedProviderId, hasContent);

  // ============================================================================
  // Text Length Optimizer (Phase L4)
  // ============================================================================
  const optimizerPlatformId = selectedProviderId ?? 'stability';

  const {
    isOptimizerEnabled,
    setOptimizerEnabled,
    analysis: optimizerAnalysis,
    getOptimizedPrompt,
    isToggleDisabled: isOptimizerDisabled,
    tooltipContent: optimizerTooltipContent,
  } = usePromptOptimization({
    platformId: optimizerPlatformId,
    promptText: activeTierPromptText,
    selections,
    compositionMode,
  });

  const optimizedResult = useMemo(() => getOptimizedPrompt(), [getOptimizedPrompt]);
  const wasOptimized = optimizedResult.optimizedLength < optimizedResult.originalLength;

  // ── Optimizer disabled in neutral mode (no provider selected) ──────────
  // Prevents silently optimising for Stability when user hasn't chosen a platform.
  const finalOptimizerDisabled = isOptimizerDisabled || !selectedProviderId;
  const finalTooltipContent = !selectedProviderId
    ? {
        maxChars: '—',
        sweetSpot: '—',
        platformNote: 'Select an AI provider above to enable optimisation.',
        benefit: 'The optimizer trims your prompt to the ideal length for the selected platform.',
        qualityImpact: 'Each platform has different character limits and sweet spots.',
      }
    : optimizerTooltipContent;

  // ============================================================================
  // AI Disguise: Call 3 — AI Prompt Optimisation (ai-disguise.md §6)
  // ============================================================================
  // When optimizer is toggled ON with a provider selected, fires Call 3.
  // AlgorithmCycling animation plays during the API call (§3 Anticipatory Dopamine).
  // Client-side optimizer still runs for the length indicator bar.
  // AI result overrides client-side result in display when available.

  const {
    result: aiOptimiseResult,
    isOptimising: isAiOptimising,
    animationPhase,
    currentAlgorithm,
    algorithmCount,
    optimise: aiOptimise,
    clear: clearAiOptimise,
  } = useAiOptimisation();

  // Build OptimisationProviderContext from platform data
  const aiOptimiseContext = useMemo((): OptimisationProviderContext | null => {
    if (!selectedProviderId) return null;
    const tier = getPlatformTierId(selectedProviderId);
    if (!tier) return null;
    const format = getPlatformFormat(selectedProviderId);
    const limits = getPromptLimit(selectedProviderId);
    return {
      name: selectedProvider?.name ?? selectedProviderId,
      tier,
      promptStyle: format.promptStyle,
      sweetSpot: format.sweetSpot ?? 100,
      tokenLimit: format.tokenLimit ?? 200,
      maxChars: limits.maxChars,
      idealMin: limits.idealMin,
      idealMax: limits.idealMax,
      qualityPrefix: format.qualityPrefix,
      weightingSyntax: format.weightingSyntax,
      supportsWeighting: format.supportsWeighting,
      negativeSupport: format.negativeSupport,
      categoryOrder: format.categoryOrder,
    };
  }, [selectedProviderId, selectedProvider?.name]);

  // Fire Call 3 when optimizer toggled ON, and re-fire debounced when text changes while ON
  // Fix 3: Aspect ratio / selection changes re-fire Call 3 so the optimised prompt stays in sync
  const prevOptimizerEnabledRef = useRef(false);
  const prevPromptTextRef = useRef('');
  const reFireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const wasEnabled = prevOptimizerEnabledRef.current;
    const prevText = prevPromptTextRef.current;
    prevOptimizerEnabledRef.current = isOptimizerEnabled;
    prevPromptTextRef.current = activeTierPromptText;

    // Toggled OFF → clear
    if (!isOptimizerEnabled && wasEnabled) {
      clearAiOptimise();
      if (reFireTimerRef.current) clearTimeout(reFireTimerRef.current);
      return;
    }

    // Not enabled or missing requirements → skip
    if (!isOptimizerEnabled || !selectedProviderId || !activeTierPromptText || !aiOptimiseContext) {
      return;
    }

    // Just toggled ON → fire immediately
    if (!wasEnabled) {
      aiOptimise(activeTierPromptText, selectedProviderId, aiOptimiseContext);
      return;
    }

    // Already ON and text changed → debounced re-fire (800ms)
    if (activeTierPromptText !== prevText) {
      if (reFireTimerRef.current) clearTimeout(reFireTimerRef.current);
      reFireTimerRef.current = setTimeout(() => {
        aiOptimise(activeTierPromptText, selectedProviderId, aiOptimiseContext);
      }, 800);
    }

    return () => {
      if (reFireTimerRef.current) clearTimeout(reFireTimerRef.current);
    };
  }, [isOptimizerEnabled, selectedProviderId, activeTierPromptText, aiOptimiseContext, aiOptimise, clearAiOptimise]);

  // Effective optimised values: AI result takes priority over client-side
  const effectiveOptimisedText = aiOptimiseResult?.optimised ?? optimizedResult.optimized;
  const effectiveOptimisedLength = aiOptimiseResult?.charCount ?? optimizedResult.optimizedLength;
  const effectiveWasOptimized = aiOptimiseResult
    ? effectiveOptimisedLength < optimizedResult.originalLength
    : wasOptimized;

  // Suggested save name
  const suggestedSaveName = useMemo(() => {
    const subject = selections.subject[0];
    const style = selections.style[0];
    if (subject && style) return `${subject} - ${style}`;
    if (subject) return subject;
    if (style) return style;
    return 'Untitled Prompt';
  }, [selections]);

  // Handle provider selection — stays in educational preview (no view switch)
  // Only notifies parent for heroText / Listen button text changes
  const handleProviderSelect = useCallback((providerId: string | null) => {
    setSelectedProviderId(providerId);
    _onProviderChange?.(!!providerId);
  }, [_onProviderChange]);

  // Handle category selection change
  const handleCategoryChange = useCallback((category: PromptCategory, newSelections: string[]) => {
    setSelections((prev) => ({
      ...prev,
      [category]: newSelections,
    }));
  }, []);

  // Handle suggestion click — routes to correct category via familyId
  const handleSuggestionClick = useCallback(
    (suggestion: StyleSuggestion) => {
      // familyId holds the real category (set by useRealIntelligence mapping)
      const category = suggestion.familyId as PromptCategory;
      const validCategory = CATEGORY_ORDER.includes(category) ? category : 'style';
      setSelections((prev) => ({
        ...prev,
        [validCategory]: [...prev[validCategory], suggestion.term].slice(
          0,
          STANDARD_LIMITS[activeTier][validCategory],
        ),
      }));
    },
    [activeTier],
  );

  // Handle mood term click
  const handleMoodTermClick = useCallback(
    (term: string, category: 'atmosphere' | 'colour' | 'lighting') => {
      setSelections((prev) => ({
        ...prev,
        [category]: [...prev[category], term].slice(0, STANDARD_LIMITS[activeTier][category]),
      }));
    },
    [activeTier],
  );

  // Handle randomise
  const handleRandomise = useCallback(() => {
    const newSelections: PromptSelections = { ...EMPTY_SELECTIONS };

    for (const category of DISPLAY_CATEGORIES) {
      const vocab = loadCategoryVocabulary(category as CategoryKey);
      const limit = STANDARD_LIMITS[activeTier][category];
      const shuffled = [...vocab.dropdownOptions].sort(() => Math.random() - 0.5);
      newSelections[category] = shuffled.slice(
        0,
        Math.min(limit, Math.ceil(Math.random() * limit)),
      );
    }

    setSelections(newSelections);
  }, [activeTier]);

  // Handle clear all (clears selections AND provider AND scene AND AR AND drawer)
  const handleClear = useCallback(() => {
    setSelections(EMPTY_SELECTIONS);
    setSelectedProviderId(null);
    setActiveSceneId(undefined);
    setAspectRatio(null);
    setDiffData(null);
    setExpandedExploreCategory(null);
  }, []);

  // Handle tier selection — user clicks a tier card to highlight it
  const handleTierSelect = useCallback((tier: PlatformTier) => {
    setActiveTier(tier);
  }, []);

  // Handle copy — uses optimized text when optimizer is on, otherwise activeTierPromptText
  // Also stores feedback pending data for post-copy feedback invitation
  const handleCopy = useCallback(async () => {
    const text = isOptimizerEnabled && effectiveWasOptimized
      ? effectiveOptimisedText
      : activeTierPromptText;
    if (text) {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      incrementLifetimePrompts();
      setTimeout(() => setCopied(false), 2000);

      // Store feedback pending for post-copy invitation
      if (!isDismissedRecently()) {
        const pending: FeedbackPendingData = {
          eventId: `lab-${Date.now()}`,
          platform: selectedProviderId ?? 'playground',
          tier: activeTier,
          copiedAt: Date.now(),
        };
        storeFeedbackPending(pending);
        setFeedbackPending(pending);
      }
    }
  }, [activeTierPromptText, isOptimizerEnabled, effectiveWasOptimized, effectiveOptimisedText, selectedProviderId, activeTier]);

  // Inline copy: Optimized prompt box (matches standard builder pattern)
  const handleCopyOptimized = useCallback(async () => {
    const textToCopy = effectiveOptimisedText;
    if (textToCopy) {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedOptimized(true);
      incrementLifetimePrompts();
      setTimeout(() => setCopiedOptimized(false), 2000);
    }
  }, [effectiveOptimisedText]);

  // Inline copy: Assembled prompt box
  const handleCopyAssembled = useCallback(async () => {
    if (activeTierPromptText) {
      await navigator.clipboard.writeText(activeTierPromptText);
      setCopiedAssembled(true);
      incrementLifetimePrompts();
      setTimeout(() => setCopiedAssembled(false), 2000);
    }
  }, [activeTierPromptText]);

  // Handle save
  const handleSavePrompt = useCallback(
    (data: SavePromptData) => {
      const negativeTierKey = `tier${activeTier}` as keyof GeneratedPrompts['negative'];

      savePrompt({
        name: data.name,
        platformId: selectedProviderId || 'playground',
        platformName: selectedProvider?.name || 'Playground',
        positivePrompt: activeTierPromptText,
        negativePrompt: generatedPrompts.negative[negativeTierKey] || '',
        selections: selections,
        customValues: {},
        families: dominantFamily ? [dominantFamily] : [],
        mood: 'neutral',
        coherenceScore: 80,
        characterCount: activeTierPromptText.length,
        notes: data.notes,
        tags: data.tags,
      });

      setShowSaveModal(false);
      setSavedConfirmation(true);
      setTimeout(() => setSavedConfirmation(false), 2000);
    },
    [activeTier, activeTierPromptText, generatedPrompts, savePrompt, selectedProvider, selectedProviderId, selections, dominantFamily],
  );

  // Determine if we show single tier (provider selected) or all 4 (educational)
  const singleTierMode = selectedProviderId !== null;

  return (
    <section
      className="flex h-full min-h-0 flex-col rounded-3xl bg-slate-950/70 shadow-sm ring-1 ring-white/10"
      aria-label="Enhanced Prompt Builder Preview"
    >
      {/* Header - Full width DNA bar */}
      <header className="shrink-0 border-b border-slate-800/50 p-4 md:px-6 md:pt-5">
        {/* Main header row: Provider | Composition Mode | DNA Bar */}
        <div className="flex items-center gap-3">
          <ProviderSelector
            providers={providers}
            selectedId={selectedProviderId}
            onSelect={handleProviderSelect}
          />

          {/* Composition Mode Toggle — Static/Dynamic (same as real builder) */}
          <CompositionModeToggle
            compositionMode={compositionMode}
            onModeChange={setCompositionMode}
            platformId={selectedProviderId ?? 'stability'}
            disabled={false}
            compact
          />

          {/* Divider */}
          <span className="text-slate-700" aria-hidden="true">│</span>

          {/* Pro Promagen: Colour legend — positioned between Dynamic and Optimize */}
          {hasContent && <LabCategoryColourLegend isPro={isPro} />}

          {/* Text Length Optimizer toggle (Phase L4) — disabled when no provider */}
          <TextLengthOptimizer
            isEnabled={isOptimizerEnabled}
            onToggle={setOptimizerEnabled}
            platformId={optimizerPlatformId}
            platformName={selectedProvider?.name ?? 'Select a provider'}
            disabled={finalOptimizerDisabled}
            tooltipContent={finalTooltipContent}
            analysis={hasContent ? optimizerAnalysis : null}
            compact
          />

          {/* DNA Bar - flex-1 makes it stretch to fill available space */}
          <DnaBar selections={selections} dominantFamily={dominantFamily} healthScore={realHealthScore} conflictCount={realConflictCount} hasHardConflicts={realHasHardConflicts} />
        </div>

        {/* Show selected provider tier info */}
        {selectedProvider && (
          <div className="mt-3 flex items-center gap-2 text-xs text-white/60">
            <span className="font-medium text-white">{selectedProvider.name}</span>
            <span>·</span>
            <span>
              Tier {activeTier}: {TIER_CONFIGS[activeTier].name}
            </span>
          </div>
        )}
      </header>

      {/* Main Content */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30">
        {/* ════════════════════════════════════════════════════════ */}
        {/* Scene Starters — quick-start strip (Phase L1)          */}
        {/* Same component as real prompt builder. Collapsed by     */}
        {/* default. Selecting a scene prefills all categories.     */}
        {/* Human factor: Variable Reward + Peak-End Rule —         */}
        {/* the cascade of dropdowns filling at once is the peak.   */}
        {/* ════════════════════════════════════════════════════════ */}
        <SceneSelector
          categoryState={categoryStateForScene}
          setCategoryState={setCategoryStateAdapter}
          userTier="paid"
          isLocked={false}
          onActiveSceneChange={handleActiveSceneChange}
          platformTier={activeTier}
        />

        {/* ════════════════════════════════════════════════════════ */}
        {/* Describe Your Image — Human Sentence Conversion         */}
        {/* Same component as in PromptBuilder. Always shown in     */}
        {/* Prompt Lab (both provider-selected and no-provider).    */}
        {/* Authority: human-sentence-conversion.md                  */}
        {/* ════════════════════════════════════════════════════════ */}
        <DescribeYourImage
          categoryState={categoryStateForScene}
          setCategoryState={setCategoryStateAdapter}
          isLocked={false}
          onTextChange={onDescribeTextChange}
          onGenerate={onDescribeGenerate}
          onClear={() => {
            onDescribeClear?.();
            clearAiOptimise();
          }}
          isDrifted={isDrifted}
          driftChangeCount={driftChangeCount}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Column: Categories + Preview */}
          <div className="lg:col-span-2 space-y-4">

            {/* ═══════════════════════════════════════════════════ */}
            {/* Selection Echo Strip — bird's-eye view of ALL      */}
            {/* selected terms across ALL categories as chips.     */}
            {/* Click any chip to deselect. Color-coded by cat.    */}
            {/* Human factor: Cognitive Load reduction — users see  */}
            {/* their entire prompt composition without scrolling.  */}
            {/* No other builder shows a live "shopping cart" of    */}
            {/* all selections simultaneously.                     */}
            {/* ═══════════════════════════════════════════════════ */}
            {hasContent && (
              <div className="rounded-xl bg-slate-900/80 border border-white/10 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-slate-400">Your selections</span>
                  <span className="text-xs text-slate-400">
                    {Object.values(selections).flat().length} terms
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {DISPLAY_CATEGORIES.map((cat) =>
                    (selections[cat] ?? []).map((term) => (
                      <button
                        key={`${cat}-${term}`}
                        type="button"
                        onClick={() => {
                          setSelections((prev) => ({
                            ...prev,
                            [cat]: prev[cat].filter((t) => t !== term),
                          }));
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-slate-800/60 px-2 py-0.5 text-xs text-slate-200 hover:border-red-400/40 hover:bg-red-950/20 hover:text-red-300 transition-all cursor-pointer"
                        title={`${CATEGORY_META[cat]?.label ?? cat} — click to remove`}
                      >
                        <span
                          className="inline-block rounded-full"
                          style={{
                            width: '6px',
                            height: '6px',
                            backgroundColor: CATEGORY_COLORS[cat] ?? '#6366f1',
                          }}
                        />
                        {term}
                        <span className="text-xs text-slate-400">✕</span>
                      </button>
                    )),
                  )}
                </div>
              </div>
            )}

            {/* Category Selections + Explore Drawers */}
            <div className="rounded-xl bg-slate-900/80 border border-white/10 p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {DISPLAY_CATEGORIES.map((category) => {
                  const maxSelections = STANDARD_LIMITS[activeTier][category] ?? 1;
                  return (
                    <div key={category} className="flex flex-col gap-1">
                      <CategoryDropdown
                        category={category}
                        selections={selections[category]}
                        onSelectionChange={(newSel) => handleCategoryChange(category, newSel)}
                        tier={activeTier}
                        reorderedOptions={reorderedOptionsMap.get(category)}
                        labelColour={isPro ? CATEGORY_COLOURS[category] : undefined}
                      />
                      {/* Phase L5: Explore Drawer — expandable vocabulary panel */}
                      <ExploreDrawer
                        category={category}
                        selectedTerms={selections[category] ?? []}
                        onAddTerm={(term) => {
                          const current = selections[category] ?? [];
                          if (current.length < maxSelections && !current.includes(term)) {
                            handleCategoryChange(category, [...current, term]);
                          }
                        }}
                        maxSelections={maxSelections}
                        isLocked={false}
                        platformTier={activeTier}
                        isExpanded={expandedExploreCategory === category}
                        onToggle={() =>
                          setExpandedExploreCategory(
                            expandedExploreCategory === category ? null : category,
                          )
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════ */}
            {/* Aspect Ratio — 13th row (Phase L3)                 */}
            {/* Same component as real builder. Shows native AR     */}
            {/* support per platform. Injects --ar params for MJ.  */}
            {/* ═══════════════════════════════════════════════════ */}
            <div className="rounded-xl bg-slate-900/80 border border-white/10 p-4">
              <AspectRatioSelector
                selected={aspectRatio}
                onSelect={setAspectRatio}
                platformId={selectedProviderId ?? 'stability'}
                compositionMode={compositionMode}
                disabled={false}
                isLocked={false}
              />
            </div>

            {/* ═══════════════════════════════════════════════════ */}
            {/* Live Diff Overlay — shows what intelligence adds   */}
            {/* when toggling Static↔Dynamic. 3-second fade.       */}
            {/* Human factor: Transparency builds trust.            */}
            {/* ═══════════════════════════════════════════════════ */}
            {diffData && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 transition-all">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-emerald-400">
                    ✨ Intelligence added:
                  </span>
                  <span className="text-xs text-slate-400">
                    {diffData.diffs.filter(d => d.type === 'added').length} new ·{' '}
                    {diffData.diffs.filter(d => d.type === 'modified').length} enhanced
                  </span>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed">
                  <DiffHighlightedText
                    text={diffData.text}
                    diffs={diffData.diffs}
                    fadingOut={diffFading}
                  />
                </p>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════ */}
            {/* Assembled Prompt — full-length prompt preview      */}
            {/* Matches standard builder's assembled prompt box.   */}
            {/* Shows colour-coded text for Pro, inline copy+save. */}
            {/* ═══════════════════════════════════════════════════ */}
            {hasContent && (
              <div className="rounded-xl bg-slate-900/80 border border-white/10 p-4 space-y-2">
                {/* Header row: dynamic label + stage badge + char count */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isOptimizerEnabled && selectedProviderId && !effectiveWasOptimized ? (
                      /* Optimizer ON but no trimming needed → this IS the optimized output */
                      <span className="text-xs font-medium text-emerald-300 flex items-center gap-1.5">
                        Optimized prompt
                        {selectedProvider && (
                          <>
                            <span className="text-white/40">in</span>
                            <span className="text-white/70">{selectedProvider.name}</span>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={selectedProvider.localIcon || `/icons/providers/${selectedProvider.id}.png`}
                              alt=""
                              style={{ width: 20, height: 20 }}
                              className="inline-block rounded-sm"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          </>
                        )}
                      </span>
                    ) : (
                      /* Optimizer OFF, or optimizer ON but trimming occurred (bottom box has the optimized version) */
                      <span className="text-xs font-medium text-white">Assembled prompt</span>
                    )}
                    <StageBadge
                      compositionMode={compositionMode}
                      isOptimizerEnabled={isOptimizerEnabled && !!selectedProviderId}
                      wasOptimized={effectiveWasOptimized}
                    />
                  </div>
                  <span className={`text-xs tabular-nums ${isOptimizerEnabled && selectedProviderId && !effectiveWasOptimized ? 'text-emerald-400/70' : 'text-slate-200'}`}>
                    {activeTierPromptText.length} chars
                  </span>
                </div>

                {/* Full-length prompt text box — border shifts emerald only when this IS the optimized output */}
                <div className={`min-h-[80px] max-h-[200px] overflow-y-auto rounded-xl border p-3 text-sm scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30 ${
                  isOptimizerEnabled && selectedProviderId && !effectiveWasOptimized
                    ? 'border-emerald-600/50 bg-emerald-950/20'
                    : 'border-slate-600 bg-slate-950/80'
                }`}>
                  <pre className={`whitespace-pre-wrap font-sans text-[0.8rem] leading-relaxed ${
                    isOptimizerEnabled && selectedProviderId && !effectiveWasOptimized ? 'text-emerald-100' : 'text-slate-100'
                  }`}>
                    {isPro && colourTermIndex.size > 0
                      ? (() => {
                          const segments = parsePromptIntoSegments(activeTierPromptText, colourTermIndex);
                          const hasAnatomy = segments.some((s) => s.category !== 'structural');
                          if (!hasAnatomy) return activeTierPromptText;
                          return segments.map((seg, i) => {
                            const c = CATEGORY_COLOURS[seg.category] ?? CATEGORY_COLOURS.structural;
                            return (
                              <span key={i} style={{ color: c, textShadow: seg.weight >= 1.05 ? `0 0 10px ${c}50` : undefined }}>
                                {seg.text}
                              </span>
                            );
                          });
                        })()
                      : activeTierPromptText
                    }
                    {/* Inline copy + save icons — flows after last character, floats right */}
                    <span className="ml-1 inline-flex float-right gap-1">
                      <SaveIcon
                        positivePrompt={activeTierPromptText}
                        platformId={selectedProviderId ?? 'playground'}
                        platformName={selectedProvider?.name ?? 'Playground'}
                        source="builder"
                        tier={activeTier}
                        selections={selections as unknown as Record<string, unknown>}
                        size="sm"
                      />
                      <button
                        type="button"
                        onClick={handleCopyAssembled}
                        className={`inline-flex items-center justify-center rounded-md p-1 transition-all cursor-pointer ${
                          copiedAssembled
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : isOptimizerEnabled && selectedProviderId
                              ? 'bg-white/5 text-emerald-300 hover:bg-white/10 hover:text-emerald-200'
                              : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
                        }`}
                        title={copiedAssembled ? 'Copied!' : isOptimizerEnabled && selectedProviderId ? 'Copy optimized prompt' : 'Copy assembled prompt'}
                        aria-label={copiedAssembled ? 'Copied to clipboard' : isOptimizerEnabled && selectedProviderId ? 'Copy optimized prompt to clipboard' : 'Copy assembled prompt to clipboard'}
                      >
                        {copiedAssembled ? (
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    </span>
                  </pre>
                </div>
              </div>
            )}

            {/* 4-Tier Prompt Preview */}
            <div className="rounded-xl bg-slate-900/80 border border-white/10 p-4">
              <FourTierPromptPreview
                prompts={aiTierPrompts ?? generatedPrompts}
                currentTier={activeTier}
                onTierSelect={handleTierSelect}
                compact={false}
                showNegative={true}
                singleTierMode={singleTierMode}
                isPro={isPro}
                termIndex={colourTermIndex}
                isTierGenerating={isTierGenerating}
                generatedForProvider={generatedForProvider}
              />
            </div>

            {/* ═══════════════════════════════════════════════════ */}
            {/* Text Length Optimizer Output (Phase L4)             */}
            {/* Shows length indicator, optimization result, and   */}
            {/* transparency panel when optimizer is enabled.       */}
            {/* Human factor: Loss Aversion — "23 tokens over"     */}
            {/* creates urgency to trim.                           */}
            {/* ═══════════════════════════════════════════════════ */}
            {hasContent && (
              <div className="rounded-xl bg-slate-900/80 border border-white/10 p-4 space-y-3">
                {/* Length Indicator — always visible when there's content */}
                <LengthIndicator
                  analysis={optimizerAnalysis}
                  isOptimizerEnabled={isOptimizerEnabled}
                  optimizedLength={isOptimizerEnabled ? effectiveOptimisedLength : undefined}
                  willTrim={isOptimizerEnabled && effectiveWasOptimized}
                  compact
                />

                {/* AI Disguise: Algorithm cycling animation (§3 Anticipatory Dopamine) */}
                {/* Shows during Call 3 processing. Amber→emerald colour shift.          */}
                {isAiOptimising && (
                  <AlgorithmCycling
                    animationPhase={animationPhase}
                    currentAlgorithm={currentAlgorithm}
                    algorithmCount={algorithmCount}
                  />
                )}

                {/* Optimization result — shows when optimizer produces changes (hidden during AI cycling) */}
                {isOptimizerEnabled && effectiveWasOptimized && !isAiOptimising && (
                  <>
                    <div className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400">↓</span>
                        <span className="text-xs text-amber-200">
                          <span className="font-medium">Optimized:</span>{' '}
                          {optimizedResult.originalLength} → {effectiveOptimisedLength} chars{' '}
                          <span className="text-amber-400/60">
                            (saved {optimizedResult.originalLength - effectiveOptimisedLength})
                          </span>
                        </span>
                      </div>
                      {/* Show AI changes OR client-side removed terms */}
                      {aiOptimiseResult?.changes && aiOptimiseResult.changes.length > 0 ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {aiOptimiseResult.changes.map((change, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center rounded-md bg-emerald-900/30 px-1.5 py-0.5 text-xs text-emerald-300"
                            >
                              ✓ {change}
                            </span>
                          ))}
                        </div>
                      ) : optimizedResult.removedTermNames && optimizedResult.removedTermNames.length > 0 ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {optimizedResult.removedTermNames.map((name, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center rounded-md bg-amber-900/30 px-1.5 py-0.5 text-xs text-amber-300"
                            >
                              ✕ {name}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    {/* Transparency Panel — shows which phase achieved the target (client-side only) */}
                    {!aiOptimiseResult && (
                      <OptimizationTransparencyPanel
                        removedTerms={optimizedResult.removedTerms ?? []}
                        achievedAtPhase={optimizedResult.achievedAtPhase ?? -1}
                        originalLength={optimizedResult.originalLength}
                        optimizedLength={optimizedResult.optimizedLength}
                        isPro={isPro}
                      />
                    )}

                    {/* Optimized prompt preview */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-emerald-300 flex items-center gap-1.5">
                          Optimized prompt
                          {selectedProvider && (
                            <>
                              <span className="text-white/40">in</span>
                              <span className="text-white/70">{selectedProvider.name}</span>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={selectedProvider.localIcon || `/icons/providers/${selectedProvider.id}.png`}
                                alt=""
                                style={{ width: 20, height: 20 }}
                                className="inline-block rounded-sm"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            </>
                          )}
                        </span>
                        <span className="text-xs text-emerald-400/70 tabular-nums">
                          {effectiveOptimisedLength} chars
                        </span>
                      </div>
                      <div className="min-h-[60px] max-h-[150px] overflow-y-auto rounded-xl border border-emerald-600/50 bg-emerald-950/20 p-3 text-sm scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30">
                        <pre className="whitespace-pre-wrap font-sans text-[0.8rem] leading-relaxed text-emerald-100">
                          {isPro && colourTermIndex.size > 0
                            ? (() => {
                                const segments = parsePromptIntoSegments(effectiveOptimisedText, colourTermIndex);
                                const hasAnatomy = segments.some((s) => s.category !== 'structural');
                                if (!hasAnatomy) return effectiveOptimisedText;
                                return segments.map((seg, i) => {
                                  const c = CATEGORY_COLOURS[seg.category] ?? CATEGORY_COLOURS.structural;
                                  return (
                                    <span key={i} style={{ color: c, textShadow: seg.weight >= 1.05 ? `0 0 10px ${c}50` : undefined }}>
                                      {seg.text}
                                    </span>
                                  );
                                });
                              })()
                            : effectiveOptimisedText
                          }
                          {/* Inline copy + save icons — flows after last character, floats right */}
                          <span className="ml-1 inline-flex float-right gap-1">
                            <SaveIcon
                              positivePrompt={activeTierPromptText}
                              optimisedPrompt={effectiveOptimisedText}
                              isOptimised={true}
                              platformId={selectedProviderId ?? 'playground'}
                              platformName={selectedProvider?.name ?? 'Playground'}
                              source="builder"
                              tier={activeTier}
                              selections={selections as unknown as Record<string, unknown>}
                              size="sm"
                            />
                            <button
                              type="button"
                              onClick={handleCopyOptimized}
                              className={`inline-flex items-center justify-center rounded-md p-1 transition-all cursor-pointer ${
                                copiedOptimized
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-white/5 text-emerald-300 hover:bg-white/10 hover:text-emerald-200 cursor-pointer'
                              }`}
                              title={copiedOptimized ? 'Copied!' : 'Copy optimized prompt'}
                              aria-label={copiedOptimized ? 'Copied to clipboard' : 'Copy optimized prompt to clipboard'}
                            >
                              {copiedOptimized ? (
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              )}
                            </button>
                          </span>
                        </pre>
                      </div>
                    </div>
                  </>
                )}

                {/* Within optimal range — shows when optimizer ON but no trimming needed */}
                {isOptimizerEnabled && !effectiveWasOptimized && selectedProviderId && !isAiOptimising && (
                  <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400">✓</span>
                        <span className="text-xs text-emerald-200">
                          <span className="font-medium">Within optimal range</span> —{' '}
                          {effectiveOptimisedLength} chars
                        </span>
                      </div>
                      <span style={{ fontSize: 'clamp(10px, 0.65vw, 11px)' }} className="text-emerald-400/70">No trimming needed</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Educational Note (only when no provider selected) */}
            {!singleTierMode && (
              <div className="p-3 rounded-lg bg-gradient-to-r from-sky-500/10 via-emerald-500/10 to-indigo-500/10 border border-white/10">
                <p className="text-xs text-white/70">
                  <strong>💡 Learn by comparison:</strong> Same vision, different syntaxes. Tier 1
                  uses <code className="text-sky-400">(weights)</code>, Tier 2 uses{' '}
                  <code className="text-purple-400">--params</code>, Tier 3 uses sentences. Select a
                  provider above to lock in your preferred format.
                </p>
              </div>
            )}
          </div>

          {/* Right Column: Intelligence Panel */}
          <div className="lg:col-span-1">
            <div className="sticky top-0">
              <IntelligencePanel
                conflicts={conflicts}
                suggestions={suggestions}
                platformHints={platformHints}
                marketMood={null}
                weatherSuggestions={weatherSuggestions}
                tier={activeTier}
                onSuggestionClick={handleSuggestionClick}
                onMoodTermClick={handleMoodTermClick}
                compact={false}
                categoryMeta={INTELLIGENCE_CATEGORY_META}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions - matches /providers/{provider} styling */}
      <footer className="shrink-0 border-t border-slate-800/50 p-4 md:px-6">
        <div className="flex flex-wrap items-center justify-center gap-3">
          {/* Copy prompt button */}
          <button
            type="button"
            onClick={handleCopy}
            disabled={!hasContent}
            className={`
              inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition-all
              ${
                hasContent
                  ? 'border-slate-600 bg-slate-900 text-slate-50 hover:border-slate-400 hover:bg-slate-800 cursor-pointer'
                  : 'cursor-not-allowed border-slate-800 bg-slate-900/50 text-slate-400'
              }
              focus-visible:outline-none focus-visible:ring focus-visible:ring-sky-400/80
            `}
          >
            {copied ? (
              <>
                <svg
                  className="h-4 w-4 text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                {isOptimizerEnabled && effectiveWasOptimized ? 'Copy optimized prompt' : 'Copy prompt'}
              </>
            )}
          </button>

          {/* Randomise button */}
          <button
            type="button"
            onClick={handleRandomise}
            className="inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition-all focus-visible:outline-none focus-visible:ring focus-visible:ring-purple-400/80 border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-purple-100 hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400 cursor-pointer"
          >
            <span className="text-base">🎲</span>
            Randomise
          </button>

          {/* Clear button (clears provider + selections) */}
          <button
            type="button"
            onClick={handleClear}
            disabled={!hasContent && !selectedProviderId}
            className={`inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition-all focus-visible:outline-none focus-visible:ring focus-visible:ring-sky-400/80 ${
              hasContent || selectedProviderId
                ? 'border-slate-600 bg-slate-800 text-slate-100 hover:border-slate-400 hover:bg-slate-700 cursor-pointer'
                : 'cursor-not-allowed border-slate-700 bg-slate-800/50 text-slate-400'
            }`}
          >
            Clear all
          </button>

          {/* Save to Library button */}
          <button
            type="button"
            onClick={() => setShowSaveModal(true)}
            disabled={!hasContent}
            className={`inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition-all focus-visible:outline-none focus-visible:ring focus-visible:ring-emerald-400/80 ${
              hasContent
                ? savedConfirmation
                  ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300 cursor-pointer'
                  : 'border-emerald-500/70 bg-gradient-to-r from-emerald-600/20 to-teal-600/20 text-emerald-100 hover:from-emerald-600/30 hover:to-teal-600/30 hover:border-emerald-400 cursor-pointer'
                : 'cursor-not-allowed border-slate-700 bg-slate-800/50 text-slate-400'
            }`}
          >
            {savedConfirmation ? (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Saved!
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                  />
                </svg>
                Save
              </>
            )}
          </button>
        </div>
      </footer>

      {/* Phase L7: Feedback Memory Banner — contextual overlap hint */}
      {feedbackOverlap && !feedbackPending && (
        <div style={{ marginTop: 'clamp(6px, 0.4vw, 10px)', padding: '0 1rem' }}>
          <FeedbackMemoryBanner
            overlap={feedbackOverlap}
            platformName={selectedProvider?.name ?? 'Prompt Lab'}
            userTier={null}
          />
        </div>
      )}

      {/* Phase L7: Feedback Invitation — post-copy rating widget */}
      {feedbackPending && (
        <div style={{ marginTop: 'clamp(6px, 0.4vw, 10px)', padding: '0 1rem' }}>
          <FeedbackInvitation
            pending={feedbackPending}
            onComplete={(_rating?: FeedbackRating) => {
              setFeedbackPending(null);
            }}
          />
        </div>
      )}

      {/* Save Prompt Modal */}
      <SavePromptModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSavePrompt}
        promptPreview={activeTierPromptText}
        suggestedName={suggestedSaveName}
      />
    </section>
  );
}

export { EnhancedEducationalPreview };
