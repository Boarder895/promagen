// src/components/ui/intelligent-phrases-combobox.tsx
// ============================================================================
// INTELLIGENT PHRASES COMBOBOX
// ============================================================================
// Adjacent dropdown component placed next to each standard Combobox in the
// prompt builder. Shows commodity-enriched phrases from the vocabulary system,
// filtered by cascading context from upstream selections.
//
// BEHAVIOUR:
// - Phrases hidden by default (dropdown closed, no results shown)
// - User types → first-letter matching on any word in phrase → results appear
// - One phrase per category (strict, replaces on new selection)
// - Selected phrase shown as chip with ✕ remove button
// - ✦ sparkle icon distinguishes from standard dropdowns
// - Locked state: disabled input, purple tint, no interaction
// - Randomise button does NOT affect this dropdown (spec §3.6)
//
// VISUAL DESIGN:
// - Matches existing Combobox dark slate theme
// - Amber accent for sparkle icon and category badge
// - Truncated phrase text with title tooltip
// - Max 30 results shown for performance
// - Scrollable dropdown with fade edges
//
// Authority: go-big-or-go-home-prompt-builder.md v2 §Phase 6
// Existing features preserved: Yes
// ============================================================================

'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { PromptCategory } from '@/types/prompt-builder';
import type { IntelligentPhrase } from '@/data/vocabulary/phrase-category-types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Max results shown in dropdown for performance */
const MAX_RESULTS = 30;

/** Min query length before searching */
const MIN_QUERY_LENGTH = 1;

// ============================================================================
// PROPS
// ============================================================================

export interface IntelligentPhrasesComboboxProps {
  /** Which prompt builder category this dropdown serves */
  category: PromptCategory;

  /** Currently selected phrase (null = none) */
  selectedPhrase: IntelligentPhrase | null;

  /** Callback: user selected a phrase */
  onSelect: (phrase: IntelligentPhrase) => void;

  /** Callback: user removed the phrase */
  onRemove: () => void;

  /** Function to search phrases (from useIntelligentPhrases hook) */
  onSearch: (query: string) => IntelligentPhrase[];

  /** Whether the combobox is locked (prompt builder locked) */
  isLocked?: boolean;

  /** Whether this category is eligible for phrases */
  isEligible?: boolean;

  /** Compact mode: hides label row */
  compact?: boolean;

  /** Custom placeholder text */
  placeholder?: string;

  /** Custom class name */
  className?: string;
}

// ============================================================================
// SPARKLE ICON
// ============================================================================

function SparkleIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41L12 0Z" />
    </svg>
  );
}

// ============================================================================
// GROUP BADGE
// ============================================================================

