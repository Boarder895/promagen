// src/hooks/use-prompt-optimization.ts
// ============================================================================
// USE PROMPT OPTIMIZATION HOOK v3.0.0
// ============================================================================
// React hook managing Text Length Optimizer state and logic.
//
// NEW in v3.0.0:
// - Uses gold-standard 4-phase optimizer (prompt-optimizer.ts)
// - Phase 0: Redundancy removal (free quality)
// - Phase 1: CLIP token overflow trim (free — invisible terms)
// - Phase 2: Position-aware scoring (category × position)
// - Phase 3: Weakest-term removal (surgical, one at a time)
// - Removed legacy category-removal trimmer and effectiveIdealMax flex
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
import type { PromptLengthAnalysis, OptimizedPrompt, PromptLimit } from '@/types/prompt-limits';

import {
  getPromptLimit,
  analyzePromptLength,
  formatCharCount,
  getStatusIcon,
  getStatusColorClass,
} from '@/lib/prompt-trimmer';

// Gold-standard 4-phase optimizer
import { optimizePromptGoldStandard } from '@/lib/prompt-optimizer';

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
  compositionMode = 'dynamic',
}: UsePromptOptimizationOptions): UsePromptOptimizationReturn {
  // ============================================================================
  // STATE
  // ============================================================================

  // Optimizer always starts OFF, no persistence between sessions
  const [isOptimizerEnabled, setOptimizerEnabled] = useState(false);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  // Get platform limits
  const limits = useMemo(() => getPromptLimit(platformId), [platformId]);

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
    const maxChars =
      limits.maxChars !== null ? `${formatCharCount(limits.maxChars)} characters` : 'Unlimited';

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
   *
   * Uses the gold-standard 4-phase pipeline:
   *   Phase 0: Redundancy removal (free — removes duplicate semantics)
   *   Phase 1: CLIP token overflow trim (free — invisible terms past token 77)
   *   Phase 2: Position-aware scoring (category_importance × position_decay)
   *   Phase 3: Weakest-term removal (surgical, one at a time)
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

    // Run gold-standard 4-phase optimizer
    const result = optimizePromptGoldStandard({
      promptText,
      selections,
      platformId,
      targetLength: limits.idealMax,
    });

    // Build human-readable removed term summaries
    const reasonLabels: Record<string, string> = {
      redundant: 'redundant',
      'past-token-limit': 'past CLIP limit',
      'lowest-score': 'low priority',
      compressed: 'compressed',
    };
    const termNames = result.removedTerms.map(
      (t) => `${t.term} (${reasonLabels[t.reason] ?? t.reason})`,
    );

    return {
      original: promptText,
      optimized: result.optimized,
      originalLength: result.originalLength,
      optimizedLength: result.optimizedLength,
      wasTrimmed: result.wasTrimmed,
      removedCategories: result.removedCategories,
      removedTermNames: termNames,
      removedTerms: result.removedTerms,
      achievedAtPhase: result.achievedAtPhase,
      status: analysis.status,
    };
  }, [isOptimizerEnabled, promptText, platformId, selections, analysis.status, limits.idealMax]);

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
 * Handles special cases like 'openai' -> 'OpenAI', 'adobe-firefly' -> 'Adobe Firefly'.
 */
function formatPlatformName(platformId: string): string {
  const specialCases: Record<string, string> = {
    openai: 'DALL\u00B7E 3',
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
    recraft: 'Recraft',
    kling: 'Kling AI',
    'luma-ai': 'Luma AI',
    'tensor-art': 'Tensor.Art',
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
