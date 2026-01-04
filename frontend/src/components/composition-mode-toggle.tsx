// src/components/composition-mode-toggle.tsx
// ============================================================================
// COMPOSITION MODE TOGGLE
// ============================================================================
// Toggle for switching between Static and Dynamic composition modes.
// Styled to match the ReferenceFrameToggle (purple-pink gradient).
//
// Visibility: ALWAYS VISIBLE
// - All users can toggle between Static and Dynamic
// - Dynamic mode showcases platform intelligence
// - Static mode provides predictable, learnable output
//
// Placement: Below Greenwich Meridian toggle (homepage) or in prompt builder header
//
// Authority: docs/authority/prompt-builder-page.md
// ============================================================================

'use client';

import { useCallback, useState } from 'react';
import type { CompositionMode } from '@/types/composition';

// ============================================================================
// TYPES
// ============================================================================

export interface CompositionModeToggleProps {
  /** Current composition mode */
  compositionMode: CompositionMode;
  /** Callback when mode changes */
  onModeChange: (mode: CompositionMode) => void;
  /** Whether toggle is disabled */
  disabled?: boolean;
  /** Compact mode (smaller, for inline use) */
  compact?: boolean;
}

// ============================================================================
// TOOLTIP CONTENT
// ============================================================================

const TOOLTIP_STATIC = `📋 Static Mode

Aspect ratios use fixed composition packs.

• Same output every time for each AR
• Predictable, learnable behaviour
• Great for beginners
• Example: 16:9 always adds "wide establishing shot, cinematic framing, subject on rule of thirds"`;

const TOOLTIP_DYNAMIC = `✨ Dynamic Mode

Aspect ratios assemble context-aware composition packs.

• Reads your Subject, Style, Camera, Lighting selections
• Generates unique composition hints per prompt
• Richer, more tailored results
• Great for power users

Example: 16:9 + samurai + cinematic style → "wide cinematic frame, warrior positioned on left third with action space, theatrical staging"`;

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * CompositionModeToggle - Switch between Static and Dynamic composition modes.
 *
 * Available to all users. Styled to match ReferenceFrameToggle (purple-pink gradient).
 */
export function CompositionModeToggle({
  compositionMode,
  onModeChange,
  disabled = false,
  compact = false,
}: CompositionModeToggleProps) {
  // ============================================================================
  // STATE
  // ============================================================================

  const [showTooltip, setShowTooltip] = useState(false);

  // ============================================================================
  // HANDLERS
  // ============================================================================

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
  const tooltipContent = isStatic ? TOOLTIP_STATIC : TOOLTIP_DYNAMIC;

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
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
      >
        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled}
          className={buttonClasses}
          aria-label={`Composition mode: ${currentLabel}. Click to switch to ${isStatic ? 'Dynamic' : 'Static'} mode.`}
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
            className={`${compact ? 'h-3 w-3' : 'h-4 w-4'} text-purple-300/70`}
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

        {/* Tooltip */}
        {showTooltip && (
          <div
            id="composition-mode-tooltip"
            role="tooltip"
            className="absolute left-0 top-full z-50 mt-2 w-80 rounded-lg border border-slate-700 bg-slate-800/95 p-3 text-xs text-slate-200 shadow-xl backdrop-blur-sm"
          >
            {/* Tooltip arrow */}
            <div className="absolute -top-1.5 left-4 h-3 w-3 rotate-45 border-l border-t border-slate-700 bg-slate-800/95" />

            {/* Tooltip content */}
            <div className="relative whitespace-pre-line leading-relaxed text-slate-300">
              {tooltipContent}
            </div>

            {/* Click instruction */}
            <p className="mt-2 text-[10px] text-slate-500">
              Click to switch to {isStatic ? 'Dynamic' : 'Static'} mode
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default CompositionModeToggle;
