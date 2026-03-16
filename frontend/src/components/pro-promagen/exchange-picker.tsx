// src/components/pro-promagen/exchange-picker.tsx
// ============================================================================
// CONTINENTAL EXCHANGE PICKER - Pro Promagen Configuration (v3.0.0)
// ============================================================================
// A premium exchange/index selection interface organised by continents.
//
// v3.0.0 (16 Mar 2026) — Index-Per-Row:
// - Each index is its own selectable row (no more broken dropdown)
// - Multi-index exchanges show multiple rows, one per index
// - Chips show "Exchange · Index" for clarity
// - Compound selection keys: "exchangeId::benchmark"
// - Select All adds default index per exchange (not all indices)
//
// FEATURES:
// - Sticky selection tray at top (selected items always visible)
// - Continental accordion groups (7 continents)
// - Search/filter across all continents
// - Progress bar showing selection count (6-16)
// - Regional "Select All" buttons
// - Ethereal glow effects matching Promagen design system
//
// COMPLIANCE:
// - Error boundaries for malformed data (§11)
// - Accessibility: ARIA labels, keyboard navigation (§7)
// - Uniform scrollbar styling (§8.1)
// - Purple focus rings per buttons.md §2.1
//
// Authority: docs/authority/paid_tier.md §5.3
// Version: 3.0.0
// ============================================================================

'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import Image from 'next/image';
import { CONTINENT_CONFIGS, type Continent, type ContinentConfig } from '@/lib/geo/continents';
import {
  type ExchangeOption,
  type ExchangeSelection,
  PRO_SELECTION_LIMITS,
  groupByContinent,
  searchExchanges,
  validateSelection,
  getExchangesByIds,
} from '@/lib/pro-promagen/exchange-picker-helpers';

// Re-export types for consumers
export type { ExchangeOption, ExchangeSelection };

// ============================================================================
// TYPES
// ============================================================================

export interface ExchangePickerProps {
  /** All available index options with continent data */
  exchanges: ExchangeOption[];
  /** Currently selected compound IDs (e.g. "cse-colombo::cse_all_share") */
  selected: string[];
  /** Callback when selection changes */
  onChange: (ids: string[]) => void;
  /** Minimum selections allowed (default: 6 per paid_tier.md) */
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

  if (!iso2 || typeof iso2 !== 'string' || iso2.length !== 2) {
    return <span className={`inline-block ${className}`} style={{ width: size, height: size }} />;
  }

  const src = `/flags/${iso2.toLowerCase()}.svg`;

