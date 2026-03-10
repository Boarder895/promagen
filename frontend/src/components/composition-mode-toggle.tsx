// src/components/composition-mode-toggle.tsx
// ============================================================================
// COMPOSITION MODE TOGGLE — 3-Stage Pipeline Control
// ============================================================================
// Toggle for switching between Static and Dynamic prompt assembly modes.
// Styled to match the ReferenceFrameToggle (purple-pink gradient).
//
// 3-Stage Pipeline:
//   Static  → Raw user selections, comma-joined in category order. No intelligence.
//   Dynamic → Full platform-specific formatting (weights, reordering, quality tags,
//             sentence connectors). No length trimming — that's the optimizer's job.
//   Optimize button (separate) → Trims dynamic prompt to platform sweet spot.
//
// Tooltips are PLATFORM-SPECIFIC — each tier gets accurate feature descriptions.
//
// Visibility: ALWAYS VISIBLE
// - All users can toggle between Static and Dynamic
// - Dynamic mode showcases platform intelligence
// - Static mode provides predictable, raw output
//
// Placement: Prompt builder header row
//
// Authority: docs/authority/prompt-builder-page.md
// ============================================================================

'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { CompositionMode } from '@/types/composition';
import { getPlatformTierId, type PlatformTierId } from '@/data/platform-tiers';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Close delay matches WeatherPromptTooltip and CommodityPromptTooltip (400ms) */
const CLOSE_DELAY_MS = 400;

// ============================================================================
// TYPES
// ============================================================================

export interface CompositionModeToggleProps {
  /** Current composition mode */
  compositionMode: CompositionMode;
  /** Callback when mode changes */
  onModeChange: (mode: CompositionMode) => void;
  /** Platform ID for tier-specific tooltip content */
  platformId?: string;
  /** Whether toggle is disabled */
  disabled?: boolean;
  /** Compact mode (smaller, for inline use) */
  compact?: boolean;
}

// ============================================================================
// TOOLTIP CONTENT — PLATFORM-SPECIFIC
// ============================================================================

const TOOLTIP_STATIC = `📋 Static Mode

Your selections assembled exactly as picked — no intelligence.

• Comma-separated in category order
• No reordering, no weights, no quality tags
• What you pick is what you get
• Optimizer toggle disabled
• Great for power users who want full control`;

/**
 * Generate tier-specific Dynamic Mode tooltip.
 * Each tier gets accurate feature descriptions — no false claims.
 */
