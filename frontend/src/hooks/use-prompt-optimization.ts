// src/hooks/use-prompt-optimization.ts
// ============================================================================
// USE PROMPT OPTIMIZATION HOOK v2.0.0
// ============================================================================
// React hook managing Text Length Optimizer state and logic.
// Provides real-time length analysis and optimization on copy.
//
// NEW in v2.0.0:
// - Integrates with Intelligence Preferences for smart trim control
// - When smartTrimEnabled=true: trims by semantic relevance (lowest scores first)
// - When smartTrimEnabled=false: trims by position (dumb trim, last items first)
//
// Features:
// - Always starts OFF (no persistence)
// - Real-time length analysis
// - Optimized prompt generation on demand
// - Platform-specific tooltip content
// - Category suggestions when under minimum
//
// Security:
// - No localStorage for optimizer state (always resets)
// - All processing client-side
// - No external API calls
// - Type-safe throughout
//
// Authority: docs/authority/prompt-builder-page.md
// ============================================================================

import { useState, useMemo, useCallback } from 'react';
import type { PromptSelections } from '@/types/prompt-builder';
import type {
  PromptLengthAnalysis,
  OptimizedPrompt,
  PromptLimit,
} from '@/types/prompt-limits';

import {
  getPromptLimit,
  analyzePromptLength,
  optimizePrompt,
  formatCharCount,
  getStatusIcon,
  getStatusColorClass,
} from '@/lib/prompt-trimmer';

// Import prompt intelligence for smart trim
import { smartTrimAssembledPrompt } from '@/lib/prompt-intelligence';
import { useIntelligencePreferences } from '@/hooks/use-intelligence-preferences';

// ============================================================================
// TYPES
// ============================================================================

export interface UsePromptOptimizationOptions {
  /** Platform identifier */
  platformId: string;
  /** Current assembled prompt text */
  promptText: string;
  /** Current category selections */
  selections: PromptSelections;
  /** Whether platform is in Midjourney family (uses --no syntax) */
  isMidjourneyFamily?: boolean;
  /** Composition mode (optimization disabled in static mode) */
  compositionMode?: 'static' | 'dynamic';
}

export interface UsePromptOptimizationReturn {
  /** Whether optimizer is enabled */
  isOptimizerEnabled: boolean;
  
  /** Toggle optimizer on/off */
  setOptimizerEnabled: (enabled: boolean) => void;
  
  /** Current length analysis (always calculated for indicator) */
  analysis: PromptLengthAnalysis;
  
  /** Platform-specific limits */
  limits: PromptLimit;
  
  /** Get optimized prompt for copying */
  getOptimizedPrompt: () => OptimizedPrompt;
  
  /** Whether toggle is disabled (static mode) */
  isToggleDisabled: boolean;
  
  /** Formatted indicator text (e.g., "285/350 ✓") */
  indicatorText: string;
  
  /** Indicator color class */
  indicatorColorClass: string;
  
  /** Status icon */
  statusIcon: string;
  
  /** Tooltip content for the toggle */
  tooltipContent: TooltipContent;
}

