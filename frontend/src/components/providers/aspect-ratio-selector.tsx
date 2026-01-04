// src/components/providers/aspect-ratio-selector.tsx
// ============================================================================
// ASPECT RATIO SELECTOR v1.2.0
// ============================================================================
// FIXES in v1.2.0:
// - Removed lock overlay text - just show disabled styling (cleaner UX)
// - Buttons already have opacity-50 when disabled
// - No more "Sign in to continue" text over the AR grid
//
// Previous FIXES in v1.1.0:
// - Added green helper text for platforms without native AR support
// - Improved tooltip with clearer messaging
// - Better visual distinction for native vs composition-text AR
//
// Features:
// - 9 aspect ratio buttons with visual shapes
// - Tooltips showing use cases and platform support
// - Selection state with checkmark
// - Integrated with composition mode (static vs dynamic)
// - Platform-specific support indication (green dot = native)
// - Helpful guidance text for non-native platforms
//
// Authority: docs/authority/prompt-builder-page.md
// ============================================================================

'use client';

import { useState, useCallback, useMemo } from 'react';
import type { AspectRatioId, CompositionMode } from '@/types/composition';
import { VALID_ASPECT_RATIOS } from '@/types/composition';
import { getAspectRatio, getPlatformARSupport, platformSupportsAR } from '@/lib/composition-engine';

// ============================================================================
// TYPES
// ============================================================================

export interface AspectRatioSelectorProps {
  /** Currently selected aspect ratio */
  selected: AspectRatioId | null;
  /** Callback when selection changes */
  onSelect: (ratio: AspectRatioId | null) => void;
  /** Current platform ID */
  platformId: string;
  /** Current composition mode */
  compositionMode: CompositionMode;
  /** Whether selector is disabled */
  disabled?: boolean;
  /** Whether selector is locked (limit reached) - shows disabled styling only */
  isLocked?: boolean;
}

// ============================================================================
// ASPECT RATIO BUTTON
// ============================================================================

interface ARButtonProps {
  ratioId: AspectRatioId;
  isSelected: boolean;
  isNativelySupported: boolean;
  disabled: boolean;
  onClick: () => void;
  onShowTooltip: (show: boolean) => void;
}

