// src/components/fx/fx-picker.tsx
// ============================================================================
// REGIONAL FX PICKER - Pro Promagen Configuration (v2.0.0)
// ============================================================================
// A premium FX pair selection interface organised by geographic regions.
//
// FEATURES:
// - Sticky selection tray at top (selected pairs always visible)
// - Regional accordion groups (4 regions: Americas, Europe, Asia Pacific, MEA)
// - Search/filter across all regions
// - Progress bar showing selection count (0-16)
// - Regional "Select All" buttons
// - Dual SVG flags for each pair (base/quote currencies)
// - Ethereal glow effects matching Promagen design system
//
// GROUPING RULE (Option A):
// - EUR/USD → Europe (EUR is base, EU region)
// - USD/JPY → Americas (USD is base, US region)
// - GBP/ZAR → Europe (GBP is base, GB region)
//
// SCROLL BEHAVIOR:
// - Small screens: max-h-[400px] with scroll
// - Large screens: fills available space, scrolls when expanded regions overflow
// - All regions closed by default
//
// COMPLIANCE:
// - Error boundaries for malformed data (§11)
// - Accessibility: ARIA labels, keyboard navigation (§7)
// - Uniform scrollbar styling (§8.1)
// - Purple focus rings per buttons.md §2.1
//
// Authority: docs/authority/paid_tier.md §5.5
// Version: 2.0.0
// ============================================================================

'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import Image from 'next/image';
import { type FxRegion, FX_REGION_CONFIGS, type FxRegionConfig } from '@/lib/fx/fx-regions';
import {
  type FxPairOption,
  FX_SELECTION_LIMITS,
  groupByRegion,
  sortPairsInRegion,
  filterPairsByRegion,
  validateFxSelection,
  getPairsByIds,
} from '@/lib/fx/fx-picker-helpers';

// Re-export type for consumers
export type { FxPairOption };

// ============================================================================
// TYPES
// ============================================================================

export interface FxPickerProps {
  /** All available FX pairs with currency data */
  pairs: FxPairOption[];
  /** Currently selected pair IDs */
  selected: string[];
  /** Callback when selection changes */
  onChange: (ids: string[]) => void;
  /** Minimum selections allowed (default: 0 per paid_tier.md) */
  min?: number;
  /** Maximum selections allowed (default: 16 per paid_tier.md) */
  max?: number;
  /** Whether picker is disabled */
  disabled?: boolean;
}

// ============================================================================
// FLAG COMPONENT (uses /public/flags/{iso2}.svg)
// ============================================================================

interface FlagProps {
  iso2: string;
  size?: number;
  className?: string;
}

