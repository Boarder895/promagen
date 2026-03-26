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
// SceneSelector REMOVED from Prompt Lab — algorithm-only path. Remains in standard builder.
import { DescribeYourImage } from '@/components/providers/describe-your-image';
// Removed: CompositionModeToggle, AspectRatioSelector, ExploreDrawer (dropdowns/AR removed)
import { TextLengthOptimizer } from '@/components/providers/text-length-optimizer';
import { LengthIndicator } from '@/components/providers/length-indicator';
import { OptimizationTransparencyPanel } from '@/components/providers/optimization-transparency-panel';
import { SavePromptModal, type SavePromptData } from '@/components/prompts/save-prompt-modal';
import { SaveIcon } from '@/components/prompts/library/save-icon';
import { useSavedPrompts } from '@/hooks/use-saved-prompts';
// Removed: usePromptAnalysis (DnaBar removed)
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
  formatPromptForCopy,
  getPlatformFormat,
} from '@/lib/prompt-builder';
// Removed: assembleCompositionPack (AR removed)
// Removed: postProcessAssembled (template pipeline simplified)
import { incrementLifetimePrompts } from '@/lib/lifetime-counter';
// Removed: rewriteWithSynergy (synergy only needed for dynamic mode)
import { loadCategoryVocabulary, type CategoryKey } from '@/lib/vocabulary/vocabulary-loader';
// Removed: getOrderedOptions (smart dropdown reorder — dropdowns removed)
// Removed: getEnhancedCategoryConfig (smart dropdown reorder — dropdowns removed)
import { getPlatformTier } from '@/lib/compress';
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
  EMPTY_SELECTIONS,
  STANDARD_LIMITS,
  TIER_CONFIGS,
  type PlatformTier,
  type PromptCategory,
  type PromptSelections,
  type GeneratedPrompts,
} from '@/types/prompt-intelligence';
import type { CategoryState } from '@/types/prompt-builder';
import type { Provider } from '@/types/providers';
import { getPlatformTierId } from '@/data/platform-tiers';
import { getPromptLimit } from '@/lib/prompt-trimmer';
import { getProviderGroup } from '@/lib/optimise-prompts/platform-groups';

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
  // ── Coverage data from Call 1 (matched phrases for text colouring) ──
  /** When true, DescribeYourImage skips internal Call 1 — orchestrator handles it */
  skipInternalParse?: boolean;
  /** Whether external assessment is loading */
  externalLoading?: boolean;
  /** The user's original human description — passed to Call 3 for cross-referencing */
  humanText?: string;
  /** Coverage assessment with matched phrases per category */
  coverageData?: import('@/types/category-assessment').CoverageAssessment | null;
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

// MIDJOURNEY_FAMILY REMOVED — only used for AR parameter injection

// CATEGORY_COLORS REMOVED — only used in Selection Echo Strip
// Live Diff View REMOVED — was for Static↔Dynamic toggle comparison

// computePromptDiff + DiffHighlightedText REMOVED — Live Diff was for Static↔Dynamic toggle

// DnaBar REMOVED — fed from selections which no longer have dropdown UI.
// Will be replaced by v4 assessment-based scoring in future.

// CategoryDropdown REMOVED — 12 category dropdowns removed from Prompt Lab UI.
// Selections state still populated by Call 1 + SceneSelector for template fallback.

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

// useRealIntelligence REMOVED — fed DnaBar which has been removed.
// Will be replaced by v4 assessment-based intelligence in future.

