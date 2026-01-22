/**
 * usePromptIntelligence Hook
 * ==========================
 * Main state management hook for the intelligent prompt builder.
 * 
 * Features:
 * - Category selection state with tier-aware limits
 * - Real-time 4-tier prompt generation
 * - Conflict detection
 * - Style suggestions
 * - Market mood integration
 * - Auto-trim on platform switch
 * 
 * @version 1.0.0
 * @updated 2026-01-21
 */

'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import type {
  PromptSelections,
  PromptCategory,
  PlatformTier,
  GeneratedPrompts,
  ConflictWarning,
  StyleSuggestion,
  MarketMoodContext,
  SelectionLimits
} from '../types/prompt-intelligence';

import {
  EMPTY_SELECTIONS,
  CATEGORY_ORDER,
  getTierForPlatform,
  getLimitsForTier,
  getCategoryLimit
} from '../types/prompt-intelligence';

import { generateAllTierPrompts, generatePromptForTier } from '../lib/prompt-builder/generators';
import {
  detectConflicts,
  getStyleSuggestions,
  getMarketMoodContext,
  getPlatformHints,
  getWeatherSuggestions
} from '../lib/prompt-builder/intelligence';

// ============================================================================
// HOOK INTERFACE
// ============================================================================

export interface UsePromptIntelligenceOptions {
  platformId: string;
  isPro?: boolean;
  initialSelections?: Partial<PromptSelections>;
  marketState?: string;
  weather?: {
    temperature?: number;
    humidity?: number;
    conditions?: string;
    city?: string;
  };
}

export interface UsePromptIntelligenceReturn {
  // State
  selections: PromptSelections;
  tier: PlatformTier;
  limits: SelectionLimits;
  
  // Generated prompts
  prompts: GeneratedPrompts;
  currentPrompt: { positive: string; negative: string };
  
  // Intelligence
  conflicts: ConflictWarning[];
  suggestions: StyleSuggestion[];
  platformHints: string[];
  marketMood: MarketMoodContext | null;
  weatherSuggestions: string[];
  
  // Actions
  setSelection: (category: PromptCategory, values: string[]) => void;
  addToSelection: (category: PromptCategory, value: string) => void;
  removeFromSelection: (category: PromptCategory, value: string) => void;
  clearCategory: (category: PromptCategory) => void;
  clearAll: () => void;
  randomize: () => void;
  
  // Platform switching
  switchPlatform: (newPlatformId: string) => void;
  
  // Utilities
  canAddMore: (category: PromptCategory) => boolean;
  getLimit: (category: PromptCategory) => number;
  getCategoryConflicts: (category: PromptCategory) => string[];
  getCategorySuggestions: (category: PromptCategory) => StyleSuggestion[];
  
  // Copy helpers
  copyPrompt: (tier?: PlatformTier) => Promise<void>;
  getCopyText: (tier?: PlatformTier, includeNegative?: boolean) => string;
}

// ============================================================================
// RANDOMIZATION DATA
// ============================================================================

const RANDOM_OPTIONS: Record<PromptCategory, string[]> = {
  subject: [
    'portrait of a woman', 'ancient warrior', 'cyberpunk hacker', 'mythical dragon',
    'steampunk inventor', 'ethereal fairy', 'space explorer', 'samurai warrior',
    'forest spirit', 'underwater mermaid', 'phoenix rising', 'mechanical owl'
  ],
  action: [
    'standing confidently', 'in dynamic pose', 'meditating peacefully', 'flying through air',
    'casting spell', 'reading ancient book', 'wielding sword', 'dancing gracefully'
  ],
  style: [
    'oil painting', 'digital art', 'watercolor', 'concept art', 'anime style',
    'impressionist', 'art nouveau', 'cyberpunk aesthetic', 'fantasy art', 'photorealistic'
  ],
  environment: [
    'enchanted forest', 'cyberpunk city', 'ancient ruins', 'underwater palace',
    'mountain peak', 'space station', 'japanese garden', 'gothic cathedral'
  ],
  composition: [
    'rule of thirds', 'centered composition', 'dynamic diagonal', 'golden ratio',
    'symmetrical balance', 'frame within frame'
  ],
  camera: [
    '50mm lens', '85mm portrait', 'wide angle', 'macro shot', 'cinematic framing',
    'low angle', 'bird\'s eye view', 'dutch angle'
  ],
  lighting: [
    'golden hour', 'dramatic lighting', 'soft diffused', 'neon glow', 'moonlight',
    'volumetric rays', 'rim lighting', 'chiaroscuro'
  ],
  atmosphere: [
    'mysterious', 'serene', 'dramatic', 'ethereal', 'melancholic', 'energetic',
    'mystical', 'peaceful', 'intense', 'dreamy'
  ],
  colour: [
    'vibrant colors', 'muted tones', 'warm palette', 'cool tones', 'teal and orange',
    'monochromatic', 'pastel colors', 'neon colors'
  ],
  materials: [
    'marble texture', 'chrome reflection', 'velvet fabric', 'weathered wood',
    'crystal surfaces', 'metallic sheen', 'organic textures'
  ],
  fidelity: [
    'highly detailed', 'masterpiece', '8k resolution', 'intricate details',
    'sharp focus', 'professional quality', 'award winning'
  ],
  negative: [
    'blurry', 'low quality', 'bad anatomy', 'watermark', 'signature', 'ugly',
    'deformed', 'mutation', 'extra limbs', 'poorly drawn'
  ]
};