function ARButton({
  ratioId,
  isSelected,
  isNativelySupported,
  disabled,
  onClick,
  onShowTooltip,
}: ARButtonProps) {
  const ar = getAspectRatio(ratioId);

  // Calculate visual shape dimensions (max 40px, scaled to ratio)
  const maxSize = 40;
  const ratio = ar.width / ar.height;
  let width: number;
  let height: number;

  if (ratio >= 1) {
    // Landscape or square
    width = maxSize;
    height = Math.round(maxSize / ratio);
  } else {
    // Portrait
    height = maxSize;
    width = Math.round(maxSize * ratio);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => onShowTooltip(true)}
      onMouseLeave={() => onShowTooltip(false)}
      onFocus={() => onShowTooltip(true)}
      onBlur={() => onShowTooltip(false)}
      className={`
        relative flex flex-col items-center justify-center gap-1.5 rounded-lg border p-2 transition-all
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/80
        ${
          isSelected
            ? 'border-purple-400 bg-purple-600/20 text-purple-100'
            : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-500 hover:bg-slate-800/50 hover:text-slate-200'
        }
        ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
      `}
      aria-label={`${ar.label} (${ar.id})${isSelected ? ' - selected' : ''}`}
      aria-pressed={isSelected}
    >
      {/* Ratio shape */}
      <div
        className={`
          flex items-center justify-center rounded-sm border
          ${isSelected ? 'border-purple-400 bg-purple-500/30' : 'border-slate-600 bg-slate-800'}
        `}
        style={{ width: `${width}px`, height: `${height}px` }}
      >
        {/* Native support indicator (small dot) */}
        {isNativelySupported && (
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" title="Native AR support" />
        )}
      </div>

      {/* Ratio label */}
      <span className="text-[10px] font-medium">{ar.id}</span>

      {/* Selected checkmark */}
      {isSelected && (
        <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-purple-500">
          <svg className="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      )}
    </button>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * AspectRatioSelector - Visual grid of aspect ratio options
 *
 * Displays 9 AR buttons with visual shapes. Shows platform support status
 * via green dot (native) or text injection indicator.
 */
export function AspectRatioSelector({
  selected,
  onSelect,
  platformId,
  compositionMode,
  disabled = false,
  isLocked = false,
}: AspectRatioSelectorProps) {
  const [tooltipRatio, setTooltipRatio] = useState<AspectRatioId | null>(null);

  // Get platform support info
  const platformSupport = useMemo(() => getPlatformARSupport(platformId), [platformId]);

  // Handle selection
  const handleSelect = useCallback(
    (ratioId: AspectRatioId) => {
      if (disabled || isLocked) return;

      // Toggle selection (click again to deselect)
      if (selected === ratioId) {
        onSelect(null);
      } else {
        onSelect(ratioId);
      }
    },
    [selected, onSelect, disabled, isLocked],
  );

  // Handle tooltip display
  const handleShowTooltip = useCallback((ratioId: AspectRatioId | null) => {
    setTooltipRatio(ratioId);
  }, []);

  // Generate tooltip content
  const tooltipContent = useMemo(() => {
    if (!tooltipRatio) return null;

    const ar = getAspectRatio(tooltipRatio);
    const isSupported = platformSupportsAR(platformId, tooltipRatio);

    return {
      label: ar.label,
      id: ar.id,
      useCase: ar.useCase,
      platforms: ar.useCasePlatforms.join(', '),
      isSupported,
      supportText: isSupported
        ? `✓ Native: --ar ${ar.width}:${ar.height}`
        : '→ Composition text will be embedded',
      mode: compositionMode,
      modeText:
        compositionMode === 'dynamic'
          ? '✨ Dynamic composition pack (context-aware)'
          : '📋 Static composition pack (fixed)',
    };
  }, [tooltipRatio, platformId, compositionMode]);

  // Platform helper text
  const platformHasNativeSupport = platformSupport.nativeSupport;
  const selectedIsNative = selected ? platformSupportsAR(platformId, selected) : false;

  return (
    <div className="relative">
      {/* Label */}
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium text-slate-200">
          Aspect Ratio
          <span className="ml-1 text-xs text-slate-500">(optional)</span>
        </div>
        {selected && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            disabled={disabled || isLocked}
            className="text-xs text-purple-400 hover:text-purple-300"
          >
            Clear
          </button>
        )}
      </div>

      {/* Description - Dynamic based on platform support */}
      <p className="mb-3 text-xs text-slate-500">
        Select an aspect ratio to include composition guidance in your prompt.
        {platformHasNativeSupport && (
          <span className="text-emerald-400">
            {' '}
            Green dot = native --ar support on this platform.
          </span>
        )}
      </p>

      {/* Ratio grid */}
      <div className="grid grid-cols-9 gap-2">
        {VALID_ASPECT_RATIOS.map((ratioId) => (
          <ARButton
            key={ratioId}
            ratioId={ratioId}
            isSelected={selected === ratioId}
            isNativelySupported={platformSupportsAR(platformId, ratioId)}
            disabled={disabled || isLocked}
            onClick={() => handleSelect(ratioId)}
            onShowTooltip={(show) => handleShowTooltip(show ? ratioId : null)}
          />
        ))}
      </div>

      {/* Green helper text for non-native AR platforms */}
      {selected && !platformHasNativeSupport && (
        <div className="mt-3 rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-3 py-2">
          <p className="text-xs text-emerald-300">
            <span className="font-medium">💡 Composition Enhancement:</span> Although this platform
            doesn&apos;t support native AR parameters, descriptive composition terms have been added
            to your prompt to help achieve your desired aspect ratio framing.
          </p>
        </div>
      )}

      {/* Green helper text when selected AR is NOT natively supported on a platform that has SOME native support */}
      {selected && platformHasNativeSupport && !selectedIsNative && (
        <div className="mt-3 rounded-lg border border-amber-800/50 bg-amber-950/30 px-3 py-2">
          <p className="text-xs text-amber-300">
            <span className="font-medium">⚠️ Note:</span> The {selected} ratio isn&apos;t natively
            supported on this platform. Composition text will be embedded instead. For native AR
            support, try: {platformSupport.supportedRatios.slice(0, 3).join(', ')}.
          </p>
        </div>
      )}

      {/* Tooltip */}
      {tooltipContent && (
        <div
          role="tooltip"
          className="absolute left-0 top-full z-50 mt-2 w-80 rounded-lg border border-slate-700 bg-slate-800/95 p-3 text-xs text-slate-200 shadow-xl backdrop-blur-sm"
        >
          {/* Arrow */}
          <div className="absolute -top-1.5 left-8 h-3 w-3 rotate-45 border-l border-t border-slate-700 bg-slate-800/95" />

          {/* Content */}
          <div className="relative space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">{tooltipContent.label}</span>
              <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300">
                {tooltipContent.id}
              </span>
            </div>

            <p className="text-slate-400">{tooltipContent.useCase}</p>

            <p className="text-slate-500">
              <span className="text-slate-400">Platforms:</span> {tooltipContent.platforms}
            </p>

            <div className="border-t border-slate-700 pt-2">
              <p className={tooltipContent.isSupported ? 'text-emerald-400' : 'text-amber-400'}>
                {tooltipContent.supportText}
              </p>
              <p className="mt-1 text-slate-400">{tooltipContent.modeText}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AspectRatioSelector;
