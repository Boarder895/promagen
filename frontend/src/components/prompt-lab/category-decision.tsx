// src/components/prompt-lab/category-decision.tsx
// ============================================================================
// CATEGORY DECISION — Prompt Lab v4 Phase 3 (Decide)
// ============================================================================
// Renders Engine/Manual toggles for each missing category.
// Manual mode expands a grouped dropdown with vocabulary from prompt-options.
//
// Human factors:
//   §11 Cognitive Load — binary toggle per category, not 4 buttons
//   §1 Curiosity Gap — dropdown reveals expert terms the user didn't know
//   Hick's Law — one decision at a time, sensible defaults (all Engine)
//
// Open design questions resolved:
//   OD-2: Toggle feel → segmented control (Engine | Manual)
//   OD-3: Manual dropdown → slide-down with grouped subcategories
//   OD-4: Skip gaps → subtle text link below (in AssessmentBox)
//
// Authority: prompt-lab-v4-flow.md §5, §7, §14
// Code standard: All clamp() (§6.0), no grey text, cursor-pointer,
//   co-located animations, min 10px font
// ============================================================================

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import type { PromptCategory } from '@/types/prompt-builder';
import type { CategoryDecision, SideNote } from '@/types/category-assessment';
import { getOptions, getSubcategories, getSubcategoryOptions } from '@/data/vocabulary/prompt-builder';
import type { CategoryKey } from '@/data/vocabulary/prompt-builder';

// ============================================================================
// CO-LOCATED STYLES
// ============================================================================

const DECISION_STYLES = `
  @keyframes decide-slide-down {
    from {
      opacity: 0;
      max-height: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      max-height: 240px;
      transform: translateY(0);
    }
  }
  .decide-dropdown-enter {
    animation: decide-slide-down 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
    overflow: hidden;
  }

  @keyframes decide-row-enter {
    from {
      opacity: 0;
      transform: translateX(-6px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  .decide-row {
    animation: decide-row-enter 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @media (prefers-reduced-motion: reduce) {
    .decide-dropdown-enter { animation-duration: 0.01ms; }
    .decide-row { animation-duration: 0.01ms; }
  }
`;

// ============================================================================
// CATEGORY DISPLAY CONFIG
// ============================================================================

const CATEGORY_DISPLAY: Record<PromptCategory, { emoji: string; label: string }> = {
  subject: { emoji: '👤', label: 'Subject' },
  action: { emoji: '🏃', label: 'Action' },
  style: { emoji: '🎨', label: 'Style' },
  environment: { emoji: '🌍', label: 'Environment' },
  composition: { emoji: '📐', label: 'Composition' },
  camera: { emoji: '📷', label: 'Camera' },
  lighting: { emoji: '💡', label: 'Lighting' },
  colour: { emoji: '🎨', label: 'Colour' },
  atmosphere: { emoji: '🌫️', label: 'Atmosphere' },
  materials: { emoji: '🧱', label: 'Materials' },
  fidelity: { emoji: '✨', label: 'Fidelity' },
  negative: { emoji: '🚫', label: 'Constraints' },
};

// ============================================================================
// TYPES
// ============================================================================

export interface CategoryDecisionListProps {
  /** Categories that are NOT covered (gaps) — from assessment */
  gapCategories: PromptCategory[];
  /** Current decisions per gap category */
  decisions: CategoryDecision[];
  /** Current side notes (for showing selected manual terms) */
  sideNotes: SideNote[];
  /** Called when a decision changes (toggle or term selection) */
  onDecisionChange: (category: PromptCategory, fill: 'engine' | string) => void;
  /** Whether generation is in progress (disables interaction) */
  disabled?: boolean;
}

// ============================================================================
// GROUPED VOCABULARY DROPDOWN
// ============================================================================

/**
 * Get vocabulary options grouped by subcategory for the manual dropdown.
 * Returns subcategory groups with their options. Falls back to flat list
 * if no subcategories exist.
 */
function getGroupedOptions(category: PromptCategory): {
  groups: Array<{ name: string; displayName: string; options: string[] }>;
  flatOptions: string[];
} {
  const catKey = category as CategoryKey;
  const subcats = getSubcategories(catKey);
  const allOptions = getOptions(catKey);

  if (subcats.length === 0) {
    return { groups: [], flatOptions: allOptions.slice(0, 30) };
  }

  const groups = subcats.map((sub) => ({
    name: sub,
    displayName: sub.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    options: getSubcategoryOptions(catKey, sub).slice(0, 8),
  })).filter((g) => g.options.length > 0);

  return { groups, flatOptions: allOptions.slice(0, 30) };
}

// ============================================================================
// SINGLE CATEGORY ROW
// ============================================================================