export interface TooltipContent {
  /** Platform name for header */
  platformName: string;
  /** Maximum characters */
  maxChars: string;
  /** Sweet spot range */
  sweetSpot: string;
  /** Platform-specific note */
  platformNote: string;
  /** Optimization benefit */
  benefit: string;
  /** Quality impact percentage */
  qualityImpact: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Platforms using Midjourney-style --no syntax */
const MIDJOURNEY_FAMILY = ['midjourney', 'bluewillow', 'nijijourney'];

// ============================================================================
// HOOK
// ============================================================================

/**
 * React hook for Text Length Optimizer functionality.
 *
 * @example
 * ```tsx
 * const {
 *   isOptimizerEnabled,
 *   setOptimizerEnabled,
 *   analysis,
 *   getOptimizedPrompt,
 *   indicatorText,
 * } = usePromptOptimization({
 *   platformId: 'midjourney',
 *   promptText: assembledPrompt,
 *   selections: currentSelections,
 * });
 * ```
 */
export function usePromptOptimization({
  platformId,
  promptText,
  selections,
  isMidjourneyFamily,
  compositionMode = 'dynamic',
}: UsePromptOptimizationOptions): UsePromptOptimizationReturn {
  // ============================================================================
  // STATE & PREFERENCES
  // ============================================================================

  // Optimizer always starts OFF, no persistence between sessions
  const [isOptimizerEnabled, setOptimizerEnabled] = useState(false);
  
  // Get intelligence preferences for smart trim control
  const { preferences: intelligencePrefs } = useIntelligencePreferences();

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  // Get platform limits
  const limits = useMemo(() => getPromptLimit(platformId), [platformId]);

  // Detect Midjourney family for negative handling
  const isMjFamily = useMemo(
    () => isMidjourneyFamily ?? MIDJOURNEY_FAMILY.includes(platformId.toLowerCase()),
    [platformId, isMidjourneyFamily],
  );

  // Analyze current prompt length (always calculated for indicator)
  const analysis = useMemo(
    () => analyzePromptLength(promptText, platformId, selections),
    [promptText, platformId, selections],
  );

  // Toggle is disabled in static mode
  const isToggleDisabled = compositionMode === 'static';

  // ============================================================================
  // INDICATOR FORMATTING
  // ============================================================================

  // Format indicator text
  const indicatorText = useMemo(() => {
    const current = formatCharCount(analysis.currentLength);
    const target = formatCharCount(analysis.idealMax);
    const icon = getStatusIcon(analysis.status);
    return `${current}/${target} ${icon}`;
  }, [analysis]);

  // Get indicator color class
  const indicatorColorClass = useMemo(
    () => getStatusColorClass(analysis.status),
    [analysis.status],
  );

  // Status icon
  const statusIcon = useMemo(() => getStatusIcon(analysis.status), [analysis.status]);

  // ============================================================================
  // TOOLTIP CONTENT
  // ============================================================================

  const tooltipContent = useMemo((): TooltipContent => {
    // Format platform name (capitalize, handle special cases)
    const platformName = formatPlatformName(platformId);

    // Format max chars
    const maxChars = limits.maxChars !== null
      ? `${formatCharCount(limits.maxChars)} characters`
      : 'Unlimited';

    // Format sweet spot
    const sweetSpot = `${limits.idealMin}-${limits.idealMax} chars (~${limits.idealWords} words)`;

    return {
      platformName,
      maxChars,
      sweetSpot,
      platformNote: limits.platformNote,
      benefit: limits.optimizationBenefit,
      qualityImpact: limits.qualityImpact,
    };
  }, [platformId, limits]);

  // ============================================================================
  // OPTIMIZATION HANDLER
  // ============================================================================

  /**
   * Get optimized prompt for copying.
   * Uses smart trim (by relevance) or dumb trim (by position) based on preferences.
   */
  const getOptimizedPrompt = useCallback((): OptimizedPrompt => {
    // If optimizer not enabled, return original
    if (!isOptimizerEnabled) {
      return {
        original: promptText,
        optimized: promptText,
        originalLength: promptText.length,
        optimizedLength: promptText.length,
        wasTrimmed: false,
        removedCategories: [],
        status: analysis.status,
      };
    }

    // Use smart trim if enabled in preferences
    if (intelligencePrefs.smartTrimEnabled) {
      // Smart trim: uses semantic relevance to decide what to remove
      const smartResult = smartTrimAssembledPrompt({
        promptText,
        selections,
        platformId,
        targetLength: limits.idealMax,
        preserveSubject: true, // Always protect subject
      });
      
      return {
        original: promptText,
        optimized: smartResult.optimized,
        originalLength: promptText.length,
        optimizedLength: smartResult.optimized.length,
        wasTrimmed: smartResult.wasTrimmed,
        removedCategories: [...new Set(smartResult.removedTerms.map(t => t.category))],
        status: analysis.status,
      };
    }

    // Dumb trim: uses position-based category trimming (default/legacy)
    return optimizePrompt(
      promptText,
      platformId,
      selections,
      isMjFamily ? 'midjourney' : 'other',
    );
  }, [
    isOptimizerEnabled,
    promptText,
    platformId,
    selections,
    isMjFamily,
    analysis.status,
    intelligencePrefs.smartTrimEnabled,
    limits.idealMax,
  ]);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    isOptimizerEnabled,
    setOptimizerEnabled,
    analysis,
    limits,
    getOptimizedPrompt,
    isToggleDisabled,
    indicatorText,
    indicatorColorClass,
    statusIcon,
    tooltipContent,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Format platform ID into display name.
 * Handles special cases like 'openai' → 'OpenAI', 'adobe-firefly' → 'Adobe Firefly'.
 */
function formatPlatformName(platformId: string): string {
  const specialCases: Record<string, string> = {
    openai: 'DALL·E 3',
    'google-imagen': 'Google Imagen',
    'adobe-firefly': 'Adobe Firefly',
    'microsoft-designer': 'Microsoft Designer',
    'imagine-meta': 'Meta Imagine',
    midjourney: 'Midjourney',
    'stable-diffusion': 'Stable Diffusion',
    stability: 'Stability AI',
    leonardo: 'Leonardo AI',
    novelai: 'NovelAI',
    deepai: 'DeepAI',
    nightcafe: 'NightCafe',
    bluewillow: 'BlueWillow',
    '123rf': '123RF',
    picsart: 'Picsart',
    pixlr: 'Pixlr',
    fotor: 'Fotor',
    canva: 'Canva',
    dreamstudio: 'DreamStudio',
    dreamlike: 'Dreamlike',
    artbreeder: 'Artbreeder',
    craiyon: 'Craiyon',
    playground: 'Playground AI',
    lexica: 'Lexica',
    openart: 'OpenArt',
    getimg: 'getimg.ai',
    clipdrop: 'ClipDrop',
    runway: 'Runway',
    ideogram: 'Ideogram',
    flux: 'Flux',
    bing: 'Bing Image Creator',
    hotpot: 'Hotpot.ai',
    visme: 'Visme',
    vistacreate: 'VistaCreate',
    'jasper-art': 'Jasper Art',
    photoleap: 'Photoleap',
    artguru: 'ArtGuru',
    artistly: 'Artistly',
    myedit: 'MyEdit',
    picwish: 'PicWish',
    'remove-bg': 'remove.bg',
    simplified: 'Simplified',
    freepik: 'Freepik',
  };

  const specialName = specialCases[platformId];
  if (specialName !== undefined) {
    return specialName;
  }

  // Default: capitalize each word
  return platformId
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ============================================================================
// EXPORT
// ============================================================================

export default usePromptOptimization;
