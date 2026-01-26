// src/components/ui/combobox.tsx
// Enhanced multi-select combobox with lock states, auto-close, and vocabulary chips
// Version 7.0.0 - Added vocabulary chip display for expanded selection options
//
// NEW in v7.0.0:
// - chipOptions prop: Array of clickable chips shown below dropdown when open
// - showChipsWhenClosed prop: Show chips even when dropdown is closed (default: false)
// - Chips are filtered to exclude already-selected items
// - Max 50 chips displayed for performance (CHIP_DISPLAY_LIMIT)
// - Chips integrate with vocabulary-loader for intelligent suggestions
// - Chip click adds to selection (same behavior as dropdown option click)
// - Horizontal scrollable chip area with fade edges
//
// NEW in v6.5.0:
// - singleColumn prop: Forces single-column layout (disables 2-column grid)
// - Used for provider selectors where alphabetical scanning is easier in one column
//
// NEW in v6.4.0:
// - compact prop: Hides label, tooltip, and pt-8 padding
// - Used for inline header selectors (e.g., Playground provider selector)
//
// CRITICAL FIX in v6.3.0:
// - Single-select (limit=1): Closes IMMEDIATELY on click, BEFORE state update
// - Multi-select: Closes when newSelected.length >= maxSelections
// - Uses local ref to prevent double-click race condition
// - Disabled state applied immediately to prevent rapid clicks
//
// Features:
// - Lock state shows disabled styling (purple tint) but NO overlay text
// - When locked: shows placeholder, dropdown arrow hidden, can't interact
// - Auto-close when maxSelections reached (works for ALL values: 1, 2, 3, 8, etc.)
// - Done button in dropdown for multi-select (maxSelections >= 2)
// - Tooltip has z-[9999] and reserved space (pt-8) to avoid clipping
// - Bright pink char counter (text-pink-500)
// - spellCheck="true" on input
// - allowFreeText prop: when false, hides free text input
// - Shows ALL options in scrollable dropdown (no artificial limit)
// - v6.0.0: Taller dropdown (max-h-80 = 320px, was 240px)
// - v6.0.0: 2-column grid layout when >12 options (better visual density)
// - v6.0.0: Truncate + title tooltip for long option text
// - v6.1.0: Classy tooltip style (border, backdrop-blur, arrow)
// - v6.1.0: Removed pink "Type to add custom entry" from tooltips
// - v6.2.0: Done button for multi-select dropdowns (limit >= 2)
// - v6.2.0: Selection counter shows "X of Y selected"

'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';

// Constants for chip display
const CHIP_DISPLAY_LIMIT = 50;

export interface ComboboxProps {
  id: string;
  label: string;
  description?: string;
  tooltipGuidance?: string;
  options: string[];
  selected: string[];
  customValue: string;
  onSelectChange: (selected: string[]) => void;
  onCustomChange: (value: string) => void;
  placeholder?: string;
  maxSelections?: number;
  maxCustomChars?: number;
  /** Whether to show the free text input (default: true) */
  allowFreeText?: boolean;
  /** Whether the combobox is in a locked state */
  isLocked?: boolean;
  /** Message to show when locked */
  lockMessage?: string;
  /** Compact mode: hides label, tooltip, and extra padding (for header use) */
  compact?: boolean;
  /** Single column mode: forces single-column layout even with many options */
  singleColumn?: boolean;
  /**
   * Vocabulary chips to show below dropdown (max 50 displayed)
   * These are clickable quick-select options from the full vocabulary
   */
  chipOptions?: string[];
  /**
   * Show chips even when dropdown is closed (default: false)
   * When false, chips only appear when dropdown is open
   */
  showChipsWhenClosed?: boolean;
  /**
   * Label for the chip section (default: "Quick picks")
   */
  chipSectionLabel?: string;
}

