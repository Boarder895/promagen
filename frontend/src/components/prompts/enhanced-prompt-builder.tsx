// src/components/prompts/enhanced-prompt-builder.tsx
// ============================================================================
// ENHANCED PROMPT BUILDER v1.0.0 — Full Implementation
// ============================================================================
// Complete implementation matching the preview design:
// - Prompt DNA bar with coherence score
// - All 12 category dropdowns in 2-column grid
// - 4-Tier Prompt Variants with copy buttons
// - Intelligence panel sidebar (conflicts, suggestions, market mood)
// - Footer actions (Randomise, Clear All, Copy, Save)
//
// @version 1.0.0
// @updated 2026-01-21
// ============================================================================

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { trackPromptCopy } from '@/lib/analytics/providers';
import {
  getEnhancedCategoryConfig,
  getAllCategories,
  supportsNativeNegative,
  getCategoryChips,
} from '@/lib/prompt-builder';
import { Combobox } from '@/components/ui/combobox';
import { AspectRatioSelector } from '@/components/providers/aspect-ratio-selector';
import { usePromagenAuth } from '@/hooks/use-promagen-auth';
import { useCompositionMode } from '@/hooks/use-composition-mode';
import type {
  PromptCategory,
  CategoryState,
  PromptSelections as PartialPromptSelections,
} from '@/types/prompt-builder';
import { CATEGORY_ORDER } from '@/types/prompt-builder';
import { VALID_ASPECT_RATIOS, type AspectRatioId } from '@/types/composition';

// Prompt Intelligence imports
import { useIntelligencePreferences } from '@/hooks/use-intelligence-preferences';
import { useMarketMoodLive } from '@/hooks/use-market-mood-live';
import type { MarketState } from '@/lib/prompt-intelligence/types';

// 4-Tier Generation
import { generateAllTierPrompts } from '@/lib/prompt-builder/generators';
import type {
  GeneratedPrompts,
  PlatformTier,
  PromptSelections as FullPromptSelections,
} from '@/types/prompt-intelligence';
import { EMPTY_SELECTIONS } from '@/types/prompt-intelligence';

// Save to Library
import { useSavedPrompts } from '@/hooks/use-saved-prompts';
import { SavePromptModal, type SavePromptData } from '@/components/prompts/save-prompt-modal';

// ============================================================================
// Types
// ============================================================================

export interface EnhancedPromptBuilderProps {
  /** All available providers for the dropdown */
  providers?: Array<{ id: string; name: string }>;
  /** Pre-selected provider ID */
  initialProviderId?: string | null;
  /** Callback when prompt is copied */
  onCopy?: (tier: PlatformTier, text: string) => void;
}

export interface PromptBuilderProvider {
  id?: string;
  name: string;
}

// ============================================================================
// Constants
// ============================================================================

const _MIDJOURNEY_FAMILY = ['midjourney', 'bluewillow', 'nijijourney'];

// Platform tier mapping
const PLATFORM_TIER_MAP: Record<string, PlatformTier> = {
  // Tier 1: CLIP-based
  stability: 1,
  leonardo: 1,
  clipdrop: 1,
  nightcafe: 1,
  dreamstudio: 1,
  lexica: 1,
  novelai: 1,
  dreamlike: 1,
  getimg: 1,
  openart: 1,
  playground: 1,
  artguru: 1,
  'jasper-art': 1,
  // Tier 2: Midjourney family
  midjourney: 2,
  bluewillow: 2,
  nijijourney: 2,
  // Tier 3: Natural language
  openai: 3,
  'adobe-firefly': 3,
  ideogram: 3,
  runway: 3,
  'microsoft-designer': 3,
  bing: 3,
  flux: 3,
  'google-imagen': 3,
  'imagine-meta': 3,
  hotpot: 3,
  // Tier 4: Plain language
  canva: 4,
  craiyon: 4,
  deepai: 4,
  pixlr: 4,
  picwish: 4,
  fotor: 4,
  visme: 4,
  vistacreate: 4,
  myedit: 4,
  simplified: 4,
  freepik: 4,
  picsart: 4,
  photoleap: 4,
  artbreeder: 4,
  '123rf': 4,
  'remove-bg': 4,
  artistly: 4,
};