// StageBadge REMOVED — Static/Dynamic distinction no longer relevant.
// Assembled prompt is always dynamic mode.

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
  skipInternalParse,
  externalLoading,
  coverageData,
  humanText,
}: EnhancedEducationalPreviewProps) {
  // State
  const [selections, setSelections] = useState<PromptSelections>(EMPTY_SELECTIONS);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savedConfirmation, setSavedConfirmation] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedOptimized, setCopiedOptimized] = useState(false);
  const [copiedAssembled, setCopiedAssembled] = useState(false);

  // ── Generation ID: increments on every new API response ────────────
  // MUST be synchronous (ref, not useState+useEffect) so it's already
  // incremented when children render with the new prompts in the same frame.
  // useEffect fires AFTER render — children would see stale generationId.
  const generationIdRef = useRef(0);
  const prevAiTierForIdRef = useRef(aiTierPrompts);
  if (aiTierPrompts && aiTierPrompts !== prevAiTierForIdRef.current) {
    generationIdRef.current += 1;
    prevAiTierForIdRef.current = aiTierPrompts;
  }
  const generationId = generationIdRef.current;


  // ── External clear signal for DescribeYourImage (footer Clear All) ──
  const [clearSignal, setClearSignal] = useState(0);

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

  // Build term → category index for colour coding
  // TWO LAYERS for maximum colour coverage:
  //   Layer 1: coverageData.matchedPhrases — user's exact words from Call 1
  //   Layer 2: Vocabulary terms — known terms the AI might add (expert value-add)
  // Combined index colours both human-written and AI-generated text.
  const colourTermIndex = useMemo(() => {
    // Prompt Lab: build from coverageData matched phrases (all users see colour)
    if (coverageData) {
      const index = new Map<string, PromptCategory>();
      const STOP_WORDS = new Set([
        'a', 'an', 'the', 'in', 'on', 'at', 'of', 'to', 'for', 'by',
        'as', 'and', 'or', 'but', 'with', 'from', 'into', 'through',
        'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'that', 'this', 'it', 'its', 'should', 'feel',
      ]);

      // ── Layer 1: Call 1 matched phrases (user's own words) ──────────
      for (const [cat, data] of Object.entries(coverageData.coverage)) {
        if (!data.matchedPhrases) continue;
        const category = cat as PromptCategory;

        for (const phrase of data.matchedPhrases) {
          const key = phrase.toLowerCase().trim();
          if (!key) continue;

          // Always add the full phrase
          index.set(key, category);

          // Split long phrases (4+ words) into meaningful sub-chunks
          const words = key.split(/\s+/);
          if (words.length >= 4) {
            let chunk: string[] = [];
            for (const word of words) {
              if (STOP_WORDS.has(word)) {
                if (chunk.length >= 2) {
                  index.set(chunk.join(' '), category);
                }
                chunk = [];
              } else {
                chunk.push(word);
              }
            }
            if (chunk.length >= 2) {
              index.set(chunk.join(' '), category);
            }
          }

          // Individual meaningful words (3+ chars, not stop words)
          for (const word of words) {
            if (word.length >= 3 && !STOP_WORDS.has(word)) {
              index.set(word, category);
            }
          }
        }
      }

      // ── Layer 2: Vocabulary terms (AI expert value-add terms) ────────
      // Top 50 dropdown terms per category. Only add multi-word terms
      // (2+ words) or specific single words (5+ chars) to avoid
      // false-matching common short words like "dark", "soft", "blue".
      const VOCAB_CATEGORIES: CategoryKey[] = [
        'subject', 'action', 'style', 'environment', 'composition',
        'camera', 'lighting', 'colour', 'atmosphere', 'materials',
        'fidelity', 'negative',
      ];
      for (const cat of VOCAB_CATEGORIES) {
        try {
          const vocab = loadCategoryVocabulary(cat);
          const terms = vocab.dropdownOptions.slice(0, 50);
          for (const term of terms) {
            const key = term.toLowerCase().trim();
            if (!key) continue;
            // Skip if already in index (user phrases take priority)
            if (index.has(key)) continue;
            const wordCount = key.split(/\s+/).length;
            // Multi-word terms always safe (e.g., "golden hour", "wide angle")
            // Single words only if 4+ chars (e.g., "neon", "haze", not "red")
            if (wordCount >= 2 || key.length >= 4) {
              index.set(key, cat as PromptCategory);
            }
          }
        } catch {
          // Vocabulary load failure is non-fatal — colours just won't match
        }
      }

      return index;
    }
    // Standard builder: build from dropdown selections (Pro only)
    if (!isPro) return new Map<string, PromptCategory>();
    return buildTermIndexFromSelections(selections);
  }, [coverageData, isPro, selections]);

  // ── CategoryState adapter for DescribeYourImage ──
  // DescribeYourImage reads/writes Record<PromptCategory, CategoryState>.
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

  // dominantFamily REMOVED — only fed DnaBar which has been removed

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

    for (const tier of [1, 2, 3, 4] as PlatformTier[]) {
      // Use selected provider for its tier, representative for others
      const platformId = (selectedProviderId && getPlatformTier(selectedProviderId) === tier)
        ? selectedProviderId
        : TIER_REPRESENTATIVE[tier];

      // Always dynamic: full platform-specific formatting (skipTrim — no optimizer in preview)
      const assembled = assemblePrompt(platformId, selections, undefined, { skipTrim: true });

      const tierKey = `tier${tier}` as keyof Omit<GeneratedPrompts, 'negative'>;
      result[tierKey] = formatPromptForCopy(assembled);
      result.negative[tierKey as keyof GeneratedPrompts['negative']] = assembled.negative ?? '';
    }

    return result;
  }, [selections, selectedProviderId]);

  // Active tier prompt text (for copy, optimizer, and Call 3)
  // Prefers AI tier text (Call 2) when available. Falls back to template text.
  const activeTierPromptText = useMemo(() => {
    const tierKey = `tier${activeTier}` as keyof Omit<GeneratedPrompts, 'negative'>;
    const source = aiTierPrompts ?? generatedPrompts;
    return source[tierKey] ?? '';
  }, [generatedPrompts, aiTierPrompts, activeTier]);

  // Call 3 input text: for NL group providers that are T4 (e.g. Canva),
  // send T3 (Natural Language) text instead — it has far more visual detail.
  // T3 is the richest prose tier, giving GPT the best starting material to
  // enrich against the original human description.
  const call3InputText = useMemo(() => {
    if (!selectedProviderId) return activeTierPromptText;
    const group = getProviderGroup(selectedProviderId);
    if (group === 'clean-natural-language' && activeTier === 4) {
      const source = aiTierPrompts ?? generatedPrompts;
      const t3Text = source.tier3 ?? '';
      // Only use T3 if it actually has content; fall back to active tier otherwise
      return t3Text || activeTierPromptText;
    }
    return activeTierPromptText;
  }, [generatedPrompts, aiTierPrompts, activeTier, activeTierPromptText, selectedProviderId]);

  // ── Assembled prompt typewriter ─────────────────────────────────────
  // Typewriter ONLY when Call 2 returns new AI content (fresh generation).
  // Switching tier tabs (1→2→3→4) shows text INSTANTLY — no re-typewrite.
  // Tracked via aiTierPrompts reference: new object = API call, same object = tab switch.
  const [assembledVisibleChars, setAssembledVisibleChars] = useState(0);
  const prevAssembledRef = useRef('');
  const prevAiTierRef = useRef(aiTierPrompts);
  const assembledTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const prev = prevAssembledRef.current;
    const prevAi = prevAiTierRef.current;
    prevAssembledRef.current = activeTierPromptText;
    prevAiTierRef.current = aiTierPrompts;

    if (assembledTimerRef.current) { clearInterval(assembledTimerRef.current); assembledTimerRef.current = null; }

    if (!activeTierPromptText) {
      setAssembledVisibleChars(0);
      return;
    }
    // Same text → no change needed
    if (activeTierPromptText === prev) {
      setAssembledVisibleChars(activeTierPromptText.length);
      return;
    }

    // Determine if this is a new API generation or just a tier tab switch.
    // API call = aiTierPrompts reference changed. Tab switch = same reference, different tier.
    const isNewGeneration = aiTierPrompts !== prevAi;

    if (!isNewGeneration) {
      // Tab switch — show instantly, no typewriter
      setAssembledVisibleChars(activeTierPromptText.length);
      return;
    }

    // New API content — typewrite it
    const isFresh = !prev;
    const speed = isFresh ? 25 : 5;
    setAssembledVisibleChars(0);

    let chars = 0;
    assembledTimerRef.current = setInterval(() => {
      chars += 1;
      if (chars >= activeTierPromptText.length) {
        setAssembledVisibleChars(activeTierPromptText.length);
        if (assembledTimerRef.current) { clearInterval(assembledTimerRef.current); assembledTimerRef.current = null; }
      } else {
        setAssembledVisibleChars(chars);
      }
    }, speed);

    return () => {
      if (assembledTimerRef.current) clearInterval(assembledTimerRef.current);
    };
  }, [activeTierPromptText, aiTierPrompts]);

  const assembledDisplayText = activeTierPromptText.slice(0, assembledVisibleChars);
  const isAssembledTyping = assembledVisibleChars < activeTierPromptText.length && activeTierPromptText.length > 0;

  // Live Diff REMOVED — was for Static↔Dynamic toggle comparison

  // Check if we have any content (selections from Call 1 / Scene, OR AI tier prompts)
  const hasContent = useMemo(() => {
    const hasSelections = Object.values(selections).some((arr) => arr.length > 0);
    const hasAiContent = aiTierPrompts !== null && aiTierPrompts !== undefined;
    return hasSelections || hasAiContent;
  }, [selections, aiTierPrompts]);

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
      groupKnowledge: format.groupKnowledge,
    };
  }, [selectedProviderId, selectedProvider?.name]);

  // Fire Call 3 when optimizer toggled ON, and re-fire debounced when text changes while ON
  // Fix 3: Aspect ratio / selection changes re-fire Call 3 so the optimised prompt stays in sync
  const prevOptimizerEnabledRef = useRef(false);
  const prevPromptTextRef = useRef('');
  const reFireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref for humanText — used by Call 3 for cross-referencing the original description.
  // Must be a ref (not a dep) so Call 3 doesn't re-fire on every keystroke.
  const humanTextRef = useRef(humanText ?? '');
  humanTextRef.current = humanText ?? '';

  useEffect(() => {
    const wasEnabled = prevOptimizerEnabledRef.current;
    const prevText = prevPromptTextRef.current;
    prevOptimizerEnabledRef.current = isOptimizerEnabled;
    prevPromptTextRef.current = call3InputText;

    // Toggled OFF → clear
    if (!isOptimizerEnabled && wasEnabled) {
      clearAiOptimise();
      if (reFireTimerRef.current) clearTimeout(reFireTimerRef.current);
      return;
    }

    // Not enabled or missing requirements → skip
    if (!isOptimizerEnabled || !selectedProviderId || !call3InputText || !aiOptimiseContext) {
      return;
    }

    // Just toggled ON → fire immediately
    if (!wasEnabled) {
      aiOptimise(call3InputText, selectedProviderId, aiOptimiseContext, humanTextRef.current);
      return;
    }

    // Already ON and text changed → debounced re-fire (800ms)
    // Guard: skip re-fire if Call 3 already returned a result or is in flight.
    // This prevents the AI tier load from triggering a second Call 3 that
    // overwrites a good bypass result with a shorter one.
    if (call3InputText !== prevText && !aiOptimiseResult && !isAiOptimising) {
      if (reFireTimerRef.current) clearTimeout(reFireTimerRef.current);
      reFireTimerRef.current = setTimeout(() => {
        aiOptimise(call3InputText, selectedProviderId, aiOptimiseContext, humanTextRef.current);
      }, 800);
    }

    return () => {
      if (reFireTimerRef.current) clearTimeout(reFireTimerRef.current);
    };
  }, [isOptimizerEnabled, selectedProviderId, call3InputText, aiOptimiseContext, aiOptimise, clearAiOptimise, aiOptimiseResult, isAiOptimising]);

  // Effective optimised values: AI result takes priority over client-side
  const effectiveOptimisedText = aiOptimiseResult?.optimised ?? optimizedResult.optimized;
  const effectiveOptimisedLength = aiOptimiseResult?.charCount ?? optimizedResult.optimizedLength;
  const effectiveWasOptimized = aiOptimiseResult
    ? effectiveOptimisedLength < optimizedResult.originalLength
    : wasOptimized;

  // ── Optimised prompt typewriter (Call 3) ────────────────────────────
  // Typewriter when aiOptimiseResult changes (Call 3 returned new content).
  // Instant when text changes for other reasons (client-side optimisation).
  const [optimisedVisibleChars, setOptimisedVisibleChars] = useState(0);
  const prevOptimisedRef = useRef('');
  const prevAiOptimiseRef = useRef(aiOptimiseResult);
  const optimisedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const prev = prevOptimisedRef.current;
    const prevAiOpt = prevAiOptimiseRef.current;
    prevOptimisedRef.current = effectiveOptimisedText;
    prevAiOptimiseRef.current = aiOptimiseResult;

    if (optimisedTimerRef.current) { clearInterval(optimisedTimerRef.current); optimisedTimerRef.current = null; }

    if (!effectiveOptimisedText) {
      setOptimisedVisibleChars(0);
      return;
    }
    if (effectiveOptimisedText === prev) {
      setOptimisedVisibleChars(effectiveOptimisedText.length);
      return;
    }

    // Only typewrite when Call 3 returned new content
    const isNewOptimisation = aiOptimiseResult !== prevAiOpt && aiOptimiseResult !== null;

    if (!isNewOptimisation) {
      setOptimisedVisibleChars(effectiveOptimisedText.length);
      return;
    }

    // Call 3 returned → typewrite
    setOptimisedVisibleChars(0);
    let chars = 0;
    optimisedTimerRef.current = setInterval(() => {
      chars += 1;
      if (chars >= effectiveOptimisedText.length) {
        setOptimisedVisibleChars(effectiveOptimisedText.length);
        if (optimisedTimerRef.current) { clearInterval(optimisedTimerRef.current); optimisedTimerRef.current = null; }
      } else {
        setOptimisedVisibleChars(chars);
      }
    }, 5);

    return () => {
      if (optimisedTimerRef.current) clearInterval(optimisedTimerRef.current);
    };
  }, [effectiveOptimisedText, aiOptimiseResult]);

  const optimisedDisplayText = effectiveOptimisedText.slice(0, optimisedVisibleChars);
  const isOptimisedTyping = optimisedVisibleChars < effectiveOptimisedText.length && effectiveOptimisedText.length > 0;

  // Suggested save name
  const suggestedSaveName = useMemo(() => {
    const subject = selections.subject[0];
    const style = selections.style[0];
    if (subject && style) return `${subject} - ${style}`;
    if (subject) return subject;
    if (style) return style;
    return 'Untitled Prompt';
  }, [selections]);

  // Active categories — which of the 12 categories have selections populated.
  // Fed to TierGenerationCycling for category-aware algorithm name cycling.
  const activeCategories = useMemo(() => {
    const cats: string[] = [];
    const keys = Object.keys(selections) as Array<keyof typeof selections>;
    for (const key of keys) {
      const arr = selections[key];
      if (arr && arr.length > 0) cats.push(key);
    }
    return cats;
  }, [selections]);

  // Handle provider selection — stays in educational preview (no view switch)
  // Only notifies parent for heroText / Listen button text changes
  const handleProviderSelect = useCallback((providerId: string | null) => {
    setSelectedProviderId(providerId);
    _onProviderChange?.(!!providerId);
  }, [_onProviderChange]);

  // Handle category selection change
  // handleCategoryChange REMOVED — no dropdown UI in Prompt Lab

  // Handle randomise — still works via SceneSelector / selections state
  const _handleRandomise = useCallback(() => {
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

  // Handle clear all (clears EVERYTHING: selections, provider, scene,
  // AI tiers, AI optimisation, optimizer toggle, human text via clearSignal)
  const handleClear = useCallback(() => {
    setSelections(EMPTY_SELECTIONS);
    setSelectedProviderId(null);
    setOptimizerEnabled(false);
    clearAiOptimise();
    onDescribeClear?.();
    // Trigger DescribeYourImage internal reset (textarea, hasGenerated, formatWarning)
    setClearSignal((s) => s + 1);
  }, [clearAiOptimise, onDescribeClear, setOptimizerEnabled]);

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
        families: [],
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
    [activeTier, activeTierPromptText, generatedPrompts, savePrompt, selectedProvider, selectedProviderId, selections],
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
        {/* Main header row: Provider | Colour Legend | Optimizer */}
        <div className="flex items-center gap-3">
          <ProviderSelector
            providers={providers}
            selectedId={selectedProviderId}
            onSelect={handleProviderSelect}
          />

          {/* Pro Promagen: Colour legend */}
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
        </div>

        {/* Show selected provider tier info */}
        {selectedProvider && (
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-300">
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
        {/* Scene Starters REMOVED — Prompt Lab is algorithm-only.  */}
        {/* Scene Starters remain in standard builder.              */}
        {/* ════════════════════════════════════════════════════════ */}

        {/* ════════════════════════════════════════════════════════ */}
        {/* Describe Your Image — Human Sentence Conversion         */}
        {/* The primary input for the Prompt Lab. User types or     */}
        {/* pastes natural text, clicks Generate, algorithms run.   */}
        {/* Authority: human-sentence-conversion.md                  */}
        {/* ════════════════════════════════════════════════════════ */}
        <DescribeYourImage
          categoryState={categoryStateForScene}
          setCategoryState={setCategoryStateAdapter}
          isLocked={false}
          defaultExpanded={true}
          onTextChange={onDescribeTextChange}
          onGenerate={onDescribeGenerate}
          onClear={() => {
            onDescribeClear?.();
            clearAiOptimise();
            setSelections(EMPTY_SELECTIONS);
            setOptimizerEnabled(false);
          }}
          isDrifted={isDrifted}
          driftChangeCount={driftChangeCount}
          clearSignal={clearSignal}
          skipInternalParse={skipInternalParse}
          externalLoading={externalLoading}
          coverageData={coverageData}
        />

        {/* Full-width single column */}
        <div className="space-y-4">

            {/* ═══════════════════════════════════════════════════ */}
            {/* REMOVED: Selection Echo Strip (dropdown chips)      */}
            {/* REMOVED: 12 Category Dropdowns + Explore Drawers   */}
            {/* REMOVED: Aspect Ratio Selector                     */}
            {/* REMOVED: Live Diff Overlay (Static↔Dynamic)         */}
            {/* Call 2 AI generates tier prompts directly from      */}
            {/* human text — no dropdown intermediary needed.        */}
            {/* ═══════════════════════════════════════════════════ */}

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
                            <span className="text-slate-300">in</span>
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
                    {colourTermIndex.size > 0
                      ? (() => {
                          const segments = parsePromptIntoSegments(assembledDisplayText, colourTermIndex);
                          const hasAnatomy = segments.some((s) => s.category !== 'structural');
                          if (!hasAnatomy) return assembledDisplayText;
                          return segments.map((seg, i) => {
                            const c = CATEGORY_COLOURS[seg.category] ?? CATEGORY_COLOURS.structural;
                            return (
                              <span key={i} style={{ color: c, textShadow: seg.weight >= 1.05 ? `0 0 10px ${c}50` : undefined }}>
                                {seg.text}
                              </span>
                            );
                          });
                        })()
                      : assembledDisplayText
                    }
                    {/* Typewriter cursor */}
                    {isAssembledTyping && (
                      <span className="animate-pulse" style={{ color: '#94A3B8' }}>▌</span>
                    )}
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
                              : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
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
                isPro={isPro || colourTermIndex.size > 0}
                termIndex={colourTermIndex}
                isTierGenerating={isTierGenerating}
                generatedForProvider={generatedForProvider}
                providers={providers}
                activeCategories={activeCategories}
                generationId={generationId}
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
                          <span className="text-amber-300">
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
                              <span className="text-slate-300">in</span>
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
                          {colourTermIndex.size > 0
                            ? (() => {
                                const segments = parsePromptIntoSegments(optimisedDisplayText, colourTermIndex);
                                const hasAnatomy = segments.some((s) => s.category !== 'structural');
                                if (!hasAnatomy) return optimisedDisplayText;
                                return segments.map((seg, i) => {
                                  const c = CATEGORY_COLOURS[seg.category] ?? CATEGORY_COLOURS.structural;
                                  return (
                                    <span key={i} style={{ color: c, textShadow: seg.weight >= 1.05 ? `0 0 10px ${c}50` : undefined }}>
                                      {seg.text}
                                    </span>
                                  );
                                });
                              })()
                            : optimisedDisplayText
                          }
                          {/* Typewriter cursor */}
                          {isOptimisedTyping && (
                            <span className="animate-pulse" style={{ color: '#6EE7B7' }}>▌</span>
                          )}
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
                  : 'cursor-not-allowed border-slate-800 bg-slate-900/50 text-slate-300'
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

          {/* Clear All button — purple gradient matching Dynamic/Randomise, white text */}
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition-all focus-visible:outline-none focus-visible:ring focus-visible:ring-purple-400/80 border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-white hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400 cursor-pointer"
          >
            Clear All
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
                : 'cursor-not-allowed border-slate-700 bg-slate-800/50 text-slate-300'
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