export function Combobox({
  id,
  label,
  description: _description,
  tooltipGuidance,
  options,
  customValue: _customValue,
  onSelectChange,
  onCustomChange,
  selected,
  placeholder = 'Type or select...',
  maxSelections = 1,
  maxCustomChars = 50,
  allowFreeText = true,
  isLocked = false,
  lockMessage: _lockMessage,
  compact = false,
  singleColumn = false,
  chipOptions = [],
  showChipsWhenClosed = false,
  chipSectionLabel = 'Quick picks',
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [showTooltip, setShowTooltip] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Ref to track if we're currently processing a selection (prevents double-click)
  const isSelectingRef = useRef(false);

  // Filter options based on input (exclude already selected and empty first option)
  const filteredOptions = options
    .filter((opt) => opt !== '') // Exclude empty option
    .filter((opt) => !selected.includes(opt))
    .filter((opt) => opt.toLowerCase().startsWith(filter.toLowerCase()));

  // Filter chip options: exclude selected, apply search filter, limit to CHIP_DISPLAY_LIMIT
  const filteredChips = useMemo(() => {
    if (!chipOptions || chipOptions.length === 0) return [];

    let chips = chipOptions.filter((chip) => !selected.includes(chip));

    // Apply search filter if there's a filter value (strict prefix match)
    if (filter) {
      chips = chips.filter((chip) => chip.toLowerCase().startsWith(filter.toLowerCase()));
    }

    // Limit to CHIP_DISPLAY_LIMIT for performance
    return chips.slice(0, CHIP_DISPLAY_LIMIT);
  }, [chipOptions, selected, filter]);

  // Should we show the chip section?
  const shouldShowChips = useMemo(() => {
    if (isLocked) return false;
    if (filteredChips.length === 0) return false;
    if (showChipsWhenClosed) return true;
    // Don't show chips when dropdown is open - it duplicates the dropdown options
    return false;
  }, [isLocked, filteredChips.length, showChipsWhenClosed]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowTooltip(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup tooltip timeout on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

  // Handle Done button click - close dropdown
  const handleDone = useCallback(() => {
    setIsOpen(false);
    setShowTooltip(false);
    setFilter('');
  }, []);

  // BULLETPROOF auto-close logic
  const handleSelect = useCallback(
    (option: string) => {
      // Prevent if locked
      if (isLocked) return;

      // Prevent double-click race condition
      if (isSelectingRef.current) return;

      // Check current selection count from prop
      const currentCount = selected.length;

      // Don't allow if already at limit
      if (currentCount >= maxSelections) return;

      // Mark as selecting to prevent race condition
      isSelectingRef.current = true;

      // Calculate what the new count will be
      const newCount = currentCount + 1;
      const newSelected = [...selected, option];

      // CRITICAL: For single-select OR when reaching limit, close BEFORE state update
      if (maxSelections === 1 || newCount >= maxSelections) {
        setIsOpen(false);
        setShowTooltip(false);
      }

      // Clear filter
      setFilter('');

      // Now update parent state
      onSelectChange(newSelected);

      // Reset selecting flag after a short delay
      setTimeout(() => {
        isSelectingRef.current = false;
      }, 100);

      // Keep focus on input for continued interaction if not closed
      if (newCount < maxSelections) {
        inputRef.current?.focus();
      }
    },
    [selected, maxSelections, onSelectChange, isLocked],
  );

  // Handle chip click - same as handleSelect
  const handleChipClick = useCallback(
    (chip: string) => {
      handleSelect(chip);
    },
    [handleSelect],
  );

  const handleRemove = useCallback(
    (option: string) => {
      if (isLocked) return;
      onSelectChange(selected.filter((s) => s !== option));
    },
    [selected, onSelectChange, isLocked],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLocked) return;
    // If free text is not allowed, only use for filtering
    const value = e.target.value;
    if (value.length <= maxCustomChars) {
      setFilter(value);
      if (allowFreeText) {
        onCustomChange(value);
      }
    }
    if (!isOpen) setIsOpen(true);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isLocked) return;

    if (e.key === 'Enter' && filter.trim() && allowFreeText) {
      e.preventDefault();
      // Add custom value as selection if not already selected and within limit
      if (!selected.includes(filter.trim()) && selected.length < maxSelections) {
        const newSelected = [...selected, filter.trim()];
        const newCount = newSelected.length;

        // Close if reaching limit
        if (maxSelections === 1 || newCount >= maxSelections) {
          setIsOpen(false);
          setShowTooltip(false);
        }

        onSelectChange(newSelected);
        setFilter('');
        onCustomChange('');
      }
    } else if (e.key === 'Backspace' && !filter && selected.length > 0) {
      // Remove last chip on backspace when input is empty
      onSelectChange(selected.slice(0, -1));
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setShowTooltip(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
    }
  };

  const handleInputFocus = () => {
    if (isLocked) return;
    setIsOpen(true);
    setShowTooltip(true);
    // Auto-hide tooltip after 4 seconds
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    tooltipTimeoutRef.current = setTimeout(() => {
      setShowTooltip(false);
    }, 4000);
  };

  const handleLabelClick = () => {
    if (isLocked) return;
    setShowTooltip(true);
    inputRef.current?.focus();
    // Auto-hide tooltip after 4 seconds
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    tooltipTimeoutRef.current = setTimeout(() => {
      setShowTooltip(false);
    }, 4000);
  };

  // Handle keyboard on input container to focus input
  const handleContainerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isLocked) return;
    // Focus input on Enter or Space when container is focused
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.focus();
    }
  };

  // Generate tooltip text - guidance only, NO max badge
  const getTooltipText = () => {
    return (
      tooltipGuidance ||
      (maxSelections === 1 ? 'Select one option' : `Select up to ${maxSelections} options`)
    );
  };

  const listboxId = `${id}-listbox`;
  const charCount = filter.length;

  // Determine if this is a multi-select dropdown (show Done button)
  const isMultiSelect = maxSelections >= 2;
  const canSelectMore = selected.length < maxSelections;

  // Lock state styling classes
  const lockClasses = isLocked ? 'prompt-lock-gradient cursor-not-allowed' : '';

  // Determine if we should use 2-column grid layout
  // Use single column when: singleColumn prop is true, OR options <= 12
  const useGridLayout = !singleColumn && filteredOptions.length > 12;

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col gap-1 ${compact ? '' : 'pt-8'} ${lockClasses}`}
    >
      {/* Tooltip above label - classy style matching site tooltips (hidden in compact mode) */}
      {!compact && showTooltip && !isLocked && (
        <div
          className="absolute -top-0.5 left-0 right-0 z-[9999] rounded-lg border border-slate-700 bg-slate-800/95 px-3 py-2 text-xs text-slate-200 shadow-xl backdrop-blur-sm"
          style={{ pointerEvents: 'none' }}
        >
          {/* Tooltip arrow */}
          <div className="absolute -top-1.5 left-4 h-3 w-3 rotate-45 border-l border-t border-slate-700 bg-slate-800/95" />
          {/* Tooltip content */}
          <div className="relative whitespace-pre-line leading-relaxed text-slate-300">
            {getTooltipText()}
          </div>
        </div>
      )}

      {/* Label - clickable to show tooltip (hidden in compact mode) */}
      {!compact && (
        <button
          type="button"
          onClick={handleLabelClick}
          disabled={isLocked}
          className={`flex items-center gap-1.5 text-left text-xs font-medium transition-colors ${
            isLocked ? 'text-slate-500 cursor-not-allowed' : 'text-slate-300 hover:text-slate-100'
          }`}
        >
          <span>{label}</span>
          {!isLocked && (
            <svg
              className="h-3.5 w-3.5 text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          )}
          {isLocked && (
            <svg
              className="h-3.5 w-3.5 text-purple-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          )}
        </button>
      )}

      {/* Input container with chips - click focuses input */}
      <div
        role="button"
        aria-label={`${label} input`}
        tabIndex={isLocked ? -1 : 0}
        className={`
          flex min-h-[38px] flex-wrap items-center gap-1.5 rounded-lg border 
          px-2 py-1.5 transition-colors
          ${
            isLocked
              ? 'border-purple-500/50 bg-gradient-to-r from-purple-600/20 to-pink-600/20 cursor-not-allowed'
              : `bg-slate-950/80 cursor-text ${isOpen ? 'border-sky-500 ring-1 ring-sky-500' : 'border-slate-700'}`
          }
          focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500
        `}
        onClick={() => !isLocked && inputRef.current?.focus()}
        onKeyDown={handleContainerKeyDown}
      >
        {/* Selected chips */}
        {selected.map((item) => (
          <span
            key={item}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
              isLocked ? 'bg-purple-600/30 text-purple-200' : 'bg-sky-600/30 text-sky-100'
            }`}
          >
            <span className="max-w-[120px] truncate">{item}</span>
            {!isLocked && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(item);
                }}
                className="ml-0.5 rounded-full p-0.5 hover:bg-sky-500/30 focus:outline-none focus:ring-1 focus:ring-sky-400"
                aria-label={`Remove ${item}`}
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </span>
        ))}

        {/* Text input with spellcheck */}
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={filter}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          onFocus={handleInputFocus}
          placeholder={
            isLocked ? '' : selected.length === 0 ? placeholder : allowFreeText ? '' : 'Filter...'
          }
          spellCheck="true"
          className={`min-w-[80px] flex-1 bg-transparent text-xl outline-none ${
            isLocked
              ? 'text-purple-200 placeholder:text-purple-400 cursor-not-allowed'
              : 'text-slate-100 placeholder:text-slate-500'
          }`}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          disabled={isLocked || !canSelectMore}
        />

        {/* Dropdown indicator */}
        {!isLocked && (
          <button
            type="button"
            onClick={() => {
              const newIsOpen = !isOpen;
              setIsOpen(newIsOpen);
              if (newIsOpen) {
                setShowTooltip(true);
                if (tooltipTimeoutRef.current) {
                  clearTimeout(tooltipTimeoutRef.current);
                }
                tooltipTimeoutRef.current = setTimeout(() => {
                  setShowTooltip(false);
                }, 4000);
              }
            }}
            className="ml-auto p-0.5 text-slate-400 hover:text-slate-200 focus:outline-none focus:text-slate-200"
            tabIndex={-1}
            aria-label="Toggle dropdown"
          >
            <svg
              className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Character counter for free text - BRIGHT PINK (only if allowFreeText and not locked) */}
      {allowFreeText && filter.length > 0 && !isLocked && (
        <p className="text-[0.65rem] font-medium text-pink-500">
          {charCount}/{maxCustomChars}
        </p>
      )}

      {/* Selection count for limit 2+ (only when selections made and not locked) */}
      {selected.length > 0 && maxSelections >= 2 && !isLocked && (
        <p className="text-[0.6rem] text-slate-500">
          {selected.length} of {maxSelections} selected
        </p>
      )}

      {/* Dropdown listbox - taller with optional 2-column grid for visual density */}
      {isOpen &&
        !isLocked &&
        (filteredOptions.length > 0 || (isMultiSelect && selected.length > 0)) && (
          <div className="absolute left-0 right-0 top-full z-[100] mt-1 rounded-lg border border-slate-700 bg-slate-900 shadow-lg">
            {/* Options list */}
            {filteredOptions.length > 0 && (
              <ul
                id={listboxId}
                role="listbox"
                className={`max-h-80 overflow-auto py-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30 ${
                  useGridLayout ? 'grid grid-cols-2 gap-x-1' : ''
                }`}
              >
                {/* Show ALL filtered options - 2-column grid when many options (unless singleColumn) */}
                {filteredOptions.map((option) => (
                  <li
                    key={option}
                    role="option"
                    aria-selected={false}
                    className="px-3 py-1.5 text-base text-slate-200 hover:bg-slate-800 focus-within:bg-slate-800 rounded"
                  >
                    <button
                      type="button"
                      onClick={() => handleSelect(option)}
                      disabled={!canSelectMore}
                      className={`w-full text-left focus:outline-none truncate ${
                        !canSelectMore ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      title={option}
                    >
                      {option}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Done button for multi-select (when at least 1 selection made) */}
            {isMultiSelect && selected.length > 0 && (
              <div className="border-t border-slate-700 px-3 py-2">
                <button
                  type="button"
                  onClick={handleDone}
                  className="w-full rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500 transition-colors"
                >
                  Done ({selected.length}/{maxSelections})
                </button>
              </div>
            )}
          </div>
        )}

      {/* Empty state when filtering - for custom entry (only if allowFreeText and not locked) */}
      {isOpen &&
        !isLocked &&
        filter &&
        filteredOptions.length === 0 &&
        selected.length < maxSelections &&
        allowFreeText && (
          <div className="absolute left-0 right-0 top-full z-[100] mt-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-400 shadow-lg">
            Press Enter to add &quot;{filter}&quot;
          </div>
        )}

      {/* Empty state when filtering without free text allowed */}
      {isOpen && !isLocked && filter && filteredOptions.length === 0 && !allowFreeText && (
        <div className="absolute left-0 right-0 top-full z-[100] mt-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-400 shadow-lg">
          No matching options
        </div>
      )}

      {/* ========================================================================
          VOCABULARY CHIPS SECTION (NEW in v7.0.0)
          Shows clickable chips for quick selection from full vocabulary
          ======================================================================== */}
      {shouldShowChips && canSelectMore && (
        <div className="mt-2">
          {/* Section label */}
          <p className="mb-1.5 text-[0.6rem] font-medium uppercase tracking-wider text-slate-500">
            {chipSectionLabel}
            {filteredChips.length >= CHIP_DISPLAY_LIMIT && (
              <span className="ml-1 font-normal normal-case">
                (showing {CHIP_DISPLAY_LIMIT} of {chipOptions?.length || 0})
              </span>
            )}
          </p>

          {/* Chips container - horizontal scroll with fade edges */}
          <div className="relative">
            {/* Left fade gradient */}
            <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-slate-950 to-transparent z-10" />

            {/* Scrollable chips */}
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30">
              {filteredChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleChipClick(chip)}
                  disabled={!canSelectMore}
                  className={`
                    inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] font-medium
                    transition-all duration-150 ease-out
                    ${
                      canSelectMore
                        ? 'bg-slate-800/60 text-slate-400 border border-slate-700/50 hover:bg-slate-700/80 hover:text-slate-200 hover:border-slate-600 active:scale-95 cursor-pointer'
                        : 'bg-slate-900/40 text-slate-600 border border-slate-800/30 cursor-not-allowed'
                    }
                  `}
                  title={`Add "${chip}"`}
                >
                  <span className="max-w-[100px] truncate">{chip}</span>
                  {canSelectMore && (
                    <svg
                      className="ml-1 h-2.5 w-2.5 opacity-50"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  )}
                </button>
              ))}
            </div>

            {/* Right fade gradient */}
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-slate-950 to-transparent z-10" />
          </div>
        </div>
      )}
    </div>
  );
}

export default Combobox;