function CategoryDecisionRow({
  category,
  fill,
  sideNote,
  onDecisionChange,
  disabled = false,
  index,
}: {
  category: PromptCategory;
  fill: 'engine' | string;
  sideNote: SideNote | undefined;
  onDecisionChange: (category: PromptCategory, fill: 'engine' | string) => void;
  disabled?: boolean;
  index: number;
}) {
  const display = CATEGORY_DISPLAY[category];
  const isManual = fill !== 'engine';
  const [dropdownOpen, setDropdownOpen] = useState(isManual);
  const [searchTerm, setSearchTerm] = useState('');

  const { groups, flatOptions } = useMemo(() => getGroupedOptions(category), [category]);

  // Toggle between Engine and Manual
  const handleToggle = useCallback(
    (mode: 'engine' | 'manual') => {
      if (disabled) return;
      if (mode === 'engine') {
        onDecisionChange(category, 'engine');
        setDropdownOpen(false);
        setSearchTerm('');
      } else {
        setDropdownOpen(true);
        // Don't change fill yet — user needs to pick a term
      }
    },
    [category, disabled, onDecisionChange],
  );

  // User picks a term from the dropdown
  const handleTermSelect = useCallback(
    (term: string) => {
      if (disabled) return;
      onDecisionChange(category, term);
      setSearchTerm('');
    },
    [category, disabled, onDecisionChange],
  );

  // Filter options by search
  const filteredGroups = useMemo(() => {
    if (!searchTerm.trim()) return groups;
    const lower = searchTerm.toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        options: g.options.filter((o) => o.toLowerCase().includes(lower)),
      }))
      .filter((g) => g.options.length > 0);
  }, [groups, searchTerm]);

  const filteredFlat = useMemo(() => {
    if (!searchTerm.trim()) return flatOptions;
    const lower = searchTerm.toLowerCase();
    return flatOptions.filter((o) => o.toLowerCase().includes(lower));
  }, [flatOptions, searchTerm]);

  return (
    <div
      className="decide-row rounded-lg border border-slate-700/40 bg-slate-900/40"
      style={{
        padding: 'clamp(8px, 0.7vw, 12px) clamp(10px, 0.9vw, 14px)',
        animationDelay: `${index * 50}ms`,
      }}
    >
      {/* ── Row header: emoji + label + toggle ──────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center" style={{ gap: 'clamp(6px, 0.5vw, 8px)' }}>
          <span
            style={{ fontSize: 'clamp(0.8rem, 0.85vw, 0.95rem)' }}
            aria-hidden="true"
          >
            {display.emoji}
          </span>
          <span
            className="font-medium text-white"
            style={{ fontSize: 'clamp(0.7rem, 0.78vw, 0.85rem)' }}
          >
            {display.label}
          </span>
          {/* Show chosen term as pill when manual + selected */}
          {isManual && sideNote && (
            <span
              className="inline-flex items-center rounded-full bg-sky-500/15 ring-1 ring-sky-400/30 text-sky-300"
              style={{
                padding: 'clamp(1px, 0.1vw, 2px) clamp(6px, 0.5vw, 10px)',
                fontSize: 'clamp(0.58rem, 0.64vw, 0.72rem)',
                maxWidth: 'clamp(120px, 12vw, 200px)',
              }}
            >
              <span className="truncate">{sideNote.term}</span>
            </span>
          )}
        </div>

        {/* ── Segmented toggle: Engine | Manual (OD-2) ─────────────── */}
        <div
          className="inline-flex rounded-md overflow-hidden ring-1 ring-slate-600/50"
          role="radiogroup"
          aria-label={`${display.label} fill mode`}
        >
          <button
            type="button"
            role="radio"
            aria-checked={!isManual}
            onClick={() => handleToggle('engine')}
            disabled={disabled}
            className={`
              font-medium transition-all duration-150
              ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
              ${
                !isManual
                  ? 'bg-emerald-500/25 text-emerald-300 ring-1 ring-emerald-400/40'
                  : 'bg-slate-800/60 text-white hover:bg-slate-800/80'
              }
            `}
            style={{
              padding: 'clamp(3px, 0.25vw, 5px) clamp(8px, 0.7vw, 12px)',
              fontSize: 'clamp(0.6rem, 0.66vw, 0.73rem)',
            }}
          >
            Engine
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={isManual || dropdownOpen}
            onClick={() => handleToggle('manual')}
            disabled={disabled}
            className={`
              font-medium transition-all duration-150
              ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
              ${
                isManual || dropdownOpen
                  ? 'bg-sky-500/25 text-sky-300 ring-1 ring-sky-400/40'
                  : 'bg-slate-800/60 text-white hover:bg-slate-800/80'
              }
            `}
            style={{
              padding: 'clamp(3px, 0.25vw, 5px) clamp(8px, 0.7vw, 12px)',
              fontSize: 'clamp(0.6rem, 0.66vw, 0.73rem)',
            }}
          >
            Manual
          </button>
        </div>
      </div>

      {/* ── Manual dropdown (OD-3: slide-down with subcategory groups) ── */}
      {dropdownOpen && (
        <div
          className="decide-dropdown-enter"
          style={{ marginTop: 'clamp(6px, 0.5vw, 10px)' }}
        >
          {/* Search filter */}
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={`Search ${display.label.toLowerCase()} terms...`}
            disabled={disabled}
            className="w-full rounded-md border border-slate-700/50 bg-slate-900/60 text-white placeholder-slate-500 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/30 transition-colors"
            style={{
              padding: 'clamp(5px, 0.4vw, 8px) clamp(8px, 0.7vw, 12px)',
              fontSize: 'clamp(0.62rem, 0.68vw, 0.76rem)',
            }}
          />

          {/* Scrollable options area */}
          <div
            className="overflow-y-auto"
            style={{
              maxHeight: 'clamp(140px, 14vw, 200px)',
              marginTop: 'clamp(4px, 0.35vw, 6px)',
            }}
          >
            {/* Subcategory groups */}
            {filteredGroups.length > 0 ? (
              filteredGroups.map((group) => (
                <div key={group.name} style={{ marginBottom: 'clamp(6px, 0.5vw, 8px)' }}>
                  <span
                    className="text-sky-400 font-medium uppercase tracking-wider"
                    style={{
                      fontSize: 'clamp(0.52rem, 0.56vw, 0.62rem)',
                      display: 'block',
                      marginBottom: 'clamp(2px, 0.2vw, 4px)',
                      paddingLeft: 'clamp(2px, 0.2vw, 4px)',
                    }}
                  >
                    {group.displayName}
                  </span>
                  <div className="flex flex-wrap" style={{ gap: 'clamp(3px, 0.25vw, 5px)' }}>
                    {group.options.map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => handleTermSelect(term)}
                        disabled={disabled}
                        className={`
                          rounded-full transition-all duration-150
                          ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
                          ${
                            sideNote?.term === term
                              ? 'bg-sky-500/25 ring-1 ring-sky-400/50 text-sky-200'
                              : 'bg-slate-800/50 ring-1 ring-slate-700/40 text-white hover:bg-slate-700/50 hover:ring-sky-500/30'
                          }
                        `}
                        style={{
                          padding: 'clamp(2px, 0.2vw, 4px) clamp(7px, 0.6vw, 10px)',
                          fontSize: 'clamp(0.58rem, 0.64vw, 0.72rem)',
                        }}
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            ) : filteredFlat.length > 0 ? (
              /* Flat list fallback (no subcategories or all filtered out) */
              <div className="flex flex-wrap" style={{ gap: 'clamp(3px, 0.25vw, 5px)' }}>
                {filteredFlat.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => handleTermSelect(term)}
                    disabled={disabled}
                    className={`
                      rounded-full transition-all duration-150
                      ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
                      ${
                        sideNote?.term === term
                          ? 'bg-sky-500/25 ring-1 ring-sky-400/50 text-sky-200'
                          : 'bg-slate-800/50 ring-1 ring-slate-700/40 text-white hover:bg-slate-700/50 hover:ring-sky-500/30'
                      }
                    `}
                    style={{
                      padding: 'clamp(2px, 0.2vw, 4px) clamp(7px, 0.6vw, 10px)',
                      fontSize: 'clamp(0.58rem, 0.64vw, 0.72rem)',
                    }}
                  >
                    {term}
                  </button>
                ))}
              </div>
            ) : (
              <p
                className="text-white"
                style={{
                  fontSize: 'clamp(0.58rem, 0.62vw, 0.7rem)',
                  padding: 'clamp(4px, 0.35vw, 6px)',
                }}
              >
                No matching terms
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN LIST COMPONENT
// ============================================================================

export function CategoryDecisionList({
  gapCategories,
  decisions,
  sideNotes,
  onDecisionChange,
  disabled = false,
}: CategoryDecisionListProps) {
  if (gapCategories.length === 0) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: DECISION_STYLES }} />

      <div>
        {/* Decision rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(4px, 0.35vw, 6px)' }}>
          {gapCategories.map((cat, i) => {
            const decision = decisions.find((d) => d.category === cat);
            const fill = decision?.fill ?? 'engine';
            const sideNote = sideNotes.find((s) => s.category === cat);

            return (
              <CategoryDecisionRow
                key={cat}
                category={cat}
                fill={fill}
                sideNote={sideNote}
                onDecisionChange={onDecisionChange}
                disabled={disabled}
                index={i}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}

export default CategoryDecisionList;