// ============================================================================
// MAIN HOOK
// ============================================================================

export function usePromptIntelligence(
  options: UsePromptIntelligenceOptions
): UsePromptIntelligenceReturn {
  const { platformId, isPro = false, initialSelections, marketState, weather } = options;
  
  // Core state
  const [selections, setSelections] = useState<PromptSelections>(() => ({
    ...EMPTY_SELECTIONS,
    ...initialSelections
  }));
  
  const [currentPlatformId, setCurrentPlatformId] = useState(platformId);
  
  // Derived state
  const tier = useMemo(() => getTierForPlatform(currentPlatformId), [currentPlatformId]);
  const limits = useMemo(() => getLimitsForTier(tier, isPro), [tier, isPro]);
  
  // Generated prompts (memoized for performance)
  const prompts = useMemo(() => generateAllTierPrompts(selections), [selections]);
  const currentPrompt = useMemo(() => generatePromptForTier(selections, tier), [selections, tier]);
  
  // Intelligence (memoized)
  const conflicts = useMemo(() => detectConflicts(selections), [selections]);
  const suggestions = useMemo(() => getStyleSuggestions(selections), [selections]);
  const platformHints = useMemo(() => getPlatformHints(tier, selections), [tier, selections]);
  const marketMood = useMemo(
    () => marketState ? getMarketMoodContext(marketState) : null,
    [marketState]
  );
  const weatherSuggestions = useMemo(
    () => weather ? getWeatherSuggestions(weather) : [],
    [weather]
  );
  
  // =========================================================================
  // ACTIONS
  // =========================================================================
  
  /**
   * Set entire selection for a category (with limit enforcement)
   */
  const setSelection = useCallback((category: PromptCategory, values: string[]) => {
    const limit = getCategoryLimit(category, tier, isPro);
    const trimmedValues = values.slice(0, limit);
    
    setSelections(prev => ({
      ...prev,
      [category]: trimmedValues
    }));
  }, [tier, isPro]);
  
  /**
   * Add a value to a category (if under limit)
   */
  const addToSelection = useCallback((category: PromptCategory, value: string) => {
    const limit = getCategoryLimit(category, tier, isPro);
    
    setSelections(prev => {
      const current = prev[category];
      if (current.length >= limit) return prev;
      if (current.includes(value)) return prev;
      
      return {
        ...prev,
        [category]: [...current, value]
      };
    });
  }, [tier, isPro]);
  
  /**
   * Remove a value from a category
   */
  const removeFromSelection = useCallback((category: PromptCategory, value: string) => {
    setSelections(prev => ({
      ...prev,
      [category]: prev[category].filter((v: string) => v !== value)
    }));
  }, []);
  
  /**
   * Clear a single category
   */
  const clearCategory = useCallback((category: PromptCategory) => {
    setSelections(prev => ({
      ...prev,
      [category]: []
    }));
  }, []);
  
  /**
   * Clear all selections
   */
  const clearAll = useCallback(() => {
    setSelections(EMPTY_SELECTIONS);
  }, []);
  
  /**
   * Randomize all categories within limits
   */
  const randomize = useCallback(() => {
    const newSelections: PromptSelections = { ...EMPTY_SELECTIONS };
    
    for (const category of CATEGORY_ORDER) {
      const limit = getCategoryLimit(category, tier, isPro);
      const options = RANDOM_OPTIONS[category];
      const shuffled = [...options].sort(() => Math.random() - 0.5);
      
      // For negative, use more options
      const count = category === 'negative' 
        ? Math.min(limit, Math.floor(limit * 0.6) + 1)
        : Math.min(limit, category === 'style' || category === 'lighting' ? 2 : 1);
      
      newSelections[category] = shuffled.slice(0, count);
    }
    
    setSelections(newSelections);
  }, [tier, isPro]);
  
  /**
   * Switch platform and auto-trim selections
   */
  const switchPlatform = useCallback((newPlatformId: string) => {
    const newTier = getTierForPlatform(newPlatformId);
    const newLimits = getLimitsForTier(newTier, isPro);
    
    // Auto-trim selections to new limits
    setSelections(prev => {
      const trimmed: PromptSelections = { ...prev };
      
      for (const category of CATEGORY_ORDER) {
        const limit = newLimits[category];
        if (trimmed[category].length > limit) {
          trimmed[category] = trimmed[category].slice(0, limit);
        }
      }
      
      return trimmed;
    });
    
    setCurrentPlatformId(newPlatformId);
  }, [isPro]);
  
  // =========================================================================
  // UTILITIES
  // =========================================================================
  
  /**
   * Check if more values can be added to a category
   */
  const canAddMore = useCallback((category: PromptCategory): boolean => {
    const limit = getCategoryLimit(category, tier, isPro);
    return selections[category].length < limit;
  }, [selections, tier, isPro]);
  
  /**
   * Get limit for a category
   */
  const getLimit = useCallback((category: PromptCategory): number => {
    return getCategoryLimit(category, tier, isPro);
  }, [tier, isPro]);
  
  /**
   * Get conflicting terms for a specific category
   */
  const getCategoryConflicts = useCallback((category: PromptCategory): string[] => {
    return conflicts
      .filter(c => c.category1 === category || c.category2 === category)
      .map(c => c.category1 === category ? c.term2 : c.term1);
  }, [conflicts]);
  
  /**
   * Get suggestions relevant to a category
   */
  const getCategorySuggestions = useCallback((category: PromptCategory): StyleSuggestion[] => {
    // Style suggestions apply to style, lighting, atmosphere
    if (['style', 'lighting', 'atmosphere', 'colour'].includes(category)) {
      return suggestions.filter(s => {
        // Check if suggestion fits the category
        const term = s.term.toLowerCase();
        if (category === 'lighting' && (term.includes('light') || term.includes('glow'))) {
          return true;
        }
        if (category === 'atmosphere' && (term.includes('mood') || term.includes('atmosphere'))) {
          return true;
        }
        if (category === 'style') {
          return true;
        }
        return false;
      });
    }
    return [];
  }, [suggestions]);
  
  // =========================================================================
  // COPY HELPERS
  // =========================================================================
  
  /**
   * Get text for copying
   */
  const getCopyText = useCallback((targetTier?: PlatformTier, includeNegative?: boolean): string => {
    const t = targetTier ?? tier;
    const { positive, negative } = generatePromptForTier(selections, t);
    
    if (!includeNegative || !negative || t === 3) {
      return positive;
    }
    
    // For tier 2, negative is already formatted as --no
    if (t === 2) {
      return `${positive} ${negative}`;
    }
    
    // For tier 1 and 4, separate lines
    return `${positive}\n\nNegative: ${negative}`;
  }, [selections, tier]);
  
  /**
   * Copy prompt to clipboard
   */
  const copyPrompt = useCallback(async (targetTier?: PlatformTier): Promise<void> => {
    const t = targetTier ?? tier;
    const text = getCopyText(t, true);
    await navigator.clipboard.writeText(text);
  }, [tier, getCopyText]);
  
  // =========================================================================
  // EFFECTS
  // =========================================================================
  
  // Auto-trim on tier change (from isPro change)
  useEffect(() => {
    const newLimits = getLimitsForTier(tier, isPro);
    
    setSelections(prev => {
      let changed = false;
      const trimmed: PromptSelections = { ...prev };
      
      for (const category of CATEGORY_ORDER) {
        const limit = newLimits[category];
        if (trimmed[category].length > limit) {
          trimmed[category] = trimmed[category].slice(0, limit);
          changed = true;
        }
      }
      
      return changed ? trimmed : prev;
    });
  }, [tier, isPro]);
  
  // =========================================================================
  // RETURN
  // =========================================================================
  
  return {
    // State
    selections,
    tier,
    limits,
    
    // Generated prompts
    prompts,
    currentPrompt,
    
    // Intelligence
    conflicts,
    suggestions,
    platformHints,
    marketMood,
    weatherSuggestions,
    
    // Actions
    setSelection,
    addToSelection,
    removeFromSelection,
    clearCategory,
    clearAll,
    randomize,
    
    // Platform switching
    switchPlatform,
    
    // Utilities
    canAddMore,
    getLimit,
    getCategoryConflicts,
    getCategorySuggestions,
    
    // Copy helpers
    copyPrompt,
    getCopyText
  };
}

export default usePromptIntelligence;