const Flag = React.memo(function Flag({ iso2, size = 20, className = '' }: FlagProps) {
  const [hasError, setHasError] = useState(false);

  if (!iso2 || typeof iso2 !== 'string' || iso2.length < 2) {
    return <span className={`inline-block ${className}`} style={{ width: size, height: size }} />;
  }

  const src = `/flags/${iso2.toLowerCase()}.svg`;

  if (hasError) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded bg-slate-700 text-[10px] font-bold text-slate-400 ${className}`}
        style={{ width: size, height: size }}
      >
        {iso2.toUpperCase().slice(0, 2)}
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={`inline-block rounded-sm object-cover ${className}`}
      onError={() => setHasError(true)}
      unoptimized
    />
  );
});

// ============================================================================
// DUAL FLAG PAIR DISPLAY
// ============================================================================

interface DualFlagProps {
  baseCode: string;
  quoteCode: string;
  size?: number;
}

const DualFlag = React.memo(function DualFlag({ baseCode, quoteCode, size = 18 }: DualFlagProps) {
  return (
    <div className="relative flex items-center" style={{ width: size * 1.5, height: size }}>
      <Flag iso2={baseCode} size={size} className="relative z-10" />
      <Flag iso2={quoteCode} size={size} className="relative ml-3 z-0 opacity-90" />
    </div>
  );
});

// ============================================================================
// SELECTION CHIP COMPONENT
// ============================================================================

interface SelectionChipProps {
  pair: FxPairOption;
  onRemove: () => void;
  disabled?: boolean;
}

const SelectionChip = React.memo(function SelectionChip({
  pair,
  onRemove,
  disabled = false,
}: SelectionChipProps) {
  if (!pair || !pair.id) {
    return null;
  }

  return (
    <div
      className="group relative inline-flex items-center gap-1.5 rounded-lg bg-slate-800/80 
                 px-2.5 py-1.5 ring-1 ring-white/10 transition-all duration-200
                 hover:bg-slate-700/80 hover:ring-sky-500/30"
    >
      <DualFlag baseCode={pair.baseCountryCode} quoteCode={pair.quoteCountryCode} size={14} />
      <span className="max-w-[60px] truncate text-xs font-medium text-slate-200">{pair.label}</span>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full
                   text-slate-500 transition-colors
                   hover:bg-red-500/20 hover:text-red-400
                   focus:outline-none focus-visible:ring-1 focus-visible:ring-purple-400/50
                   disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={`Remove ${pair.label}`}
      >
        <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
});

// ============================================================================
// PROGRESS BAR COMPONENT
// ============================================================================

interface ProgressBarProps {
  current: number;
  min: number;
  max: number;
}

const ProgressBar = React.memo(function ProgressBar({ current, min, max }: ProgressBarProps) {
  const percentage = Math.min((current / max) * 100, 100);
  const isBelowMin = current < min;
  const isNearMax = current >= max - 2;
  const isAtMax = current >= max;

  const getBarClasses = () => {
    if (isBelowMin) return 'bg-gradient-to-r from-red-500 to-orange-500';
    if (isAtMax) return 'bg-gradient-to-r from-amber-500 to-orange-500';
    if (isNearMax) return 'bg-gradient-to-r from-sky-400 to-amber-400';
    return 'bg-gradient-to-r from-sky-500 to-emerald-500';
  };

  const getCounterClasses = () => {
    if (isBelowMin) return 'text-red-400';
    if (isAtMax) return 'text-amber-400';
    if (isNearMax) return 'text-sky-300';
    return 'text-slate-400';
  };

  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800/80">
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${getBarClasses()}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className={`min-w-[4rem] text-right text-xs font-medium ${getCounterClasses()}`}>
        {current} / {max}
      </span>
    </div>
  );
});

// ============================================================================
// ACCORDION HEADER COMPONENT
// ============================================================================

interface AccordionHeaderProps {
  config: FxRegionConfig;
  isExpanded: boolean;
  selectedCount: number;
  totalCount: number;
  onToggle: () => void;
  onSelectAll: () => void;
  canSelectMore: boolean;
  disabled?: boolean;
}

const AccordionHeader = React.memo(function AccordionHeader({
  config,
  isExpanded,
  selectedCount,
  totalCount,
  onToggle,
  onSelectAll,
  canSelectMore,
  disabled = false,
}: AccordionHeaderProps) {
  const hasSelections = selectedCount > 0;
  const allSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 transition-colors
                  ${isExpanded ? 'bg-slate-800/50' : 'bg-transparent hover:bg-slate-800/30'}`}
    >
      {/* Toggle Button */}
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className="flex flex-1 items-center gap-3 text-left
                   focus:outline-none focus-visible:ring-1 focus-visible:ring-purple-400/50
                   disabled:cursor-not-allowed disabled:opacity-50"
        aria-expanded={isExpanded}
        aria-controls={`region-panel-${config.id}`}
      >
        {/* Emoji */}
        <span className="text-xl">{config.emoji}</span>

        {/* Region Name with gradient */}
        <span
          className={`bg-gradient-to-r ${config.gradient} bg-clip-text text-sm font-semibold text-transparent`}
        >
          {config.label}
        </span>

        {/* Count Badge */}
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium
                      ${hasSelections ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-700/50 text-slate-500'}`}
        >
          {selectedCount}/{totalCount}
        </span>

        {/* Chevron */}
        <svg
          className={`ml-auto h-4 w-4 text-slate-500 transition-transform duration-200
                      ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Select All Button */}
      {isExpanded && (
        <button
          type="button"
          onClick={onSelectAll}
          disabled={disabled || allSelected || !canSelectMore}
          className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium
                     text-slate-400 ring-1 ring-white/10 transition-all
                     hover:bg-sky-500/10 hover:text-sky-400 hover:ring-sky-500/30
                     focus:outline-none focus-visible:ring-1 focus-visible:ring-purple-400/50
                     disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`Select all pairs in ${config.label}`}
        >
          {allSelected ? 'All Selected' : 'Select All'}
        </button>
      )}
    </div>
  );
});

// ============================================================================
// PAIR LIST ITEM COMPONENT
// ============================================================================

interface PairListItemProps {
  pair: FxPairOption;
  isSelected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

const PairListItem = React.memo(function PairListItem({
  pair,
  isSelected,
  onToggle,
  disabled = false,
}: PairListItemProps) {
  // Determine if disabled because of max limit (not already selected)
  const isDisabledByLimit = disabled && !isSelected;

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={isDisabledByLimit}
      aria-pressed={isSelected}
      className={`flex items-center gap-10 px-4 py-3 text-left transition-all
                  border-b border-white/5 last:border-b-0
                  focus:outline-none focus-visible:ring-1 focus-visible:ring-purple-400/50
                  ${isSelected ? 'bg-sky-500/10 hover:bg-sky-500/15' : 'hover:bg-slate-800/50'}
                  ${isDisabledByLimit ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      {/* Dual Flags */}
      <DualFlag baseCode={pair.baseCountryCode} quoteCode={pair.quoteCountryCode} size={30} />

      {/* Pair Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-200">{pair.label}</span>
          {pair.category === 'major' && (
            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
              MAJOR
            </span>
          )}
        </div>
        {pair.countryLabel && (
          <p className="truncate text-xs text-slate-500">{pair.countryLabel}</p>
        )}
      </div>

      {/* Selection Indicator */}
      <div
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full
                    border-2 transition-all
                    ${
                      isSelected ? 'border-sky-400 bg-sky-500' : 'border-slate-600 bg-transparent'
                    }`}
      >
        {isSelected && (
          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
    </button>
  );
});

// ============================================================================
// MAIN FX PICKER COMPONENT
// ============================================================================

export default function FxPicker({
  pairs,
  selected,
  onChange,
  min = FX_SELECTION_LIMITS.MIN_PAIRS,
  max = FX_SELECTION_LIMITS.MAX_PAIRS,
  disabled = false,
}: FxPickerProps) {
  // ================================================================
  // STATE
  // ================================================================
  const [searchQuery, setSearchQuery] = useState('');
  // All regions closed by default
  const [expandedRegions, setExpandedRegions] = useState<Set<FxRegion>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ================================================================
  // DERIVED STATE
  // ================================================================

  // Sanitize selected IDs
  const safeSelected = useMemo(() => {
    if (!Array.isArray(selected)) return [];
    return selected
      .filter((id): id is string => typeof id === 'string' && id.trim() !== '')
      .map((id) => id.toLowerCase());
  }, [selected]);

  // Group pairs by region (BASE currency's region)
  const pairsByRegion = useMemo(() => {
    const grouped = groupByRegion(pairs);
    // Sort pairs within each region
    for (const [region, regionPairs] of grouped) {
      grouped.set(region, sortPairsInRegion(regionPairs));
    }
    return grouped;
  }, [pairs]);

  // Filter by search query
  const filteredPairs = useMemo(() => {
    return filterPairsByRegion(pairsByRegion, searchQuery);
  }, [pairsByRegion, searchQuery]);

  // Get selected pair objects (for chips)
  const selectedPairs = useMemo(() => {
    return getPairsByIds(pairs, safeSelected);
  }, [pairs, safeSelected]);

  // Validation
  const validation = useMemo(() => {
    return validateFxSelection(safeSelected, min, max);
  }, [safeSelected, min, max]);

  // Can add more?
  const canSelectMore = safeSelected.length < max;

  // ================================================================
  // HANDLERS
  // ================================================================

  const togglePair = useCallback(
    (pairId: string) => {
      const normalizedId = pairId.toLowerCase();
      const isCurrentlySelected = safeSelected.includes(normalizedId);

      if (isCurrentlySelected) {
        // Remove
        if (safeSelected.length <= min) return;
        onChange(safeSelected.filter((id) => id !== normalizedId));
      } else {
        // Add
        if (safeSelected.length >= max) return;
        onChange([...safeSelected, normalizedId]);
      }
    },
    [safeSelected, min, max, onChange],
  );

  const removePair = useCallback(
    (pairId: string) => {
      const normalizedId = pairId.toLowerCase();
      if (safeSelected.length <= min) return;
      onChange(safeSelected.filter((id) => id !== normalizedId));
    },
    [safeSelected, min, onChange],
  );

  const toggleRegion = useCallback((regionId: FxRegion) => {
    setExpandedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(regionId)) {
        next.delete(regionId);
      } else {
        next.add(regionId);
      }
      return next;
    });
  }, []);

  const selectAllInRegion = useCallback(
    (regionId: FxRegion) => {
      const regionPairs = pairsByRegion.get(regionId) || [];
      const regionIds = regionPairs.map((p) => p.id.toLowerCase());

      // Add all from region that aren't already selected (up to max)
      const newIds = [...safeSelected];
      for (const id of regionIds) {
        if (newIds.length >= max) break;
        if (!newIds.includes(id)) {
          newIds.push(id);
        }
      }

      onChange(newIds);
    },
    [pairsByRegion, safeSelected, max, onChange],
  );

  const resetAll = useCallback(() => {
    onChange([]);
  }, [onChange]);

  // ================================================================
  // AUTO-EXPAND ON SEARCH
  // ================================================================
  useEffect(() => {
    if (searchQuery.trim()) {
      // Expand regions that have search results
      const regionsWithResults = new Set<FxRegion>();
      for (const [region, regionPairs] of filteredPairs) {
        if (regionPairs.length > 0) {
          regionsWithResults.add(region);
        }
      }
      setExpandedRegions(regionsWithResults);
    }
  }, [searchQuery, filteredPairs]);

  // ================================================================
  // RENDER
  // ================================================================

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-xl bg-slate-900/95
                 ring-1 ring-white/10 backdrop-blur-sm"
      role="region"
      aria-label="FX pair picker"
    >
      {/* ================================================================== */}
      {/* STICKY SELECTION TRAY                                             */}
      {/* ================================================================== */}
      <div className="shrink-0 border-b border-white/5 bg-slate-900/80">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">💱</span>
            <h2 className="text-sm font-semibold text-slate-200">FX Pairs</h2>
          </div>

          {safeSelected.length > 0 && (
            <button
              type="button"
              onClick={resetAll}
              disabled={disabled}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium
                         text-slate-400 ring-1 ring-white/10 transition-all
                         hover:bg-red-500/10 hover:text-red-400 hover:ring-red-500/30
                         focus:outline-none focus-visible:ring-1 focus-visible:ring-purple-400/50
                         disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Reset
            </button>
          )}
        </div>

        {safeSelected.length > 0 ? (
          <div className="px-4 pb-3">
            <div
              className="flex max-h-24 flex-wrap gap-2 overflow-y-auto pr-1
                         scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20
                         hover:scrollbar-thumb-white/30"
            >
              {selectedPairs.map((pair) => (
                <SelectionChip
                  key={pair.id}
                  pair={pair}
                  onRemove={() => removePair(pair.id)}
                  disabled={disabled}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="px-4 pb-3">
            <p className="text-xs italic text-slate-500">
              No FX pairs selected. Browse regions below to add pairs.
            </p>
          </div>
        )}

        <div className="px-4 pb-3">
          <ProgressBar current={safeSelected.length} min={min} max={max} />
        </div>

        {!validation.valid && validation.message && (
          <div className="border-t border-red-500/20 bg-red-500/10 px-4 py-2">
            <p className="text-xs font-medium text-red-400">{validation.message}</p>
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* SEARCH BAR                                                        */}
      {/* ================================================================== */}
      <div className="shrink-0 border-b border-white/5 px-4 py-3">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by pair, currency, or country..."
            disabled={disabled}
            className="w-full rounded-lg border border-white/10 bg-slate-800/50
                       py-2.5 pl-10 pr-10 text-sm text-slate-200 placeholder:text-slate-500
                       transition-all focus:border-sky-500/50 focus:outline-none
                       focus:ring-1 focus:ring-sky-500/50 disabled:opacity-50"
            aria-label="Search FX pairs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1
                         text-slate-500 hover:bg-slate-700/50 hover:text-slate-300
                         focus:outline-none focus-visible:ring-1 focus-visible:ring-purple-400/50"
              aria-label="Clear search"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ================================================================== */}
      {/* REGIONAL ACCORDION                                                */}
      {/* v2.0.0: Responsive height with scroll preserved                   */}
      {/* - Small screens: max-h-[400px] with scroll                        */}
      {/* - Large screens: fills available space, scroll when needed        */}
      {/* ================================================================== */}
      <div
        className="min-h-0 flex-1 overflow-y-auto
                   max-h-[400px] lg:max-h-none
                   scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20
                   hover:scrollbar-thumb-white/30"
      >
        {FX_REGION_CONFIGS.map((config) => {
          const regionPairs = filteredPairs.get(config.id) || [];
          const allRegionPairs = pairsByRegion.get(config.id) || [];
          const isExpanded = expandedRegions.has(config.id);
          const selectedInRegion = allRegionPairs.filter((p) =>
            safeSelected.includes(p.id.toLowerCase()),
          ).length;

          if (allRegionPairs.length === 0) return null;

          const hasNoSearchResults = searchQuery.trim() && regionPairs.length === 0;

          return (
            <div key={config.id} className="border-b border-white/5 last:border-b-0">
              <AccordionHeader
                config={config}
                isExpanded={isExpanded}
                selectedCount={selectedInRegion}
                totalCount={allRegionPairs.length}
                onToggle={() => toggleRegion(config.id)}
                onSelectAll={() => selectAllInRegion(config.id)}
                canSelectMore={canSelectMore}
                disabled={disabled}
              />

              {isExpanded && (
                <div
                  id={`region-panel-${config.id}`}
                  className="bg-slate-900/30"
                  style={{
                    boxShadow: `inset 0 0 40px ${config.glow}`,
                  }}
                  role="region"
                  aria-label={`${config.label} FX pairs`}
                >
                  {hasNoSearchResults ? (
                    <div className="px-4 py-6 text-center">
                      <p className="text-sm text-slate-500">
                        No pairs match &quot;{searchQuery}&quot; in {config.label}
                      </p>
                    </div>
                  ) : regionPairs.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                      <p className="text-sm text-slate-500">No pairs available</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2">
                      {regionPairs.map((pair) => (
                        <PairListItem
                          key={pair.id}
                          pair={pair}
                          isSelected={safeSelected.includes(pair.id.toLowerCase())}
                          onToggle={() => togglePair(pair.id)}
                          disabled={!canSelectMore}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ================================================================== */}
      {/* FOOTER: Quick tips                                                */}
      {/* ================================================================== */}
      <div className="shrink-0 border-t border-white/5 bg-slate-800/30 px-4 py-3">
        <p className="text-center text-[10px] text-slate-500">
          💡 Tip: Click chips to remove • Use search to find pairs quickly • Select All respects the{' '}
          {max} limit
        </p>
      </div>
    </div>
  );
}

export { FxPicker };

// ============================================================================
// LEGACY EXPORTS (for backward compatibility)
// ============================================================================

export interface FxPickerTriggerProps {
  onClick: () => void;
  selectionCount: number;
  canEdit: boolean;
}

export function FxPickerTrigger({ onClick, selectionCount, canEdit }: FxPickerTriggerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
    >
      <span>FX Pairs</span>
      <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs">{selectionCount}</span>
      {!canEdit && (
        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-400">Pro</span>
      )}
    </button>
  );
}