function getDynamicTooltip(tierId: PlatformTierId | undefined): string {
  switch (tierId) {
    case 1:
      // CLIP-Based: stability, dreamstudio, lexica, etc.
      return `✨ Dynamic Mode — CLIP Platform

Your selections formatted with full platform intelligence.

• Reorders terms by platform impact priority
• Applies CLIP emphasis weights, e.g. (samurai:1.2)
• Prepends quality boosters (masterpiece, best quality)
• Appends sharpness terms (sharp focus, 8K)
• Deduplicates across categories
• Separate negative prompt field
• Enable Optimize to trim to ideal length

Tip: Toggle Static → Dynamic to see what the intelligence adds.`;

    case 2:
      // Midjourney Family: midjourney, bluewillow
      return `✨ Dynamic Mode — Midjourney

Your selections formatted with Midjourney-specific intelligence.

• Reorders terms by impact priority (first words matter most)
• Builds --no block from your negative selections
• Protects parameters (--ar, --v, --s, --style)
• Steep position decay — front-loaded keywords dominate
• No CLIP weights — Midjourney uses its own attention system
• Enable Optimize to trim to ideal length

Tip: Toggle Static → Dynamic to see what the intelligence adds.`;

    case 3:
      // Natural Language: openai, firefly, ideogram, flux, etc.
      return `✨ Dynamic Mode — Natural Language

Your selections formatted as natural, readable sentences.

• Reorders by platform impact priority
• Builds grammatical sentences from your selections
• Converts negatives to positive phrasing (e.g. "blurry" → "sharp focus")
• No special syntax or weights needed — this platform reads naturally
• Deduplicates across categories
• Enable Optimize to trim to ideal length

Tip: Toggle Static → Dynamic to see what the intelligence adds.`;

    case 4:
      // Plain Language: canva, craiyon, picsart, etc.
      return `✨ Dynamic Mode — Simple Platform

Your selections formatted for this platform's simpler engine.

• Reorders by platform impact priority
• Keeps prompts short and focused
• No weights or complex syntax — this platform prefers simplicity
• Deduplicates across categories
• Enable Optimize to trim to ideal length

Tip: Toggle Static → Dynamic to see what the intelligence adds.`;

    default:
      return `✨ Dynamic Mode

Your selections formatted with platform intelligence.

• Reorders by platform impact priority
• Platform-native formatting applied
• Deduplicates across categories
• Enable Optimize to trim to ideal length

Tip: Toggle Static → Dynamic to see what the intelligence adds.`;
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * CompositionModeToggle - Switch between Static and Dynamic assembly modes.
 *
 * Static:  Raw comma-joined selections in category order (no intelligence).
 * Dynamic: Platform-specific formatting (weights, reordering, quality tags).
 *
 * Tooltip content is tier-specific — accurately describes what Dynamic mode
 * does for the currently selected platform.
 *
 * Available to all users. Styled to match ReferenceFrameToggle (purple-pink gradient).
 */
export function CompositionModeToggle({
  compositionMode,
  onModeChange,
  platformId,
  disabled = false,
  compact = false,
}: CompositionModeToggleProps) {
  // ============================================================================
  // STATE
  // ============================================================================

  const [showTooltip, setShowTooltip] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleMouseEnter = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setShowTooltip(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    closeTimerRef.current = setTimeout(() => {
      setShowTooltip(false);
      closeTimerRef.current = null;
    }, CLOSE_DELAY_MS);
  }, []);

  const handleToggle = useCallback(() => {
    if (disabled) return;

    const newMode: CompositionMode = compositionMode === 'static' ? 'dynamic' : 'static';
    onModeChange(newMode);
  }, [compositionMode, onModeChange, disabled]);

  // ============================================================================
  // COMPUTED
  // ============================================================================

  const isStatic = compositionMode === 'static';
  const currentLabel = isStatic ? 'Static' : 'Dynamic';

  // Get tier-specific tooltip content
  const tierId = useMemo(
    () => (platformId ? getPlatformTierId(platformId) : undefined),
    [platformId],
  );

  const tooltipContent = isStatic ? TOOLTIP_STATIC : getDynamicTooltip(tierId);

  // ============================================================================
  // STYLING
  // ============================================================================

  // Base classes matching ReferenceFrameToggle exactly
  const buttonClasses = compact
    ? `
        inline-flex items-center justify-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium shadow-sm transition-all
        focus-visible:outline-none focus-visible:ring focus-visible:ring-purple-400/80
        border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-purple-100
        hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `
    : `
        inline-flex items-center justify-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium shadow-sm transition-all
        focus-visible:outline-none focus-visible:ring focus-visible:ring-purple-400/80
        border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-purple-100
        hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `;

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="relative">
      <div
        className="relative"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleMouseEnter}
        onBlur={handleMouseLeave}
      >
        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled}
          className={buttonClasses}
          aria-label={`Assembly mode: ${currentLabel}. Click to switch to ${isStatic ? 'Dynamic' : 'Static'} mode.`}
          aria-describedby="composition-mode-tooltip"
        >
          {/* Mode icon */}
          {isStatic ? (
            // Static icon (clipboard/list)
            <svg
              className={compact ? 'h-3 w-3' : 'h-4 w-4'}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
              />
            </svg>
          ) : (
            // Dynamic icon (sparkles)
            <svg
              className={compact ? 'h-3 w-3' : 'h-4 w-4'}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
              />
            </svg>
          )}

          {/* Label */}
          <span className={compact ? 'max-w-[60px] truncate' : 'max-w-[80px] truncate'}>
            {currentLabel}
          </span>

          {/* Toggle arrows */}
          <svg
            className={`${compact ? 'h-3 w-3' : 'h-4 w-4'} text-purple-300`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 9l4-4 4 4m0 6l-4 4-4-4"
            />
          </svg>
        </button>

        {/* Tooltip — 400ms close delay matches flag prompt tooltips */}
        {showTooltip && (
          <div
            id="composition-mode-tooltip"
            role="tooltip"
            className="absolute left-0 top-full z-50 mt-2 w-80 rounded-lg border border-slate-700 bg-slate-800/95 p-3 text-sm shadow-xl backdrop-blur-sm"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {/* Tooltip arrow */}
            <div className="absolute -top-1.5 left-4 h-3 w-3 rotate-45 border-l border-t border-slate-700 bg-slate-800/95" />

            {/* Tooltip content */}
            <div className="relative whitespace-pre-line leading-relaxed text-white">
              {tooltipContent}
            </div>

            {/* Click instruction */}
            <p className="mt-2 text-xs text-slate-200">
              Click to switch to {isStatic ? 'Dynamic' : 'Static'} mode
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default CompositionModeToggle;
