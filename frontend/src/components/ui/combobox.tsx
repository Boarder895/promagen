// src/components/ui/combobox.tsx
// Enhanced multi-select combobox with lock states and proper auto-close
// Version 5.0.0 - Cleaner lock state: disabled styling only, no overlay text
// Features:
// - Lock state shows disabled styling (purple tint) but NO overlay text
// - When locked: shows placeholder, dropdown arrow hidden, can't interact
// - Dropdown closes immediately for limit 1
// - Tooltip has z-[9999] and reserved space (pt-8) to avoid clipping
// - "Type to add custom entry" in tooltip (only if allowFreeText=true)
// - Bright pink char counter (text-pink-500)
// - spellCheck="true" on input
// - allowFreeText prop: when false, hides free text input
// - Shows ALL options in scrollable dropdown (no artificial limit)

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

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
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [showTooltip, setShowTooltip] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Filter options based on input (exclude already selected and empty first option)
  const filteredOptions = options
    .filter((opt) => opt !== '') // Exclude empty option
    .filter((opt) => !selected.includes(opt))
    .filter((opt) => opt.toLowerCase().includes(filter.toLowerCase()));

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

  // Auto-close logic based on selection limits
  const handleSelect = useCallback(
    (option: string) => {
      if (isLocked) return;
      if (selected.length >= maxSelections) return;

      const newSelected = [...selected, option];
      onSelectChange(newSelected);
      setFilter('');

      // Auto-close behavior: close immediately when limit reached
      if (newSelected.length >= maxSelections) {
        setIsOpen(false);
        setShowTooltip(false);
      }

      // Keep focus on input for continued interaction if not closed
      if (newSelected.length < maxSelections) {
        inputRef.current?.focus();
      }
    },
    [selected, maxSelections, onSelectChange, isLocked],
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
        onSelectChange(newSelected);
        setFilter('');
        onCustomChange('');

        // Auto-close when limit reached
        if (newSelected.length >= maxSelections) {
          setIsOpen(false);
          setShowTooltip(false);
        }
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

  // Lock state styling classes
  const lockClasses = isLocked ? 'prompt-lock-gradient cursor-not-allowed' : '';

  return (
    <div ref={containerRef} className={`relative flex flex-col gap-1 pt-8 ${lockClasses}`}>
      {/* Tooltip above label - HIGH z-index, NO max badge */}
      {showTooltip && !isLocked && (
        <div
          className="absolute -top-0.5 left-0 right-0 z-[9999] rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-200 shadow-xl ring-1 ring-white/20"
          style={{ pointerEvents: 'none' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-slate-300">{getTooltipText()}</span>
            {allowFreeText && (
              <>
                <span className="text-slate-500">·</span>
                <span className="text-pink-400">Type to add custom entry</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Label - clickable to show tooltip */}
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
          className={`min-w-[80px] flex-1 bg-transparent text-sm outline-none ${
            isLocked
              ? 'text-purple-200 placeholder:text-purple-400 cursor-not-allowed'
              : 'text-slate-100 placeholder:text-slate-500'
          }`}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          disabled={isLocked || selected.length >= maxSelections}
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

      {/* Dropdown listbox - shows ALL options, scrollable (only when not locked) */}
      {isOpen && !isLocked && filteredOptions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-[100] mt-1 max-h-60 overflow-auto rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-lg scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30"
        >
          {/* Show ALL filtered options - no slice limit */}
          {filteredOptions.map((option) => (
            <li
              key={option}
              role="option"
              aria-selected={false}
              className="px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 focus-within:bg-slate-800"
            >
              <button
                type="button"
                onClick={() => handleSelect(option)}
                className="w-full text-left focus:outline-none"
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
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
    </div>
  );
}

export default Combobox;
