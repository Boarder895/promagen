// src/components/pro-promagen/comparison-table.tsx
// ============================================================================
// COMPARISON TABLE WITH CHIPS + ADD LIST DROPDOWNS
// ============================================================================
// Standard vs Pro Promagen comparison table.
// FX Pairs, Exchanges, and Stock Indices rows have interactive multi-select dropdowns.
//
// Dropdown Design (Chips + Add List):
// - Current selections shown as removable chips at top
// - Available (unselected) items shown in scrollable list below
// - Click chip ✕ to remove, click list item to add
// - No tick/untick confusion
//
// Smart Search:
// - FX pairs searchable by country name and trader slang
// - Type "South Africa" to find ZAR pairs
// - Type "Loonie" to find CAD pairs
//
// Selection Rules:
// - FX: 0-16 pairs (can deselect all to start fresh)
// - Exchanges: 0-16 exchanges (can deselect all to start fresh)
// - Indices: 0-16 indices (can deselect all to hide index data on cards)
//
// UPDATED: Added indices dropdown for stock index selection.
//
// Authority: docs/authority/paid_tier.md §5.10
// ============================================================================

'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { FEATURE_COMPARISON, type FeatureRow } from '@/data/pro-promagen/presets';
import { PRO_SELECTION_LIMITS } from '@/lib/pro-promagen/types';
import { pairMatchesSearch } from '@/data/pro-promagen/currency-search-data';

// ============================================================================
// TYPES
// ============================================================================

export interface SelectionItem {
  id: string;
  label: string;
  /** Optional secondary label (e.g., country names for FX pairs) */
  subLabel?: string;
  /** Optional status badge (e.g., "coming-soon" for indices) */
  status?: 'active' | 'coming-soon' | 'unavailable';
}

export interface ComparisonTableProps {
  /** FX pair options for dropdown */
  fxOptions: SelectionItem[];
  /** Exchange options for dropdown */
  exchangeOptions: SelectionItem[];
  /** Indices options for dropdown */
  indicesOptions: SelectionItem[];
  /** Currently selected FX pair IDs */
  selectedFxPairs: string[];
  /** Currently selected exchange IDs */
  selectedExchanges: string[];
  /** Currently selected indices (exchange IDs with index display enabled) */
  selectedIndices: string[];
  /** Callback when FX selection changes */
  onFxChange: (ids: string[]) => void;
  /** Callback when exchange selection changes */
  onExchangeChange: (ids: string[]) => void;
  /** Callback when indices selection changes */
  onIndicesChange: (ids: string[]) => void;
  /** Whether user is paid tier (enables interaction) */
  isPaidUser: boolean;
}

// ============================================================================
// TOOLTIP COMPONENT
// ============================================================================

interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

function Tooltip({ content, children }: TooltipProps) {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleMouseEnter = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top - 8,
        left: rect.left + rect.width / 2,
      });
    }
    setShow(true);
  };

  const tooltipPortal =
    show && mounted
      ? createPortal(
          <div
            className="fixed z-[10000] px-3 py-2 text-xs text-white bg-slate-800 rounded-lg shadow-xl border border-white/10 max-w-[280px] transform -translate-x-1/2 -translate-y-full animate-in fade-in-0 zoom-in-95 duration-150"
            style={{ top: position.top, left: position.left }}
          >
            {content}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
          </div>,
          document.body,
        )
      : null;

  return (
    <span
      ref={triggerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShow(false)}
      className="cursor-help"
    >
      {children}
      {tooltipPortal}
    </span>
  );
}

// ============================================================================
// INFO ICON WITH TOOLTIP - PROMINENT AND VISIBLE
// ============================================================================

interface InfoTooltipProps {
  content: string;
}

function InfoTooltip({ content }: InfoTooltipProps) {
  return (
    <Tooltip content={content}>
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 hover:text-sky-300 transition-colors ml-2 cursor-help">
        <svg
          className="w-3 h-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </span>
    </Tooltip>
  );
}

// ============================================================================
// STATUS BADGE COMPONENT
// ============================================================================

interface StatusBadgeProps {
  status: 'active' | 'coming-soon' | 'unavailable';
}

