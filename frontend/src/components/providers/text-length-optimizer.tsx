// src/components/providers/text-length-optimizer.tsx
// ============================================================================
// TEXT LENGTH OPTIMIZER TOGGLE v1.1.0
// ============================================================================
// FIXES in v1.1.0:
// - Disabled state: 100% opacity Core Colours (not 30%)
// - Button styling: Matches CompositionModeToggle exactly (padding, shape, size)
// - Consistent visual hierarchy with adjacent Dynamic toggle
//
// Visual States:
// - OFF: Core Colours gradient outline (sky, emerald, indigo), muted text
// - ON: Purple gradient fill (brand), white text
// - DISABLED: Core Colours at FULL opacity (not grey, not dimmed)
//
// Placement: Right of Static/Dynamic toggle, separated by subtle divider.
//
// Authority: docs/authority/prompt-builder-page.md
// ============================================================================

'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { PromptLengthAnalysis } from '@/types/prompt-limits';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Close delay matches WeatherPromptTooltip and CommodityPromptTooltip (400ms) */
const CLOSE_DELAY_MS = 400;

// ============================================================================
// TYPES
// ============================================================================

export interface TextLengthOptimizerProps {
  /** Whether optimizer is enabled */
  isEnabled: boolean;
  /** Callback when toggle is clicked */
  onToggle: (enabled: boolean) => void;
  /** Platform ID for tooltip content */
  platformId: string;
  /** Platform display name for tooltip header */
  platformName: string;
  /** Whether toggle is disabled (Static mode active) */
  disabled?: boolean;
  /** Whether locked because user is anonymous (not signed in) */
  lockedForAnonymous?: boolean;
  /** Tooltip content */
  tooltipContent: {
    maxChars: string;
    sweetSpot: string;
    platformNote: string;
    benefit: string;
    qualityImpact: string;
  };
  /** Current analysis for live indicator in tooltip */
  analysis?: PromptLengthAnalysis | null;
  /** Compact mode for smaller display */
  compact?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * TextLengthOptimizer - Toggle for enabling prompt length optimization.
 *
 * Shows platform-specific tooltip with limits and expected quality impact.
 * Disabled state uses Core Colours at FULL opacity (not grey, not dimmed).
 * Button styling matches CompositionModeToggle exactly.
 */
export function TextLengthOptimizer({
  isEnabled,
  onToggle,
  platformName,
  disabled = false,
  lockedForAnonymous = false,
  tooltipContent,
  analysis,
  compact = false,
}: TextLengthOptimizerProps) {
  // ============================================================================
  // STATE
  // ============================================================================

  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
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
    onToggle(!isEnabled);
  }, [disabled, isEnabled, onToggle]);

  // Handle click for mobile (shows tooltip on tap)
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // If disabled, just show tooltip
      if (disabled) {
        setShowTooltip((prev) => !prev);
        e.preventDefault();
        return;
      }

      // Toggle optimizer
      handleToggle();
    },
    [disabled, handleToggle],
  );

  // Handle keyboard
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!disabled) {
          handleToggle();
        }
      }
    },
    [disabled, handleToggle],
  );

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setShowTooltip(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ============================================================================
  // STYLING - Matches CompositionModeToggle exactly
  // ============================================================================

  // Base classes - EXACT match to CompositionModeToggle
  const baseClasses = compact
    ? `inline-flex items-center justify-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium shadow-sm transition-all focus-visible:outline-none focus-visible:ring focus-visible:ring-purple-400/80`
    : `inline-flex items-center justify-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium shadow-sm transition-all focus-visible:outline-none focus-visible:ring focus-visible:ring-purple-400/80`;

  // State-specific classes
  let stateClasses: string;

  if (disabled) {
    // DISABLED: Core Colours at FULL opacity (100%), NOT dimmed, NOT grey
    // Same visual weight as Dynamic button but with Core Colours gradient
    stateClasses = `
      border-sky-500/70 bg-gradient-to-r from-sky-600/20 via-emerald-600/20 to-indigo-600/20
      text-slate-300
      cursor-not-allowed
    `;
  } else if (isEnabled) {
    // ON: Purple gradient fill (brand) - matches Dynamic toggle active state
    stateClasses = `
      border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20
      text-purple-100
      hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400
      cursor-pointer
    `;
  } else {
    // OFF: Core Colours gradient outline, muted but visible
    stateClasses = `
      border-sky-500/50 bg-gradient-to-r from-sky-600/10 via-emerald-600/10 to-indigo-600/10
      text-slate-400
      hover:border-sky-400/70 hover:from-sky-600/20 hover:via-emerald-600/20 hover:to-indigo-600/20 hover:text-slate-200
      cursor-pointer
    `;
  }

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
          ref={buttonRef}
          type="button"
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={`${baseClasses} ${stateClasses}`}
          aria-label={`Text Length Optimizer: ${isEnabled ? 'enabled' : 'disabled'}${disabled ? ' (disabled in Static mode)' : ''}`}
          aria-describedby="text-length-optimizer-tooltip"
          aria-pressed={isEnabled}
        >
          {/* Lightning bolt icon */}
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
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>

          {/* Label - shorter in compact mode */}
          <span className={compact ? 'max-w-[80px] truncate' : ''}>
            {compact ? 'Optimize' : 'Text Length Optimizer'}
          </span>

          {/* Toggle arrows - matches Dynamic toggle */}
          <svg
            className={`${compact ? 'h-3 w-3' : 'h-4 w-4'} ${disabled ? 'text-slate-300' : isEnabled ? 'text-purple-300' : 'text-slate-300'}`}
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
            ref={tooltipRef}
            id="text-length-optimizer-tooltip"
            role="tooltip"
            className="absolute left-0 top-full z-50 mt-2 w-80 rounded-lg border border-slate-700 bg-slate-800/95 p-4 text-sm shadow-xl backdrop-blur-sm"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {/* Tooltip arrow */}
            <div className="absolute -top-1.5 left-6 h-3 w-3 rotate-45 border-l border-t border-slate-700 bg-slate-800/95" />

            {/* Header */}
            <div className="relative mb-3">
              <h3 className="text-sm font-semibold text-slate-100">
                Text Length Optimizer for {platformName}
              </h3>
              <div className="mt-1 h-px w-full bg-slate-700" />
            </div>

            {/* Content */}
            <div className="relative space-y-2 text-sm">
              {/* Max chars */}
              <div className="flex justify-between">
                <span className="text-slate-200">Maximum:</span>
                <span className="text-white">{tooltipContent.maxChars}</span>
              </div>

              {/* Sweet spot */}
              <div className="flex justify-between">
                <span className="text-slate-200">Sweet spot:</span>
                <span className="text-white">{tooltipContent.sweetSpot}</span>
              </div>

              {/* Divider */}
              <div className="my-2 h-px w-full bg-slate-700/50" />

              {/* Platform note */}
              <div className="rounded bg-slate-900/50 p-2">
                <p className="text-white">
                  <span className="mr-1">💡</span>
                  {tooltipContent.platformNote}
                </p>
                <p className="mt-1 text-slate-200">
                  {tooltipContent.benefit}
                </p>
              </div>

              {/* Quality impact */}
              <div className="flex justify-between pt-1">
                <span className="text-slate-200">Expected improvement:</span>
                <span className="font-medium text-emerald-400">
                  ~{tooltipContent.qualityImpact}
                </span>
              </div>

              {/* Current status (if analysis available) */}
              {analysis && (
                <div className="mt-2 rounded bg-slate-900/50 p-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-200">Current:</span>
                    <span
                      className={`font-medium ${
                        analysis.status === 'optimal'
                          ? 'text-emerald-400'
                          : analysis.status === 'over' || analysis.status === 'critical'
                            ? 'text-amber-400'
                            : 'text-sky-400'
                      }`}
                    >
                      {analysis.currentLength} chars
                      {analysis.status === 'optimal' && ' ✓'}
                      {analysis.status === 'over' && ' (will trim)'}
                      {analysis.status === 'critical' && ' ⚠ (over max)'}
                      {analysis.status === 'under' && ' (could add more)'}
                    </span>
                  </div>

                  {/* Suggestions when under */}
                  {analysis.status === 'under' &&
                    analysis.suggestedCategories.length > 0 && (
                      <p className="mt-1 text-sm text-slate-200">
                        Try adding: {analysis.suggestedCategories.join(', ')}
                      </p>
                    )}
                </div>
              )}

              {/* Anonymous lock notice — clickable link to /sign-in */}
              {lockedForAnonymous && (
                <a
                  href="/sign-in"
                  className="mt-2 block w-full rounded-lg bg-purple-500/10 p-2.5 ring-1 ring-purple-500/20 hover:bg-purple-500/20 hover:ring-purple-400/30 transition-all cursor-pointer text-left"
                >
                  <p className="text-sm font-medium text-purple-200">
                    ✨ Sign in to unlock the optimizer
                  </p>
                  <p className="mt-0.5 text-sm text-slate-200">
                    See your prompts rewritten and tuned for each platform
                  </p>
                </a>
              )}

              {/* Static mode disabled notice */}
              {disabled && !lockedForAnonymous && (
                <p className="mt-2 text-sm text-amber-400">
                  Switch to Dynamic mode to enable
                </p>
              )}
            </div>

            {/* Footer instruction */}
            <p className="mt-3 text-xs text-slate-200">
              {lockedForAnonymous
                ? 'Sign in for free to unlock'
                : disabled
                  ? 'Switch to Dynamic mode to enable'
                  : isEnabled
                    ? 'Click to disable optimization'
                    : 'Click to enable optimization'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default TextLengthOptimizer;
