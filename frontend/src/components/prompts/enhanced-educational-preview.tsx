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

import React, { useState, useMemo, useCallback } from 'react';
import { Combobox } from '@/components/ui/combobox';
import { FourTierPromptPreview } from '@/components/prompt-builder/four-tier-prompt-preview';
import { IntelligencePanel } from '@/components/prompt-builder/intelligence-panel';
import { MarketMoodToggle } from '@/components/prompt-intelligence';
import { SavePromptModal, type SavePromptData } from '@/components/prompts/save-prompt-modal';
import { useSavedPrompts } from '@/hooks/use-saved-prompts';
import { generateAllTierPrompts } from '@/lib/prompt-builder/enhanced-generators';
import { loadCategoryVocabulary, detectDominantFamily, type CategoryKey } from '@/lib/vocabulary/vocabulary-loader';
import { getPlatformTier } from '@/lib/compress';
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
  type MarketMoodContext,
} from '@/types/prompt-intelligence';
import type { Provider } from '@/types/providers';

// ============================================================================
// TYPES
// ============================================================================

export interface EnhancedEducationalPreviewProps {
  providers: Provider[];
  onSelectProvider: (providerId: string) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** All categories in the correct order (matching real prompt builder) */
const DISPLAY_CATEGORIES: PromptCategory[] = CATEGORY_ORDER;

/** Default tier for educational mode when no provider selected */
const DEFAULT_TIER: PlatformTier = 1;

// ============================================================================
// DNA BAR (FULL WIDTH HEADER VERSION)
// ============================================================================

interface DnaBarProps {
  selections: PromptSelections;
  dominantFamily: string | null;
}

function DnaBar({ selections, dominantFamily }: DnaBarProps) {
  // Calculate which categories have selections
  const filledCategories = useMemo(() => {
    return CATEGORY_ORDER.filter((cat: PromptCategory) => selections[cat].length > 0);
  }, [selections]);

  // Calculate coherence score
  const score = useMemo(() => {
    let filled = 0;
    const total = CATEGORY_ORDER.length;

    for (const cat of CATEGORY_ORDER) {
      if (selections[cat].length > 0) {
        filled++;
      }
    }

    // Base score from fill rate
    let baseScore = Math.round((filled / total) * 60);

    // Bonus for having a dominant family (coherent style)
    if (dominantFamily) {
      baseScore += 20;
    }

    // Bonus for having subject (essential)
    if (selections.subject.length > 0) {
      baseScore += 10;
    }

    // Bonus for having style
    if (selections.style.length > 0) {
      baseScore += 10;
    }

    return Math.min(100, baseScore);
  }, [selections, dominantFamily]);

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
      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        {/* Main progress bar */}
        <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${barGradient} transition-all duration-700 ease-out`}
            style={{ width: `${score}%` }}
          />
        </div>

        {/* Category segment indicators */}
        <div className="flex gap-0.5">
          {CATEGORY_ORDER.map((cat) => {
            const isFilled = filledCategories.includes(cat);
            const meta = CATEGORY_META[cat];
            return (
              <div
                key={cat}
                className={`flex-1 h-1 rounded-full transition-all duration-300 ${
                  isFilled ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-white/10'
                }`}
                title={`${meta.icon} ${meta.label}${isFilled ? ' ✓' : ''}`}
              />
            );
          })}
        </div>
      </div>

      {/* Score Display */}
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-xl font-bold tabular-nums ${scoreColor}`}>{score}%</span>
        <span className="text-[10px] text-white/40 hidden md:inline">coherence</span>
      </div>

