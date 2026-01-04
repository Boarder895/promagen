// src/components/providers/length-indicator.tsx
// ============================================================================
// LENGTH INDICATOR
// ============================================================================
// Live character count indicator showing current vs optimal prompt length.
// Displays both original and optimized lengths when optimizer is enabled.
//
// Format:
// - Original: "285/350 ✓"
// - With optimization: "Original: 520 chars → Optimized: 380 chars"
//
// Color coding (Core Colours + warnings):
// - Sky-400: Under minimum (could add more)
// - Emerald-400: Optimal range (sweet spot)
// - Amber-400: Over ideal (will be trimmed)
// - Rose-500: Critical (exceeds platform max)
//
// Authority: docs/authority/prompt-builder-page.md
// ============================================================================

'use client';

import React, { useMemo } from 'react';
import type { PromptLengthAnalysis, LengthStatus } from '@/types/prompt-limits';
import {
  getStatusIcon,
  getStatusColorClass,
  getStatusBgClass,
  formatCharCount,
} from '@/lib/prompt-trimmer';

// ============================================================================
// TYPES
// ============================================================================

export interface LengthIndicatorProps {
  /** Current analysis data */
  analysis: PromptLengthAnalysis;
  /** Whether optimizer is enabled (shows comparison) */
  isOptimizerEnabled: boolean;
  /** Optimized length (when optimizer enabled) */
  optimizedLength?: number;
  /** Whether optimizer will trim on copy */
  willTrim?: boolean;
  /** Compact display mode */
  compact?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * LengthIndicator - Live character count display with color-coded status.
 *
 * Shows current length vs platform optimal range.
 * When optimizer is enabled, shows original → optimized comparison.
 */
export function LengthIndicator({
  analysis,
  isOptimizerEnabled,
  optimizedLength,
  willTrim = false,
  compact = false,
}: LengthIndicatorProps) {
  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const statusIcon = useMemo(() => getStatusIcon(analysis.status), [analysis.status]);
  const colorClass = useMemo(() => getStatusColorClass(analysis.status), [analysis.status]);
  const bgClass = useMemo(() => getStatusBgClass(analysis.status), [analysis.status]);

  // Calculate progress percentage (capped at 100%)
  const progressPercent = useMemo(() => {
    const target = analysis.idealMax;
    if (target <= 0) return 0;
    return Math.min(100, (analysis.currentLength / target) * 100);
  }, [analysis.currentLength, analysis.idealMax]);

  // Determine if we should show the optimization comparison
  const showOptimization = isOptimizerEnabled && willTrim && optimizedLength !== undefined;

  // ============================================================================
  // RENDER
  // ============================================================================

  // Compact mode: just the counter
  if (compact) {
    return (
      <span className={`text-xs font-medium ${colorClass}`}>
        {formatCharCount(analysis.currentLength)}/{formatCharCount(analysis.idealMax)} {statusIcon}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {/* Counter row */}
      <div className="flex items-center justify-between">
        {/* Left: Current count */}
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${colorClass}`}>
            {showOptimization ? (
              <>
                <span className="text-slate-400">Original: </span>
                <span className="text-amber-400">{formatCharCount(analysis.currentLength)}</span>
                <span className="mx-1.5 text-slate-500">→</span>
                <span className="text-slate-400">Optimized: </span>
                <span className="text-emerald-400">{formatCharCount(optimizedLength)}</span>
              </>
            ) : (
              <>
                {formatCharCount(analysis.currentLength)}/{formatCharCount(analysis.idealMax)}
                <span className="ml-1">{statusIcon}</span>
              </>
            )}
          </span>
        </div>

        {/* Right: Status label */}
        <span className={`text-[10px] font-medium uppercase tracking-wider ${colorClass}`}>
          {getStatusLabel(analysis.status)}
        </span>
      </div>

      {/* Progress bar */}
      <div className={`h-1 w-full overflow-hidden rounded-full ${bgClass}`}>
        <div
          className={`h-full rounded-full transition-all duration-300 ${getProgressBarColor(analysis.status)}`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Suggestions when under minimum */}
      {analysis.status === 'under' && analysis.suggestedCategories.length > 0 && (
        <p className="text-[10px] text-sky-400/80">
          💡 Try adding: {analysis.suggestedCategories.join(', ')}
        </p>
      )}

      {/* Trim warning when over */}
      {analysis.status === 'over' && isOptimizerEnabled && (
        <p className="text-[10px] text-amber-400/80">
          ↓ Prompt will be optimized on copy
        </p>
      )}

      {/* Critical warning */}
      {analysis.status === 'critical' && (
        <p className="text-[10px] text-rose-400/80">
          ⚠ Exceeds platform limit — will be trimmed
        </p>
      )}
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get human-readable status label.
 */
function getStatusLabel(status: LengthStatus): string {
  switch (status) {
    case 'under':
      return 'Add detail';
    case 'optimal':
      return 'Sweet spot';
    case 'over':
      return 'Will trim';
    case 'critical':
      return 'Over limit';
    default:
      return '';
  }
}

/**
 * Get progress bar fill color.
 */
function getProgressBarColor(status: LengthStatus): string {
  switch (status) {
    case 'under':
      return 'bg-sky-400';
    case 'optimal':
      return 'bg-emerald-400';
    case 'over':
      return 'bg-amber-400';
    case 'critical':
      return 'bg-rose-500';
    default:
      return 'bg-slate-400';
  }
}

// ============================================================================
// COMPACT VARIANT
// ============================================================================

/**
 * CompactLengthIndicator - Inline counter for header placement.
 */
export function CompactLengthIndicator({
  analysis,
}: {
  analysis: PromptLengthAnalysis;
}) {
  const colorClass = getStatusColorClass(analysis.status);
  const statusIcon = getStatusIcon(analysis.status);

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${colorClass}`}>
      <span className="tabular-nums">
        {formatCharCount(analysis.currentLength)}/{formatCharCount(analysis.idealMax)}
      </span>
      <span>{statusIcon}</span>
    </span>
  );
}

export default LengthIndicator;