  if (hasError) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded bg-slate-700 text-[10px] font-bold text-slate-400 ${className}`}
        style={{ width: size, height: size }}
      >
        {iso2.toUpperCase()}
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
// SELECTION CHIP COMPONENT (Flag + Exchange · Index + X)
// ============================================================================

interface SelectionChipProps {
  option: ExchangeOption;
  onRemove: () => void;
  disabled?: boolean;
}

const SelectionChip = React.memo(function SelectionChip({
  option,
  onRemove,
  disabled = false,
}: SelectionChipProps) {
  if (!option || !option.id) {
    return null;
  }

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800/80 
                 px-2.5 py-1.5 ring-1 ring-white/10 transition-all duration-200
                 hover:bg-slate-700/80 hover:ring-emerald-500/30"
    >
      <Flag iso2={option.iso2} size={20} className="shrink-0" />
      <span className="text-xs font-medium text-slate-200 whitespace-nowrap">
        {option.label}
        {option.indexName && (
          <span className="text-slate-400"> · {option.indexName}</span>
        )}
      </span>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full
                   text-slate-500 transition-colors cursor-pointer
                   hover:bg-red-500/20 hover:text-red-400
                   focus:outline-none focus-visible:ring-1 focus-visible:ring-purple-400/50
                   disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={`Remove ${option.label} ${option.indexName}`}
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
    if (isNearMax) return 'bg-gradient-to-r from-emerald-400 to-amber-400';
    return 'bg-gradient-to-r from-emerald-500 to-sky-500';
  };

  const getCounterClasses = () => {
    if (isBelowMin) return 'text-red-400';
    if (isAtMax) return 'text-amber-400';
    if (isNearMax) return 'text-emerald-300';
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
      <span className={`text-xs font-mono font-medium tabular-nums ${getCounterClasses()}`}>
        {current}/{max}
      </span>
      {isBelowMin && <span className="text-[10px] text-red-400">(min {min})</span>}
    </div>
  );
});

// ============================================================================
// ACCORDION HEADER COMPONENT
// ============================================================================

interface AccordionHeaderProps {
  config: ContinentConfig;
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
  return (
    <div
      className={`flex items-center justify-between border-b border-white/5 px-4 py-3
                  transition-all duration-200
                  ${isExpanded ? 'bg-slate-800/40' : 'hover:bg-slate-800/30'}
                  ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
      style={{
        boxShadow: isExpanded ? `inset 0 0 30px ${config.glow}` : 'none',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className="flex flex-1 items-center gap-3 rounded text-left
                   focus:outline-none focus-visible:ring-1 focus-visible:ring-purple-400/50
                   disabled:cursor-not-allowed"
        aria-expanded={isExpanded}
        aria-controls={`continent-panel-${config.id}`}
      >
        <svg
          className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
            isExpanded ? 'rotate-90' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-3xl" aria-hidden="true">
          {config.emoji}
        </span>
        <span className="text-base font-medium text-slate-200">{config.label}</span>
        <span
          className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
            selectedCount > 0
              ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
              : 'bg-slate-700/50 text-slate-500'
          }`}
        >
          {selectedCount} selected
        </span>
      </button>

      {isExpanded && totalCount > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelectAll();
          }}
          disabled={disabled || (!canSelectMore && selectedCount === 0)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-all
                      focus:outline-none focus-visible:ring-1 focus-visible:ring-purple-400/50
                      disabled:cursor-not-allowed disabled:opacity-50
                      ${
                        selectedCount === totalCount
                          ? 'bg-slate-700/50 text-slate-400 hover:bg-red-500/20 hover:text-red-400'
                          : canSelectMore
                            ? `bg-gradient-to-r ${config.gradient} text-white shadow-sm hover:shadow-md`
                            : 'bg-slate-800/50 text-slate-500'
                      }`}
        >
          {selectedCount === totalCount ? 'Clear' : 'Select All'}
        </button>
      )}
    </div>
  );
});

// ============================================================================
// INDEX LIST ITEM COMPONENT (one row per index)
// ============================================================================

interface IndexListItemProps {
  option: ExchangeOption;
  isSelected: boolean;
  onToggle: () => void;
  disabled: boolean;
}