function GroupBadge({ group }: { group?: string }) {
  if (!group) return null;

  const config = {
    energy: { label: 'Energy', bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
    agriculture: { label: 'Agri', bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    metals: { label: 'Metal', bg: 'bg-slate-400/15', text: 'text-slate-300', border: 'border-slate-400/30' },
  }[group];

  if (!config) return null;

  return (
    <span
      className={`ml-1.5 inline-flex items-center rounded px-1 py-0.5 text-[0.55rem] font-medium uppercase tracking-wider ${config.bg} ${config.text} border ${config.border}`}
    >
      {config.label}
    </span>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function IntelligentPhrasesCombobox({
  category,
  selectedPhrase,
  onSelect,
  onRemove,
  onSearch,
  isLocked = false,
  isEligible = true,
  compact = false,
  placeholder = '✦ Type to explore phrases…',
  className = '',
}: IntelligentPhrasesComboboxProps) {
  // =========================================================================
  // STATE
  // =========================================================================
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Prevent double-click race condition (mirrors Combobox v6.3.0 pattern)
  const isSelectingRef = useRef(false);

  // =========================================================================
  // SEARCH RESULTS (memoised on query change)
  // =========================================================================
  const searchResults = useMemo(() => {
    if (!isOpen || query.length < MIN_QUERY_LENGTH) return [];
    const results = onSearch(query);
    return results.slice(0, MAX_RESULTS);
  }, [isOpen, query, onSearch]);

  const hasResults = searchResults.length > 0;
  const totalCount = useMemo(() => {
    if (!isOpen || query.length < MIN_QUERY_LENGTH) return 0;
    return onSearch(query).length;
  }, [isOpen, query, onSearch]);

  // =========================================================================
  // CLOSE ON CLICK OUTSIDE
  // =========================================================================
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // =========================================================================
  // HANDLERS
  // =========================================================================

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (!isOpen) setIsOpen(true);
  }, [isOpen]);

  const handleInputFocus = useCallback(() => {
    if (!isLocked && isEligible && !selectedPhrase) {
      setIsOpen(true);
    }
  }, [isLocked, isEligible, selectedPhrase]);

  const handleSelect = useCallback(
    (phrase: IntelligentPhrase) => {
      if (isLocked || isSelectingRef.current) return;

      isSelectingRef.current = true;

      // Close dropdown and clear query
      setIsOpen(false);
      setQuery('');

      // Notify parent
      onSelect(phrase);

      // Reset selecting flag after a tick
      requestAnimationFrame(() => {
        isSelectingRef.current = false;
      });
    },
    [isLocked, onSelect],
  );

  const handleRemove = useCallback(() => {
    if (isLocked) return;
    onRemove();
    // Re-focus input after removal so user can immediately search again
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [isLocked, onRemove]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
        inputRef.current?.blur();
      }
    },
    [],
  );

  // =========================================================================
  // RENDER: Not eligible → nothing
  // =========================================================================
  if (!isEligible) return null;

  // =========================================================================
  // RENDER
  // =========================================================================
  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* ===============================================================
          LABEL ROW (unless compact)
          =============================================================== */}
      {!compact && (
        <div className="mb-1 flex items-center gap-1.5">
          <SparkleIcon className="text-amber-400/70" />
          <span className="text-[0.65rem] font-medium uppercase tracking-wider text-amber-400/60">
            Intelligent Phrases
          </span>
        </div>
      )}

      {/* ===============================================================
          SELECTED PHRASE CHIP (when a phrase is chosen)
          =============================================================== */}
      {selectedPhrase && (
        <div className="mb-1.5 flex items-start gap-1">
          <div
            className={`
              group flex items-center gap-1.5 rounded-lg px-2.5 py-1.5
              bg-amber-500/10 border border-amber-500/25
              text-sm text-amber-200/90
              transition-colors duration-150
              ${isLocked ? 'opacity-60' : 'hover:bg-amber-500/15 hover:border-amber-500/35'}
            `}
            title={selectedPhrase.text}
          >
            <SparkleIcon className="shrink-0 text-amber-400/60" />
            <span className="max-w-[260px] truncate">{selectedPhrase.text}</span>
            <GroupBadge group={selectedPhrase.commodityGroup} />
            {!isLocked && (
              <button
                type="button"
                onClick={handleRemove}
                className="ml-0.5 shrink-0 rounded-full p-0.5 text-amber-400/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                aria-label={`Remove phrase from ${category}`}
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ===============================================================
          SEARCH INPUT (hidden when phrase is selected)
          =============================================================== */}
      {!selectedPhrase && (
        <div className="relative flex items-center">
          {/* Sparkle prefix */}
          <div className="pointer-events-none absolute left-2.5 text-amber-400/40">
            <SparkleIcon />
          </div>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onKeyDown={handleKeyDown}
            placeholder={isLocked ? 'Locked' : placeholder}
            disabled={isLocked}
            spellCheck={false}
            autoComplete="off"
            className={`
              w-full rounded-lg py-2 pl-8 pr-3
              text-sm
              bg-slate-900/60 border border-slate-700/50
              text-slate-200 placeholder:text-slate-500/70
              focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-colors duration-150
              ${isLocked ? 'bg-purple-500/5 border-purple-500/20' : ''}
            `}
            role="combobox"
            aria-expanded={isOpen && hasResults}
            aria-controls={`intelligent-phrases-${category}-listbox`}
            aria-autocomplete="list"
            aria-label={`Search intelligent phrases for ${category}`}
          />
        </div>
      )}

      {/* ===============================================================
          DROPDOWN RESULTS
          =============================================================== */}
      {isOpen && !isLocked && !selectedPhrase && query.length >= MIN_QUERY_LENGTH && (
        <>
          {hasResults ? (
            <div className="absolute left-0 right-0 top-full z-[100] mt-1 rounded-lg border border-slate-700/70 bg-slate-900 shadow-xl shadow-black/30">
              {/* Result count header */}
              <div className="flex items-center justify-between border-b border-slate-800 px-3 py-1.5">
                <span className="text-[0.6rem] font-medium uppercase tracking-wider text-slate-500">
                  {totalCount <= MAX_RESULTS
                    ? `${totalCount} phrase${totalCount !== 1 ? 's' : ''}`
                    : `${MAX_RESULTS} of ${totalCount} phrases`}
                </span>
                <SparkleIcon className="text-amber-400/30" />
              </div>

              {/* Results list */}
              <ul
                id={`intelligent-phrases-${category}-listbox`}
                role="listbox"
                className="max-h-64 overflow-y-auto py-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/15 hover:scrollbar-thumb-white/25"
              >
                {searchResults.map((phrase, idx) => (
                  <li key={`${phrase.text}-${idx}`} role="option" aria-selected={false}>
                    <button
                      type="button"
                      onClick={() => handleSelect(phrase)}
                      className="group flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-slate-800/80 transition-colors"
                      title={phrase.text}
                    >
                      {/* Phrase text */}
                      <span className="flex-1 text-sm leading-snug text-slate-300 group-hover:text-slate-100 line-clamp-2">
                        {highlightMatch(phrase.text, query)}
                      </span>

                      {/* Group badge */}
                      <GroupBadge group={phrase.commodityGroup} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            /* No results message */
            <div className="absolute left-0 right-0 top-full z-[100] mt-1 rounded-lg border border-slate-700/50 bg-slate-900 px-3 py-2.5 shadow-lg">
              <p className="text-center text-xs text-slate-500">
                No phrases match &ldquo;{query}&rdquo;
              </p>
            </div>
          )}
        </>
      )}

      {/* ===============================================================
          TYPING HINT (shown when focused but no query yet)
          =============================================================== */}
      {isOpen && !isLocked && !selectedPhrase && query.length === 0 && (
        <div className="absolute left-0 right-0 top-full z-[100] mt-1 rounded-lg border border-slate-700/30 bg-slate-900/95 px-3 py-2 shadow-lg">
          <p className="text-center text-xs text-slate-500/80">
            Type to discover commodity-enriched phrases
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Highlight the matching portion of text.
 * Finds words starting with the query and wraps the match in a span.
 */
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || query.length === 0) return text;

  const q = query.toLowerCase();
  const words = text.split(/(\s+)/); // Split preserving whitespace

  return (
    <>
      {words.map((segment, i) => {
        // Whitespace segments pass through
        if (/^\s+$/.test(segment)) return segment;

        // Check if this word starts with the query
        if (segment.toLowerCase().startsWith(q)) {
          return (
            <React.Fragment key={i}>
              <span className="text-amber-400 font-medium">
                {segment.slice(0, query.length)}
              </span>
              {segment.slice(query.length)}
            </React.Fragment>
          );
        }

        return segment;
      })}
    </>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default IntelligentPhrasesCombobox;