function StatusBadge({ status }: StatusBadgeProps) {
  if (status === 'active') return null;

  const styles = {
    'coming-soon': 'bg-amber-500/20 text-amber-400 ring-amber-500/30',
    unavailable: 'bg-slate-500/20 text-slate-400 ring-slate-500/30',
  };

  const labels = {
    'coming-soon': 'Soon',
    unavailable: 'N/A',
  };

  return (
    <span
      className={`ml-2 px-1.5 py-0.5 text-[10px] font-medium rounded ring-1 ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

// ============================================================================
// CHIPS + ADD LIST DROPDOWN (PORTAL VERSION)
// ============================================================================

interface ChipsDropdownProps {
  id: string;
  options: SelectionItem[];
  selected: string[];
  onChange: (ids: string[]) => void;
  min: number;
  max: number;
  disabled?: boolean;
  gradient: string;
  placeholder: string;
  tooltipText: string;
  /** Use smart currency search (for FX pairs) */
  useCurrencySearch?: boolean;
  /** Show sub-labels (country names) in the list */
  showSubLabels?: boolean;
  /** Show status badges (for indices) */
  showStatusBadges?: boolean;
}

interface DropdownPosition {
  top: number;
  left: number;
  width: number;
}

function ChipsDropdown({
  id,
  options,
  selected,
  onChange,
  min,
  max,
  disabled = false,
  gradient,
  placeholder,
  tooltipText,
  useCurrencySearch = false,
  showSubLabels = false,
  showStatusBadges = false,
}: ChipsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [position, setPosition] = useState<DropdownPosition>({ top: 0, left: 0, width: 360 });
  const [mounted, setMounted] = useState(false);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Track if component is mounted (for portal)
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Get selected items as objects (sorted alphabetically for display)
  const selectedItems = useMemo(() => {
    return selected
      .map((id) => options.find((o) => o.id === id))
      .filter((item): item is SelectionItem => item !== undefined)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [selected, options]);

  // Get unselected items (sorted alphabetically)
  const unselectedItems = useMemo(() => {
    return options
      .filter((o) => !selected.includes(o.id))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [options, selected]);

  // Filter unselected items based on search
  const filteredUnselected = useMemo(() => {
    const lowerFilter = filter.toLowerCase().trim();
    if (!lowerFilter) return unselectedItems;

    return unselectedItems.filter((item) => {
      // Standard label match
      if (item.label.toLowerCase().includes(lowerFilter)) return true;

      // Sub-label (country name) match
      if (item.subLabel && item.subLabel.toLowerCase().includes(lowerFilter)) return true;

      // Smart currency search for FX pairs
      if (useCurrencySearch) {
        return pairMatchesSearch(item.id, filter);
      }

      return false;
    });
  }, [unselectedItems, filter, useCurrencySearch]);

  // Calculate dropdown position when opening
  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownHeight = 520; // Approximate max height
    const viewportHeight = window.innerHeight;

    // Check if dropdown would go below viewport
    const spaceBelow = viewportHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;

    let top: number;
    if (spaceBelow >= dropdownHeight || spaceBelow >= spaceAbove) {
      top = rect.bottom + 4;
    } else {
      top = rect.top - dropdownHeight - 4;
    }

    // Center dropdown on button, but keep within viewport
    const dropdownWidth = 360;
    let left = rect.left + rect.width / 2 - dropdownWidth / 2;

    const padding = 8;
    if (left < padding) left = padding;
    if (left + dropdownWidth > window.innerWidth - padding) {
      left = window.innerWidth - dropdownWidth - padding;
    }

    setPosition({ top, left, width: dropdownWidth });
  }, []);

  // Update position when opening and on scroll/resize
  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleScrollOrResize = () => updatePosition();

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const clickedButton = buttonRef.current?.contains(target);
      const clickedDropdown = dropdownRef.current?.contains(target);

      if (!clickedButton && !clickedDropdown) {
        setIsOpen(false);
        setFilter('');
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Check if removal is allowed
  const canRemove = useCallback(() => {
    return selected.length > min;
  }, [selected.length, min]);

  // Check if addition is allowed
  const canAdd = useCallback(() => {
    return selected.length < max;
  }, [selected.length, max]);

  // Handle removing a chip
  const handleRemove = useCallback(
    (itemId: string) => {
      if (disabled) return;
      if (!canRemove()) return;

      const newSelection = selected.filter((id) => id !== itemId);
      onChange(newSelection);
    },
    [selected, onChange, disabled, canRemove],
  );

  // Handle adding an item
  const handleAdd = useCallback(
    (itemId: string) => {
      if (disabled) return;
      if (!canAdd()) return;

      const newSelection = [...selected, itemId];
      onChange(newSelection);
    },
    [selected, onChange, disabled, canAdd],
  );

  // Generate help text for current state
  const getStateHelpText = () => {
    if (selected.length === 0) {
      return 'No selections yet. Add items to build your custom view.';
    }
    if (selected.length >= max) {
      return `Maximum ${max} reached. Remove some to add more.`;
    }
    return null;
  };

  const stateHelpText = getStateHelpText();
  const canRemoveItem = canRemove();
  const canAddItem = canAdd();

  // Dropdown panel content (rendered via portal)
  const dropdownPanel =
    isOpen && !disabled && mounted
      ? createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,
              width: position.width,
              zIndex: 9999,
            }}
            className={`
        rounded-xl overflow-hidden
        bg-gradient-to-br ${gradient}
        shadow-2xl ring-1 ring-white/20
        animate-in fade-in-0 zoom-in-95 duration-150
      `}
          >
            {/* Inner container with dark background */}
            <div className="m-[2px] rounded-[10px] bg-slate-900/95 backdrop-blur-sm">
              {/* Header with count and done button */}
              <div className="px-3 py-2.5 border-b border-white/10 flex items-center justify-between">
                <span className="text-sm font-medium text-white flex items-center">
                  {selected.length} of {max} selected
                  <InfoTooltip content={tooltipText} />
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setFilter('');
                  }}
                  className="px-3 py-1 text-xs font-medium rounded-md bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors"
                >
                  Done
                </button>
              </div>

              {/* Selected chips section */}
              <div className="px-3 py-2.5 border-b border-white/10 max-h-[160px] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20">
                {selectedItems.length === 0 ? (
                  <p className="text-xs text-white/40 italic">
                    No items selected. Use the list below to add items.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedItems.map((item) => (
                      <span
                        key={item.id}
                        className={`
                          inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium
                          bg-white/10 text-white/90 ring-1 ring-white/20
                          ${canRemoveItem ? 'hover:bg-red-500/20 hover:ring-red-500/30' : ''}
                          transition-colors group
                        `}
                      >
                        {item.label}
                        {showStatusBadges && item.status && item.status !== 'active' && (
                          <StatusBadge status={item.status} />
                        )}
                        {canRemoveItem && (
                          <button
                            type="button"
                            onClick={() => handleRemove(item.id)}
                            className="w-4 h-4 rounded-full flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-red-500/20 transition-colors"
                            aria-label={`Remove ${item.label}`}
                          >
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2.5}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Search input */}
              <div className="px-3 py-2 border-b border-white/10">
                <div className="relative">
                  <svg
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    ref={inputRef}
                    type="text"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder={placeholder}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-800/50 rounded-lg text-white placeholder:text-white/40 border border-white/10 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
                  />
                  {filter && (
                    <button
                      type="button"
                      onClick={() => setFilter('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white/20 text-white/60 hover:bg-white/30 hover:text-white flex items-center justify-center"
                    >
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* State help text */}
              {stateHelpText && (
                <div className="px-3 py-2 border-b border-white/5">
                  <p className="text-xs text-white/50">{stateHelpText}</p>
                </div>
              )}

              {/* Available items list */}
              <ul
                id={`${id}-listbox`}
                role="listbox"
                aria-label="Available items"
                className="max-h-[220px] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20"
              >
                {filteredUnselected.length === 0 ? (
                  <li className="px-3 py-4 text-sm text-white/40 text-center italic">
                    {filter ? 'No matches found' : 'All items selected'}
                  </li>
                ) : (
                  filteredUnselected.map((item) => (
                    <li key={item.id} role="option" aria-selected={false}>
                      <button
                        type="button"
                        onClick={() => handleAdd(item.id)}
                        disabled={!canAddItem}
                        className={`
                    w-full px-3 py-2 text-left flex items-center gap-2.5
                    transition-colors
                    ${canAddItem ? 'hover:bg-emerald-500/20' : 'cursor-not-allowed opacity-50'}
                  `}
                      >
                        {/* Plus icon */}
                        <span
                          className={`
                    w-5 h-5 rounded border-2 flex items-center justify-center shrink-0
                    ${
                      canAddItem
                        ? 'border-emerald-500/50 text-emerald-500'
                        : 'border-slate-700 text-slate-700'
                    }
                  `}
                        >
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                        </span>
                        {/* Label with optional sub-label and status badge */}
                        <div className="flex flex-col min-w-0 flex-1">
                          <span
                            className={`text-sm font-medium truncate flex items-center ${
                              canAddItem ? 'text-slate-200' : 'text-slate-500'
                            }`}
                          >
                            {item.label}
                            {showStatusBadges && item.status && item.status !== 'active' && (
                              <StatusBadge status={item.status} />
                            )}
                          </span>
                          {showSubLabels && item.subLabel && (
                            <span className="text-xs text-slate-500 truncate">{item.subLabel}</span>
                          )}
                        </div>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (disabled) return;
          setIsOpen(!isOpen);
        }}
        disabled={disabled}
        className={`
          flex items-center justify-between gap-2 w-full min-w-[160px]
          px-3 py-2 rounded-lg text-sm font-medium
          transition-all duration-200
          ${
            disabled
              ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed'
              : isOpen
              ? `bg-gradient-to-r ${gradient} text-white shadow-lg`
              : 'bg-slate-800/80 text-slate-200 hover:bg-slate-700/80 ring-1 ring-white/10'
          }
        `}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={`${id}-listbox`}
      >
        <span className="truncate">
          {selected.length === 0 ? 'None selected' : `${selected.length} of ${max} selected`}
        </span>
        <svg
          className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown rendered via portal */}
      {dropdownPanel}
    </div>
  );
}

// ============================================================================
// COMPARISON TABLE COMPONENT
// ============================================================================

export function ComparisonTable({
  fxOptions,
  exchangeOptions,
  indicesOptions,
  selectedFxPairs,
  selectedExchanges,
  selectedIndices,
  onFxChange,
  onExchangeChange,
  onIndicesChange,
  isPaidUser,
}: ComparisonTableProps) {
  // Render the Pro column value - either static text or dropdown
  const renderProValue = (row: FeatureRow) => {
    if (row.hasDropdown === 'fx') {
      return (
        <ChipsDropdown
          id="fx-dropdown"
          options={fxOptions}
          selected={selectedFxPairs}
          onChange={onFxChange}
          min={PRO_SELECTION_LIMITS.FX_MIN}
          max={PRO_SELECTION_LIMITS.FX_MAX}
          disabled={false}
          gradient="from-emerald-500 via-sky-500 to-violet-500"
          placeholder="Search pairs or country..."
          tooltipText="Select 0 to 16 currency pairs. You can clear all and build from scratch."
          useCurrencySearch={true}
          showSubLabels={true}
        />
      );
    }

    if (row.hasDropdown === 'exchange') {
      return (
        <ChipsDropdown
          id="exchange-dropdown"
          options={exchangeOptions}
          selected={selectedExchanges}
          onChange={onExchangeChange}
          min={PRO_SELECTION_LIMITS.EXCHANGE_MIN}
          max={PRO_SELECTION_LIMITS.EXCHANGE_MAX}
          disabled={false}
          gradient="from-amber-500 via-rose-500 to-violet-500"
          placeholder="Search exchanges..."
          tooltipText="Select 0 to 16 exchanges. You can clear all and build from scratch."
          useCurrencySearch={false}
          showSubLabels={true}
        />
      );
    }

    if (row.hasDropdown === 'indices') {
      return (
        <ChipsDropdown
          id="indices-dropdown"
          options={indicesOptions}
          selected={selectedIndices}
          onChange={onIndicesChange}
          min={PRO_SELECTION_LIMITS.INDICES_MIN}
          max={PRO_SELECTION_LIMITS.INDICES_MAX}
          disabled={false}
          gradient="from-cyan-500 via-blue-500 to-indigo-500"
          placeholder="Search indices..."
          tooltipText="Select which exchanges show stock index data on their cards. You can clear all to hide indices."
          useCurrencySearch={false}
          showSubLabels={true}
          showStatusBadges={true}
        />
      );
    }

    // Static value
    return (
      <span
        className={`text-sm font-medium ${row.highlight ? 'text-emerald-400' : 'text-white/60'}`}
      >
        {row.pro}
      </span>
    );
  };

  return (
    <div className="rounded-2xl overflow-hidden ring-1 ring-white/10 bg-slate-900/50">
      {/* Header */}
      <div className="bg-gradient-to-r from-sky-600/20 via-emerald-600/20 to-violet-600/20 px-4 py-3 border-b border-white/10">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-gradient-to-r from-sky-400 to-emerald-400" />
          Standard vs Pro Promagen
        </h3>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-4 py-2.5 text-left text-sm font-medium text-white/50">Feature</th>
              <th className="px-4 py-2.5 text-center text-sm font-medium text-white/50">
                Standard
              </th>
              <th className="px-4 py-2.5 text-center text-sm font-medium text-white/50">
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-amber-400">★</span>
                  Pro Promagen
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {FEATURE_COMPARISON.map((row) => (
              <tr
                key={row.feature}
                className={`
                  border-b border-white/5 transition-colors
                  ${
                    row.highlight
                      ? 'bg-gradient-to-r from-sky-500/5 via-transparent to-emerald-500/5'
                      : ''
                  }
                  hover:bg-white/5
                `}
              >
                <td className="px-4 py-3 text-sm font-medium text-white/80">{row.feature}</td>
                <td className="px-4 py-3 text-center text-sm font-medium text-white/40">
                  {row.standard}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center">{renderProValue(row)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Preview mode hint for free users */}
      {!isPaidUser && (
        <div className="px-4 py-2.5 border-t border-white/5 bg-amber-500/5">
          <p className="text-xs font-medium text-amber-400/70 text-center">
            ★ Try it out! Upgrade to Pro Promagen to save your selections
          </p>
        </div>
      )}
    </div>
  );
}

export default ComparisonTable;