const IndexListItem = React.memo(function IndexListItem({
  option,
  isSelected,
  onToggle,
  disabled,
}: IndexListItemProps) {
  if (!option || !option.id) {
    return null;
  }

  const handleRowClick = () => {
    if (!disabled || isSelected) onToggle();
  };

  const handleRowKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleRowClick();
    }
  };

  return (
    <div
      className={`flex w-full items-center gap-3 px-4 py-2.5 transition-all duration-150
                  ${
                    isSelected
                      ? 'border-l-2 border-emerald-500 bg-emerald-500/10'
                      : disabled
                        ? 'border-l-2 border-transparent opacity-50'
                        : 'border-l-2 border-transparent hover:bg-slate-800/50'
                  }
                  ${!disabled || isSelected ? 'cursor-pointer' : 'cursor-not-allowed'}`}
      onClick={handleRowClick}
      onKeyDown={handleRowKeyDown}
      role="option"
      tabIndex={0}
      aria-selected={isSelected}
    >
      {/* Checkbox button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        disabled={disabled && !isSelected}
        className="flex items-center gap-3 text-left
                   focus:outline-none focus-visible:ring-1 focus-visible:ring-purple-400/50
                   disabled:cursor-not-allowed"
        aria-pressed={isSelected}
      >
        <span
          className={`flex h-5 w-5 items-center justify-center rounded border transition-all ${
            isSelected
              ? 'border-emerald-500 bg-emerald-500 text-white'
              : 'border-slate-600 bg-slate-800/50'
          }`}
          aria-hidden="true"
        >
          {isSelected && (
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </span>
        <Flag iso2={option.iso2} size={24} className="shrink-0" />
      </button>

      {/* Exchange + Index info */}
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-medium ${isSelected ? 'text-emerald-300' : 'text-slate-200'}`}
        >
          {option.label}
          {option.indexName && (
            <span className={`ml-1.5 font-normal ${isSelected ? 'text-emerald-400/70' : 'text-slate-400'}`}>
              — {option.indexName}
            </span>
          )}
        </p>
        <p className="truncate text-xs text-slate-500">
          {option.city}
          {option.city && option.country ? ', ' : ''}
          {option.country}
        </p>
      </div>

      {/* Benchmark badge when selected */}
      {isSelected && option.benchmark && (
        <span className="rounded-md bg-slate-700/50 px-2 py-0.5 text-[10px] font-mono text-slate-400">
          {option.benchmark}
        </span>
      )}
    </div>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ExchangePicker({
  exchanges,
  selected,
  onChange,
  min = PRO_SELECTION_LIMITS.EXCHANGE_MIN,
  max = PRO_SELECTION_LIMITS.EXCHANGE_MAX,
  disabled = false,
}: ExchangePickerProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-expand continents that contain pre-selected items.
  const [expandedContinents, setExpandedContinents] = useState<Set<Continent>>(() => {
    if (!Array.isArray(exchanges) || !Array.isArray(selected)) return new Set<Continent>();
    const selectedSet = new Set(selected);
    const continents = new Set<Continent>();
    for (const ex of exchanges) {
      if (ex && selectedSet.has(ex.id) && ex.continent) {
        continents.add(ex.continent as Continent);
      }
    }
    return continents;
  });
  const [mounted, setMounted] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Handle hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Ensure selected is always an array
  const safeSelected = useMemo(() => {
    if (!Array.isArray(selected)) return [];
    return selected.filter((id) => typeof id === 'string' && id.length > 0);
  }, [selected]);

  // Memoize grouping by continent
  const exchangesByContinent = useMemo(() => groupByContinent(exchanges), [exchanges]);

  // Filter based on search query
  const filteredExchanges = useMemo(() => {
    if (!searchQuery.trim()) return exchangesByContinent;
    const filtered = searchExchanges(exchanges, searchQuery);
    return groupByContinent(filtered);
  }, [exchanges, exchangesByContinent, searchQuery]);

  // Get selected option objects
  const selectedOptions = useMemo(
    () => getExchangesByIds(exchanges, safeSelected),
    [exchanges, safeSelected],
  );

  // Validation state
  const validation = useMemo(
    () => validateSelection(safeSelected, min, max),
    [safeSelected, min, max],
  );

  // Can select more?
  const canSelectMore = safeSelected.length < max;

  // Handlers
  const toggleOption = useCallback(
    (id: string) => {
      if (disabled) return;
      const isCurrentlySelected = safeSelected.includes(id);
      if (isCurrentlySelected) {
        onChange(safeSelected.filter((s) => s !== id));
      } else if (canSelectMore) {
        onChange([...safeSelected, id]);
      }
    },
    [disabled, safeSelected, canSelectMore, onChange],
  );

  const removeOption = useCallback(
    (id: string) => {
      if (disabled) return;
      onChange(safeSelected.filter((s) => s !== id));
    },
    [disabled, safeSelected, onChange],
  );

  const toggleContinent = useCallback((continent: Continent) => {
    setExpandedContinents((prev) => {
      const next = new Set(prev);
      if (next.has(continent)) {
        next.delete(continent);
      } else {
        next.add(continent);
      }
      return next;
    });
  }, []);

  const selectAllInContinent = useCallback(
    (continent: Continent) => {
      if (disabled) return;

      const continentOptions = exchangesByContinent.get(continent) || [];
      const continentIds = continentOptions.map((ex) => ex.id);

      const allSelected = continentIds.every((id) => safeSelected.includes(id));

      if (allSelected) {
        // Deselect all in this continent
        onChange(safeSelected.filter((id) => !continentIds.includes(id)));
      } else {
        // Select all (respecting max limit)
        const currentOtherSelections = safeSelected.filter((id) => !continentIds.includes(id));
        const spaceRemaining = max - currentOtherSelections.length;
        const toAdd = continentIds
          .filter((id) => !safeSelected.includes(id))
          .slice(0, spaceRemaining);

        onChange([...safeSelected, ...toAdd]);
      }
    },
    [disabled, exchangesByContinent, safeSelected, max, onChange],
  );

  const resetAll = useCallback(() => {
    if (disabled) return;
    onChange([]);
  }, [disabled, onChange]);

  // Don't render until mounted (prevents hydration mismatch)
  if (!mounted) {
    return (
      <div className="flex h-96 items-center justify-center rounded-xl border border-white/10 bg-slate-900/50">
        <div className="text-sm text-slate-500">Loading exchanges...</div>
      </div>
    );
  }

  return (
    <div
      className="flex h-full max-h-[calc(100vh-200px)] flex-col overflow-hidden rounded-xl 
                 border border-white/10 bg-slate-900/80 backdrop-blur-sm"
      role="region"
      aria-label="Exchange and index selector"
    >
      {/* ================================================================== */}
      {/* STICKY SELECTION TRAY                                             */}
      {/* ================================================================== */}
      <div className="shrink-0 border-b border-white/5 bg-slate-900/95">
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-200">
            Selected Exchanges
          </h3>
          {safeSelected.length > 0 && (
            <button
              type="button"
              onClick={resetAll}
              disabled={disabled}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium
                         text-slate-400 ring-1 ring-white/10 transition-all cursor-pointer
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
          <div className="flex flex-wrap gap-2 px-4 pb-3">
            {selectedOptions.map((option) => (
              <SelectionChip
                key={option.id}
                option={option}
                onRemove={() => removeOption(option.id)}
                disabled={disabled}
              />
            ))}
          </div>
        ) : (
          <div className="px-4 pb-3">
            <p className="text-xs italic text-slate-500">
              No exchanges selected. Browse continents below to add exchanges.
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
            placeholder="Search by exchange, city, country, or index..."
            disabled={disabled}
            className="w-full rounded-lg border border-white/10 bg-slate-800/50
                       py-2.5 pl-10 pr-10 text-sm text-slate-200 placeholder:text-slate-500
                       transition-all focus:border-emerald-500/50 focus:outline-none
                       focus:ring-1 focus:ring-emerald-500/50 disabled:opacity-50"
            aria-label="Search exchanges"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1
                         text-slate-500 hover:bg-slate-700/50 hover:text-slate-300 cursor-pointer
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
      {/* CONTINENTAL ACCORDION                                             */}
      {/* ================================================================== */}
      <div
        className="min-h-0 flex-1 overflow-y-auto
                   max-h-[400px] lg:max-h-none
                   scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20
                   hover:scrollbar-thumb-white/30"
      >
        {CONTINENT_CONFIGS.map((config) => {
          const continentOptions = filteredExchanges.get(config.id) || [];
          const allContinentOptions = exchangesByContinent.get(config.id) || [];
          const isExpanded = expandedContinents.has(config.id);
          const selectedInContinent = allContinentOptions.filter((ex) =>
            safeSelected.includes(ex.id),
          ).length;

          if (allContinentOptions.length === 0) return null;

          const hasNoSearchResults = searchQuery.trim() && continentOptions.length === 0;

          return (
            <div key={config.id} className="border-b border-white/5 last:border-b-0">
              <AccordionHeader
                config={config}
                isExpanded={isExpanded}
                selectedCount={selectedInContinent}
                totalCount={allContinentOptions.length}
                onToggle={() => toggleContinent(config.id)}
                onSelectAll={() => selectAllInContinent(config.id)}
                canSelectMore={canSelectMore}
                disabled={disabled}
              />

              {isExpanded && (
                <div
                  id={`continent-panel-${config.id}`}
                  className="bg-slate-900/30"
                  style={{
                    boxShadow: `inset 0 0 40px ${config.glow}`,
                  }}
                  role="region"
                  aria-label={`${config.label} exchanges`}
                >
                  {hasNoSearchResults ? (
                    <div className="px-4 py-6 text-center">
                      <p className="text-sm text-slate-500">
                        No exchanges match &quot;{searchQuery}&quot; in {config.label}
                      </p>
                    </div>
                  ) : continentOptions.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                      <p className="text-sm text-slate-500">No exchanges available</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2">
                      {continentOptions.map((option) => (
                        <IndexListItem
                          key={option.id}
                          option={option}
                          isSelected={safeSelected.includes(option.id)}
                          onToggle={() => toggleOption(option.id)}
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
          💡 Tip: Multi-index exchanges show one row per index • Select All respects the{' '}
          {max} limit
        </p>
      </div>
    </div>
  );
}

export default ExchangePicker;