      {/* Family Badge */}
      {dominantFamily && (
        <div className="shrink-0 px-2.5 py-1 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/40 rounded-full">
          <span className="text-[10px] font-medium text-purple-300 capitalize whitespace-nowrap">
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
}

function CategoryDropdown({
  category,
  selections,
  onSelectionChange,
  disabled = false,
  tier,
}: CategoryDropdownProps) {
  const meta = CATEGORY_META[category];
  const limit = STANDARD_LIMITS[tier][category];

  // Load vocabulary for this category
  const vocabulary = useMemo(() => {
    return loadCategoryVocabulary(category as CategoryKey);
  }, [category]);

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
        <span className="text-xs font-medium text-white/70">{meta.label}</span>
        {selections.length > 0 && (
          <span className="text-[10px] text-emerald-400/70">
            {selections.length}/{limit}
          </span>
        )}
      </div>
      <Combobox
        id={`edu-${category}`}
        label={meta.label}
        options={vocabulary.dropdownOptions}
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
// MOCK INTELLIGENCE DATA
// ============================================================================

function useMockIntelligence(selections: PromptSelections, dominantFamily: string | null) {
  const conflicts: ConflictWarning[] = useMemo(() => {
    const result: ConflictWarning[] = [];
    const allTerms = Object.values(selections)
      .flat()
      .map((t) => t.toLowerCase());

    if (allTerms.includes('neon glow') && allTerms.includes('golden hour')) {
      result.push({
        term1: 'neon glow',
        term2: 'golden hour',
        severity: 'high',
        reason: 'Conflicting light sources',
        category1: 'lighting',
        category2: 'lighting',
      });
    }

    return result;
  }, [selections]);

  const suggestions: StyleSuggestion[] = useMemo(() => {
    if (!dominantFamily) return [];

    const familySuggestions: Record<string, StyleSuggestion[]> = {
      cyberpunk: [
        {
          term: 'holographic elements',
          reason: 'Complements cyberpunk',
          familyId: 'cyberpunk',
          confidence: 0.9,
        },
        {
          term: 'rain reflections',
          reason: 'Enhances urban atmosphere',
          familyId: 'cyberpunk',
          confidence: 0.85,
        },
      ],
      fantasy: [
        {
          term: 'magical particles',
          reason: 'Enhances fantasy feel',
          familyId: 'fantasy',
          confidence: 0.9,
        },
        {
          term: 'ethereal glow',
          reason: 'Mystical lighting',
          familyId: 'fantasy',
          confidence: 0.85,
        },
      ],
    };

    return (
      familySuggestions[dominantFamily] || [
        {
          term: 'dramatic lighting',
          reason: 'Universal enhancement',
          familyId: 'general',
          confidence: 0.7,
        },
      ]
    );
  }, [dominantFamily]);

  const marketMood: MarketMoodContext = useMemo(
    () => ({
      state: 'bullish',
      moodTerms: ['optimistic', 'energetic', 'ascending'],
      colorSuggestions: ['vibrant greens', 'gold accents'],
      lightingSuggestions: ['golden hour', 'bright and airy'],
      atmosphereSuggestions: ['triumphant', 'energetic'],
    }),
    [],
  );

  const platformHints: string[] = useMemo(
    () => [
      '💡 Tier 1 (CLIP): Use (term:1.2) weights for emphasis',
      '💡 Tier 2 (MJ): Add --ar 16:9 for aspect ratio',
      '💡 Tier 3 (DALL·E): Write naturally',
    ],
    [],
  );

  const weatherSuggestions: string[] = useMemo(() => ['wet surfaces', 'rain droplets'], []);

  return { conflicts, suggestions, marketMood, platformHints, weatherSuggestions };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function EnhancedEducationalPreview({
  providers,
  onSelectProvider: _onSelectProvider,
}: EnhancedEducationalPreviewProps) {
  // State
  const [selections, setSelections] = useState<PromptSelections>(EMPTY_SELECTIONS);
  const [marketMoodEnabled, setMarketMoodEnabled] = useState(true);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savedConfirmation, setSavedConfirmation] = useState(false);
  const [copied, setCopied] = useState(false);

  // Save hook
  const { savePrompt } = useSavedPrompts();

  // Determine tier from selected provider (or default)
  const activeTier: PlatformTier = useMemo(() => {
    if (!selectedProviderId) return DEFAULT_TIER;
    const tier = getPlatformTier(selectedProviderId);
    return tier as PlatformTier;
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

  // Generate prompts from selections
  const generatedPrompts: GeneratedPrompts = useMemo(() => {
    // Cast to add index signature for generator compatibility
    return generateAllTierPrompts(selections as PromptSelections & Record<string, string[]>);
  }, [selections]);

  // Check if we have any content
  const hasContent = useMemo(() => {
    return Object.values(selections).some((arr) => arr.length > 0);
  }, [selections]);

  // Get intelligence data
  const { conflicts, suggestions, marketMood, platformHints, weatherSuggestions } =
    useMockIntelligence(selections, dominantFamily);

  // Suggested save name
  const suggestedSaveName = useMemo(() => {
    const subject = selections.subject[0];
    const style = selections.style[0];
    if (subject && style) return `${subject} - ${style}`;
    if (subject) return subject;
    if (style) return style;
    return 'Untitled Prompt';
  }, [selections]);

  // Handle provider selection - stays on this page
  const handleProviderSelect = useCallback((providerId: string | null) => {
    setSelectedProviderId(providerId);
  }, []);

  // Handle category selection change
  const handleCategoryChange = useCallback((category: PromptCategory, newSelections: string[]) => {
    setSelections((prev) => ({
      ...prev,
      [category]: newSelections,
    }));
  }, []);

  // Handle suggestion click
  const handleSuggestionClick = useCallback(
    (suggestion: StyleSuggestion) => {
      setSelections((prev) => ({
        ...prev,
        style: [...prev.style, suggestion.term].slice(0, STANDARD_LIMITS[activeTier].style),
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

  // Handle clear all (clears selections AND provider)
  const handleClear = useCallback(() => {
    setSelections(EMPTY_SELECTIONS);
    setSelectedProviderId(null);
  }, []);

  // Handle copy
  const handleCopy = useCallback(async () => {
    const tierKey = `tier${activeTier}` as keyof Omit<GeneratedPrompts, 'negative'>;
    const text = generatedPrompts[tierKey];
    if (text) {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [activeTier, generatedPrompts]);

  // Handle save
  const handleSavePrompt = useCallback(
    (data: SavePromptData) => {
      const tierKey = `tier${activeTier}` as keyof Omit<GeneratedPrompts, 'negative'>;
      const promptText = generatedPrompts[tierKey];
      const negativeTierKey = `tier${activeTier}` as keyof GeneratedPrompts['negative'];

      savePrompt({
        name: data.name,
        platformId: selectedProviderId || 'playground',
        platformName: selectedProvider?.name || 'Playground',
        positivePrompt: promptText,
        negativePrompt: generatedPrompts.negative[negativeTierKey] || '',
        selections: selections,
        customValues: {},
        families: dominantFamily ? [dominantFamily] : [],
        mood: 'neutral',
        coherenceScore: 80,
        characterCount: promptText.length,
        notes: data.notes,
        tags: data.tags,
      });

      setShowSaveModal(false);
      setSavedConfirmation(true);
      setTimeout(() => setSavedConfirmation(false), 2000);
    },
    [activeTier, generatedPrompts, savePrompt, selectedProvider, selectedProviderId, selections, dominantFamily],
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
        {/* Main header row: Provider | DNA Bar (stretches) | Market Mood */}
        <div className="flex items-center gap-3">
          <ProviderSelector
            providers={providers}
            selectedId={selectedProviderId}
            onSelect={handleProviderSelect}
          />

          {/* DNA Bar - flex-1 makes it stretch to fill available space */}
          <DnaBar selections={selections} dominantFamily={dominantFamily} />

          <div className="shrink-0">
            <MarketMoodToggle
              isEnabled={marketMoodEnabled}
              onToggle={() => setMarketMoodEnabled(!marketMoodEnabled)}
            />
          </div>
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Column: Categories + Preview */}
          <div className="lg:col-span-2 space-y-4">
            {/* Category Selections - 2 column grid, all 12 categories */}
            <div className="rounded-xl bg-slate-900/80 border border-white/10 p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {DISPLAY_CATEGORIES.map((category) => (
                  <CategoryDropdown
                    key={category}
                    category={category}
                    selections={selections[category]}
                    onSelectionChange={(newSel) => handleCategoryChange(category, newSel)}
                    tier={activeTier}
                  />
                ))}
              </div>
            </div>

            {/* 4-Tier Prompt Preview */}
            <div className="rounded-xl bg-slate-900/80 border border-white/10 p-4">
              <FourTierPromptPreview
                prompts={generatedPrompts}
                currentTier={activeTier}
                compact={false}
                showNegative={true}
                singleTierMode={singleTierMode}
              />
            </div>

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
                marketMood={marketMoodEnabled ? marketMood : null}
                weatherSuggestions={weatherSuggestions}
                tier={activeTier}
                onSuggestionClick={handleSuggestionClick}
                onMoodTermClick={handleMoodTermClick}
                compact={false}
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
                  ? 'border-slate-600 bg-slate-900 text-slate-50 hover:border-slate-400 hover:bg-slate-800'
                  : 'cursor-not-allowed border-slate-800 bg-slate-900/50 text-slate-600'
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
                Copy prompt
              </>
            )}
          </button>

          {/* Randomise button */}
          <button
            type="button"
            onClick={handleRandomise}
            className="inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition-all focus-visible:outline-none focus-visible:ring focus-visible:ring-purple-400/80 border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-purple-100 hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400"
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
                ? 'border-slate-600 bg-slate-800 text-slate-100 hover:border-slate-400 hover:bg-slate-700'
                : 'cursor-not-allowed border-slate-700 bg-slate-800/50 text-slate-500'
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
                  ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
                  : 'border-emerald-500/70 bg-gradient-to-r from-emerald-600/20 to-teal-600/20 text-emerald-100 hover:from-emerald-600/30 hover:to-teal-600/30 hover:border-emerald-400'
                : 'cursor-not-allowed border-slate-700 bg-slate-800/50 text-slate-500'
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

      {/* Save Prompt Modal */}
      <SavePromptModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSavePrompt}
        promptPreview={
          generatedPrompts[`tier${activeTier}` as keyof Omit<GeneratedPrompts, 'negative'>]
        }
        suggestedName={suggestedSaveName}
      />
    </section>
  );
}

export { EnhancedEducationalPreview };