const getTierForPlatform = (platformId: string): PlatformTier => {
  return PLATFORM_TIER_MAP[platformId.toLowerCase()] ?? 1;
};

// Tier visual configs
const TIER_VISUAL_CONFIGS = {
  1: {
    name: 'CLIP/SD',
    color: 'from-blue-500/20 to-cyan-500/20',
    border: 'border-blue-500/50',
    accent: 'text-blue-400',
    features: ['(term:weight)', 'comma syntax', 'quality tags'],
  },
  2: {
    name: 'Midjourney',
    color: 'from-purple-500/20 to-pink-500/20',
    border: 'border-purple-500/50',
    accent: 'text-purple-400',
    features: ['--ar params', '--style', '--no negative'],
  },
  3: {
    name: 'DALL-E/NatLang',
    color: 'from-emerald-500/20 to-teal-500/20',
    border: 'border-emerald-500/50',
    accent: 'text-emerald-400',
    features: ['full sentences', 'descriptive', 'no syntax'],
  },
  4: {
    name: 'Free Tier',
    color: 'from-orange-500/20 to-amber-500/20',
    border: 'border-orange-500/50',
    accent: 'text-orange-400',
    features: ['simple terms', 'short prompts', 'basic'],
  },
};

// Helper to map MarketState to simple mood category
type MoodCategory = 'bullish' | 'bearish' | 'neutral';
function getMarketMoodCategory(state: MarketState | null | undefined): MoodCategory {
  if (!state) return 'neutral';
  const bullishTypes = [
    'market_opening',
    'currency_strength_usd',
    'currency_strength_gbp',
    'currency_strength_eur',
    'gold_rising',
    'crypto_pumping',
  ];
  const bearishTypes = ['market_closing', 'high_volatility', 'gold_falling'];
  if (bullishTypes.includes(state.type)) return 'bullish';
  if (bearishTypes.includes(state.type)) return 'bearish';
  return 'neutral';
}

// Category icons
const CATEGORY_ICONS: Record<PromptCategory, string> = {
  subject: '👤',
  action: '🎬',
  style: '🎨',
  environment: '🌍',
  composition: '📐',
  camera: '📷',
  lighting: '💡',
  colour: '🎭',
  atmosphere: '🌫️',
  materials: '🧱',
  fidelity: '✨',
  negative: '🚫',
};

// Initial state for all categories
const createInitialState = (): Record<PromptCategory, CategoryState> => {
  const categories = getAllCategories();
  const state: Partial<Record<PromptCategory, CategoryState>> = {};
  for (const cat of categories) {
    state[cat] = { selected: [], customValue: '' };
  }
  return state as Record<PromptCategory, CategoryState>;
};

// Helper: pick random item
const pickRandom = <T,>(arr: T[]): T | undefined => {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
};

// ============================================================================
// Sub-Components
// ============================================================================

interface DNABarProps {
  selections: FullPromptSelections;
  coherenceScore: number;
}

function DNABar({ selections, coherenceScore }: DNABarProps) {
  const categories: PromptCategory[] = [
    'subject',
    'action',
    'style',
    'environment',
    'composition',
    'camera',
    'lighting',
    'colour',
    'atmosphere',
    'materials',
    'fidelity',
    'negative',
  ];

  const filledCount = categories.filter(
    (cat: PromptCategory) => selections[cat] && selections[cat]!.length > 0,
  ).length;

  return (
    <div className="rounded-xl bg-slate-900/80 border border-white/10 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">🧬</span>
          <span className="font-semibold text-white text-sm">Prompt DNA</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xl font-bold ${
              coherenceScore > 70
                ? 'text-emerald-400'
                : coherenceScore > 50
                  ? 'text-yellow-400'
                  : 'text-red-400'
            }`}
          >
            {coherenceScore}%
          </span>
          <span className="text-white/50 text-xs">coherence</span>
        </div>
      </div>

      {/* Main progress bar */}
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 transition-all duration-500"
          style={{ width: `${coherenceScore}%` }}
        />
      </div>

      {/* Category fill indicators */}
      <div className="flex gap-0.5 mt-2">
        {categories.map((cat) => (
          <div
            key={cat}
            className={`flex-1 h-1.5 rounded-full transition-colors ${
              selections[cat] && selections[cat]!.length > 0 ? 'bg-emerald-500/60' : 'bg-white/10'
            }`}
            title={cat}
          />
        ))}
      </div>

      <p className="text-xs text-white/40 mt-1">
        {filledCount} of {categories.length} categories filled
      </p>
    </div>
  );
}

interface TierCardProps {
  tier: PlatformTier;
  prompt: string;
  negative: string;
  isActive: boolean;
  onSelect: () => void;
  onCopy: () => void;
  copied: boolean;
}

function TierCard({ tier, prompt, negative, isActive, onSelect, onCopy, copied }: TierCardProps) {
  const config = TIER_VISUAL_CONFIGS[tier];

  // Combine prompt with negative for tier 2
  const displayPrompt = tier === 2 && negative ? `${prompt} ${negative}` : prompt;

  return (
    <div
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect?.();
        }
      }}
      role="button"
      tabIndex={0}
      className={`relative rounded-lg border-2 p-3 cursor-pointer transition-all duration-300 hover:scale-[1.01] ${
        isActive
          ? `${config.border} bg-gradient-to-br ${config.color} ring-1 ring-offset-1 ring-offset-slate-950 ring-white/20`
          : 'border-white/10 bg-white/5 hover:border-white/20'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
              isActive ? 'bg-white text-black' : 'bg-white/10 text-white/60'
            }`}
          >
            {tier}
          </span>
          <span className={`font-medium text-sm ${isActive ? 'text-white' : 'text-white/70'}`}>
            {config.name}
          </span>
        </div>
        {isActive && (
          <span className="px-1.5 py-0.5 bg-white/20 rounded text-xs text-white">Active</span>
        )}
      </div>

      {/* Features */}
      <div className="flex flex-wrap gap-1 mb-2">
        {config.features.map((feature, i) => (
          <span
            key={i}
            className={`px-1.5 py-0.5 rounded text-xs font-mono ${
              isActive ? 'bg-white/20 text-white/80' : 'bg-white/5 text-white/40'
            }`}
          >
            {feature}
          </span>
        ))}
      </div>

      {/* Prompt preview */}
      <div
        className={`rounded p-2 font-mono text-xs max-h-20 overflow-y-auto ${
          isActive ? 'bg-black/30' : 'bg-black/20'
        }`}
      >
        <p
          className={`break-words leading-relaxed ${
            isActive ? 'text-white/90' : 'text-white/60'
          } ${!displayPrompt && 'italic'}`}
        >
          {displayPrompt
            ? displayPrompt.length > 150
              ? displayPrompt.slice(0, 150) + '...'
              : displayPrompt
            : 'Select options to generate prompt...'}
        </p>
      </div>

      {/* Copy button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onCopy();
        }}
        disabled={!displayPrompt}
        className={`mt-2 w-full py-1.5 rounded font-medium text-xs flex items-center justify-center gap-1 transition-all ${
          displayPrompt
            ? isActive
              ? 'bg-white text-black hover:bg-white/90'
              : 'bg-white/10 text-white hover:bg-white/20'
            : 'bg-white/5 text-white/30 cursor-not-allowed'
        }`}
      >
        {copied ? '✓ Copied!' : `📋 Copy Tier ${tier}`}
      </button>
    </div>
  );
}

interface IntelligencePanelProps {
  conflicts: Array<{ term1: string; term2: string; severity: string; reason: string }>;
  suggestions: Array<{ term: string; reason: string; category?: PromptCategory }>;
  marketMoodEnabled: boolean;
  marketState?: MarketState;
  onSuggestionClick: (term: string, category?: PromptCategory) => void;
  onMarketToggle: () => void;
}

function IntelligencePanel({
  conflicts,
  suggestions,
  marketMoodEnabled,
  marketState,
  onSuggestionClick,
  onMarketToggle,
}: IntelligencePanelProps) {
  const [activeTab, setActiveTab] = useState<'conflicts' | 'suggestions' | 'market'>('suggestions');

  return (
    <div className="rounded-xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-white/10 bg-black/20">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
            <span>🧠</span>
            Prompt Intelligence
          </h3>
          <button
            onClick={onMarketToggle}
            className={`p-1 rounded transition-colors ${
              marketMoodEnabled ? 'text-emerald-400' : 'text-white/30'
            }`}
            title="Toggle Market Mood"
          >
            📈
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-2">
          <button
            onClick={() => setActiveTab('conflicts')}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              activeTab === 'conflicts'
                ? 'bg-white/20 text-white'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            ⚠️ Conflicts ({conflicts.length})
          </button>
          <button
            onClick={() => setActiveTab('suggestions')}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              activeTab === 'suggestions'
                ? 'bg-white/20 text-white'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            ✨ Suggest
          </button>
          {marketMoodEnabled && (
            <button
              onClick={() => setActiveTab('market')}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                activeTab === 'market'
                  ? 'bg-white/20 text-white'
                  : 'text-white/50 hover:text-white/70'
              }`}
            >
              📈 Market
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
        {/* Conflicts Tab */}
        {activeTab === 'conflicts' &&
          (conflicts.length > 0 ? (
            conflicts.map((conflict, i) => (
              <div
                key={i}
                className={`rounded-lg border p-2 ${
                  conflict.severity === 'critical'
                    ? 'bg-red-500/20 border-red-500/50'
                    : 'bg-orange-500/20 border-orange-500/50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-sm">{conflict.severity === 'critical' ? '🚫' : '⚠️'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <code className="px-1 py-0.5 bg-black/30 rounded text-xs font-mono text-white/80">
                        {conflict.term1}
                      </code>
                      <span className="text-xs opacity-60">↔</span>
                      <code className="px-1 py-0.5 bg-black/30 rounded text-xs font-mono text-white/80">
                        {conflict.term2}
                      </code>
                    </div>
                    <p className="text-xs text-white/60 mt-1">{conflict.reason}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-white/50 text-center py-4">✅ No conflicts detected</p>
          ))}

        {/* Suggestions Tab */}
        {activeTab === 'suggestions' && (
          <div className="space-y-3">
            {suggestions.length > 0 ? (
              <>
                <p className="text-xs text-white/60">Based on your selections:</p>
                <div className="flex flex-wrap gap-1">
                  {suggestions.slice(0, 8).map((s, i) => (
                    <button
                      key={i}
                      onClick={() => onSuggestionClick(s.term, s.category)}
                      className="px-2 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs hover:scale-105 transition-transform"
                      title={s.reason}
                    >
                      + {s.term}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-white/50 text-center py-4">
                Add selections to get suggestions
              </p>
            )}
          </div>
        )}

        {/* Market Tab */}
        {activeTab === 'market' &&
          marketMoodEnabled &&
          (() => {
            const mood = getMarketMoodCategory(marketState);
            return (
              <div
                className={`rounded-lg border p-3 ${
                  mood === 'bullish'
                    ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-500/50'
                    : mood === 'bearish'
                      ? 'bg-gradient-to-br from-red-500/20 to-orange-500/20 border-red-500/50'
                      : 'bg-gradient-to-br from-gray-500/20 to-slate-500/20 border-gray-500/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">
                    {mood === 'bullish' ? '📈' : mood === 'bearish' ? '📉' : '📊'}
                  </span>
                  <div>
                    <h4 className="font-semibold text-white text-sm capitalize">{mood} Market</h4>
                    <p className="text-xs text-white/60">Mood-based suggestions</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-white/50 mb-1">🎭 Atmosphere</p>
                    <div className="flex flex-wrap gap-1">
                      {(mood === 'bullish'
                        ? ['triumphant', 'energetic', 'ascending']
                        : mood === 'bearish'
                          ? ['dramatic', 'intense', 'stormy']
                          : ['balanced', 'calm', 'neutral']
                      ).map((t, i) => (
                        <button
                          key={i}
                          onClick={() => onSuggestionClick(t, 'atmosphere')}
                          className="px-1.5 py-0.5 bg-white/10 rounded text-xs text-white/80 hover:bg-white/20"
                        >
                          + {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-white/50 mb-1">🎨 Colours</p>
                    <div className="flex flex-wrap gap-1">
                      {(mood === 'bullish'
                        ? ['vibrant greens', 'gold accents', 'warm tones']
                        : mood === 'bearish'
                          ? ['deep reds', 'dark blues', 'moody shadows']
                          : ['neutral grays', 'soft pastels']
                      ).map((t, i) => (
                        <button
                          key={i}
                          onClick={() => onSuggestionClick(t, 'colour')}
                          className="px-1.5 py-0.5 bg-white/10 rounded text-xs text-white/80 hover:bg-white/20"
                        >
                          + {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function EnhancedPromptBuilder({
  providers = [],
  initialProviderId = null,
  onCopy,
}: EnhancedPromptBuilderProps) {
  // ============================================================================
  // State
  // ============================================================================

  const [selectedProviderId, _setSelectedProviderId] = useState<string | null>(initialProviderId);
  const [categoryState, setCategoryState] =
    useState<Record<PromptCategory, CategoryState>>(createInitialState);
  const [aspectRatio, setAspectRatio] = useState<AspectRatioId | null>(null);
  const [activeTier, setActiveTier] = useState<PlatformTier>(1);
  const [copiedTier, setCopiedTier] = useState<PlatformTier | null>(null);
  const [marketMoodEnabled, setMarketMoodEnabled] = useState(true);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savedConfirmation, setSavedConfirmation] = useState(false);

  // ============================================================================
  // Hooks
  // ============================================================================

  const platformId = selectedProviderId ?? 'default';
  const { compositionMode } = useCompositionMode();
  const { preferences: _preferences } = useIntelligencePreferences();
  const { marketState } = useMarketMoodLive(marketMoodEnabled);
  const { savePrompt } = useSavedPrompts();

  const {
    isAuthenticated: _isAuthenticated,
    userTier: _userTier,
    promptLockState,
    categoryLimits,
    platformTier: _platformTier,
    trackPromptCopy: trackUsageCallback,
  } = usePromagenAuth({
    platformId,
  });

  // ============================================================================
  // Computed Values
  // ============================================================================

  const isLocked = promptLockState !== 'unlocked';
  const allowNegativeFreeText = supportsNativeNegative(platformId);
  const isNeutralMode = selectedProviderId === null;

  // Current tier based on selected provider (or default to 1 in neutral mode)
  const _currentPlatformTier = useMemo<PlatformTier>(() => {
    if (isNeutralMode) return activeTier;
    return getTierForPlatform(selectedProviderId!);
  }, [isNeutralMode, selectedProviderId, activeTier]);

  // Build selections object from category state
  const selections = useMemo<FullPromptSelections>(() => {
    const result: FullPromptSelections = { ...EMPTY_SELECTIONS };
    for (const [cat, state] of Object.entries(categoryState)) {
      const allValues = [...state.selected];
      if (state.customValue.trim()) {
        allValues.push(state.customValue.trim());
      }
      if (allValues.length > 0) {
        result[cat as keyof FullPromptSelections] = allValues;
      }
    }
    return result;
  }, [categoryState]);

  const hasContent = Object.keys(selections).length > 0;

  // Generate all 4 tier prompts
  const generatedPrompts = useMemo<GeneratedPrompts>(() => {
    if (!hasContent) {
      return {
        tier1: '',
        tier2: '',
        tier3: '',
        tier4: '',
        negative: { tier1: '', tier2: '', tier3: '', tier4: '' },
      };
    }
    return generateAllTierPrompts(selections);
  }, [selections, hasContent]);

  // Coherence score (simplified calculation)
  const coherenceScore = useMemo(() => {
    const filledCategories = Object.keys(selections).length;
    const baseScore = Math.min(100, filledCategories * 8);
    // Bonus for having subject and style
    const hasCore = selections.subject?.length && selections.style?.length;
    return hasCore ? Math.min(100, baseScore + 20) : baseScore;
  }, [selections]);

  // Mock conflicts (would come from intelligence engine)
  const conflicts = useMemo(() => {
    // Simple conflict detection example
    const result: Array<{ term1: string; term2: string; severity: string; reason: string }> = [];
    const allTerms = Object.values(selections).flat();

    // Example: neon + golden hour conflict
    if (
      allTerms.some((t: string) => t.includes('neon')) &&
      allTerms.some((t: string) => t.includes('golden hour'))
    ) {
      result.push({
        term1: 'neon',
        term2: 'golden hour',
        severity: 'high',
        reason: 'Conflicting light sources - neon is artificial, golden hour is natural warm light',
      });
    }

    return result;
  }, [selections]);

  // Mock suggestions (would come from intelligence engine)
  const suggestions = useMemo(() => {
    const result: Array<{ term: string; reason: string; category?: PromptCategory }> = [];

    // Style-based suggestions
    const styles = selections.style || [];
    if (styles.some((s: string) => s.includes('cyberpunk') || s.includes('neon'))) {
      result.push(
        { term: 'holographic elements', reason: 'Complements cyberpunk', category: 'style' },
        { term: 'chrome surfaces', reason: 'Matches neon aesthetic', category: 'materials' },
        { term: 'rain reflections', reason: 'Adds atmosphere', category: 'atmosphere' },
      );
    }

    // Environment-based
    const env = selections.environment || [];
    if (env.some((e: string) => e.includes('city') || e.includes('urban'))) {
      result.push(
        { term: 'volumetric fog', reason: 'Adds urban atmosphere', category: 'atmosphere' },
        { term: 'wet pavement', reason: 'Enhances city mood', category: 'materials' },
      );
    }

    // Generic suggestions if empty
    if (result.length === 0 && hasContent) {
      result.push(
        { term: '8k resolution', reason: 'Quality boost', category: 'fidelity' },
        { term: 'highly detailed', reason: 'Quality boost', category: 'fidelity' },
      );
    }

    return result;
  }, [selections, hasContent]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleSelectChange = useCallback((category: PromptCategory, selected: string[]) => {
    setCategoryState((prev) => ({
      ...prev,
      [category]: { ...prev[category], selected },
    }));
  }, []);

  const handleCustomChange = useCallback((category: PromptCategory, customValue: string) => {
    setCategoryState((prev) => ({
      ...prev,
      [category]: { ...prev[category], customValue },
    }));
  }, []);

  const handleClear = useCallback(() => {
    setCategoryState(createInitialState());
    setAspectRatio(null);
  }, []);

  const handleRandomise = useCallback(() => {
    const newState = createInitialState();
    const categories = getAllCategories();

    for (const cat of categories) {
      const config = getEnhancedCategoryConfig(cat);
      if (config && config.options.length > 1) {
        const validOptions = config.options.filter((o: string) => o.trim() !== '');
        const randomPick = pickRandom(validOptions);
        if (randomPick) {
          newState[cat].selected = [randomPick];
        }
      }
    }

    // Random aspect ratio
    const validARs = VALID_ASPECT_RATIOS.filter((ar: string) => ar !== '');
    setAspectRatio(pickRandom(validARs) ?? null);
    setCategoryState(newState);
  }, []);

  const handleCopyTier = useCallback(
    async (tier: PlatformTier) => {
      const prompts = generatedPrompts;
      const tierMap = { 1: prompts.tier1, 2: prompts.tier2, 3: prompts.tier3, 4: prompts.tier4 };
      const negativeMap = {
        1: prompts.negative.tier1,
        2: prompts.negative.tier2,
        3: prompts.negative.tier3,
        4: prompts.negative.tier4,
      };

      let text = tierMap[tier];
      if (tier === 2 && negativeMap[tier]) {
        text = `${text} ${negativeMap[tier]}`;
      }

      if (!text) return;

      try {
        await navigator.clipboard.writeText(text);
        setCopiedTier(tier);
        setTimeout(() => setCopiedTier(null), 2000);

        // Track
        trackPromptCopy({ providerId: platformId, promptLength: text.length });
        trackUsageCallback(platformId);
        onCopy?.(tier, text);
      } catch (err) {
        console.error('Copy failed:', err);
      }
    },
    [generatedPrompts, platformId, trackUsageCallback, onCopy],
  );

  const handleSuggestionClick = useCallback((term: string, category?: PromptCategory) => {
    if (!category) return;
    setCategoryState((prev) => {
      const current = prev[category].selected;
      if (current.includes(term)) return prev;
      return {
        ...prev,
        [category]: { ...prev[category], selected: [...current, term] },
      };
    });
  }, []);

  const handleSavePrompt = useCallback(
    async (data: SavePromptData) => {
      const promptText = generatedPrompts.tier1;
      const selectedProvider = providers.find((p: { id: string }) => p.id === selectedProviderId);

      try {
        await savePrompt({
          name: data.name,
          platformId: selectedProviderId || 'default',
          platformName: selectedProvider?.name || 'Unknown',
          positivePrompt: promptText,
          negativePrompt: generatedPrompts.negative?.tier1 || '',
          selections: selections as PartialPromptSelections,
          customValues: {},
          families: [],
          mood: 'neutral',
          coherenceScore: 80,
          characterCount: promptText.length,
          notes: data.notes,
          tags: data.tags,
        });
        setShowSaveModal(false);
        setSavedConfirmation(true);
        setTimeout(() => setSavedConfirmation(false), 2000);
      } catch (err) {
        console.error('Save failed:', err);
      }
    },
    [savePrompt, selections, selectedProviderId, providers, generatedPrompts],
  );

  // ============================================================================
  // Render
  // ============================================================================

  const displayCategories = CATEGORY_ORDER;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-2xl">🧠</span>
              Enhanced Prompt Builder
            </h1>
            <p className="text-white/60 text-sm mt-1">
              4-Tier Prompt Generation + Intelligence Panel
            </p>
          </div>

          {/* Market Mood Toggle */}
          <button
            onClick={() => setMarketMoodEnabled(!marketMoodEnabled)}
            className={`px-3 py-1.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-all duration-300 ${
              marketMoodEnabled
                ? 'bg-gradient-to-r from-emerald-500/30 to-teal-500/30 border border-emerald-500/50 text-emerald-300'
                : 'bg-white/5 border border-white/10 text-white/50'
            }`}
          >
            <span>{marketMoodEnabled ? '📈' : '📊'}</span>
            Market Mood {marketMoodEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left Column - Categories & Tiers */}
        <div className="lg:col-span-3 space-y-4">
          {/* DNA Bar */}
          <DNABar selections={selections} coherenceScore={coherenceScore} />

          {/* Category Dropdowns - 2 column grid */}
          <div className="rounded-xl bg-slate-900/80 border border-white/10 p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {displayCategories.map((category) => {
                const config = getEnhancedCategoryConfig(category);
                if (!config) return null;

                const state = categoryState[category];
                const isNegative = category === 'negative';
                const maxSelections = categoryLimits[category] ?? 1;
                const allowFreeText = isNegative ? allowNegativeFreeText : true;
                const icon = CATEGORY_ICONS[category];

                return (
                  <div key={category} className={isNegative ? 'sm:col-span-2' : ''}>
                    <Combobox
                      id={`enhanced-${category}`}
                      label={`${icon} ${config.label}`}
                      options={config.options.filter((o: string) => o.trim() !== '')}
                      selected={state.selected}
                      customValue={state.customValue}
                      onSelectChange={(selected) => handleSelectChange(category, selected)}
                      onCustomChange={(value) => handleCustomChange(category, value)}
                      placeholder={`Select ${config.label.toLowerCase()}...`}
                      maxSelections={maxSelections}
                      maxCustomChars={50}
                      allowFreeText={allowFreeText}
                      isLocked={isLocked}
                      chipOptions={getCategoryChips(category, state.selected, state.customValue)}
                      chipSectionLabel="More options"
                    />
                  </div>
                );
              })}
            </div>

            {/* Aspect Ratio */}
            <div className="mt-4 pt-4 border-t border-white/10">
              <AspectRatioSelector
                selected={aspectRatio}
                onSelect={setAspectRatio}
                platformId={platformId}
                compositionMode={compositionMode}
                disabled={false}
                isLocked={isLocked}
              />
            </div>
          </div>

          {/* 4-Tier Preview */}
          <div className="rounded-xl bg-slate-900/80 border border-white/10 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <span className="text-xl">🎯</span>
                4-Tier Prompt Variants
              </h3>
              <p className="text-xs text-white/50">Same vision, different syntaxes</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {([1, 2, 3, 4] as PlatformTier[]).map((tier) => (
                <TierCard
                  key={tier}
                  tier={tier}
                  prompt={generatedPrompts[`tier${tier}` as keyof GeneratedPrompts] as string}
                  negative={
                    generatedPrompts.negative[`tier${tier}` as keyof GeneratedPrompts['negative']]
                  }
                  isActive={activeTier === tier}
                  onSelect={() => setActiveTier(tier)}
                  onCopy={() => handleCopyTier(tier)}
                  copied={copiedTier === tier}
                />
              ))}
            </div>

            {/* Educational Note */}
            <div className="mt-3 p-3 rounded-lg bg-gradient-to-r from-sky-500/10 via-emerald-500/10 to-indigo-500/10 border border-white/10">
              <p className="text-xs text-white/70">
                <strong>💡 Learn by comparison:</strong> Same vision, different syntaxes. Tier 1
                uses <code className="text-sky-400">(weights)</code>, Tier 2 uses{' '}
                <code className="text-purple-400">--params</code>, Tier 3 uses natural sentences,
                Tier 4 keeps it simple.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column - Intelligence Panel */}
        <div className="lg:col-span-1">
          <div className="sticky top-4">
            <IntelligencePanel
              conflicts={conflicts}
              suggestions={suggestions}
              marketMoodEnabled={marketMoodEnabled}
              marketState={marketState ?? undefined}
              onSuggestionClick={handleSuggestionClick}
              onMarketToggle={() => setMarketMoodEnabled(!marketMoodEnabled)}
            />
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="max-w-7xl mx-auto mt-4 flex flex-wrap items-center justify-center gap-2">
        <button
          onClick={handleRandomise}
          disabled={isLocked}
          className="px-4 py-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          🎲 Randomise
        </button>
        <button
          onClick={handleClear}
          disabled={!hasContent || isLocked}
          className="px-4 py-2 rounded-full bg-gradient-to-r from-sky-400 via-emerald-300 to-indigo-400 text-black text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          Clear All
        </button>
        <button
          onClick={() => handleCopyTier(activeTier)}
          disabled={!hasContent}
          className="px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white text-sm font-medium hover:bg-white/20 transition-colors disabled:opacity-50"
        >
          📋 Copy Active Tier
        </button>
        <button
          onClick={() => setShowSaveModal(true)}
          disabled={!hasContent || isLocked}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            savedConfirmation
              ? 'bg-emerald-500/30 border border-emerald-500/50 text-emerald-300'
              : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30'
          } disabled:opacity-50`}
        >
          {savedConfirmation ? '✓ Saved!' : '💾 Save'}
        </button>
      </div>

      {/* Save Modal */}
      <SavePromptModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSavePrompt}
        promptPreview={generatedPrompts.tier1.slice(0, 200)}
        platformName={
          selectedProviderId
            ? providers.find((p: { id: string; name: string }) => p.id === selectedProviderId)
                ?.name || 'All Platforms'
            : 'All Platforms'
        }
        suggestedName=""
      />
    </div>
  );
}
