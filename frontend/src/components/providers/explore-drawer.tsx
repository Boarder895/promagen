// src/components/providers/explore-drawer.tsx
// ============================================================================
// EXPLORE DRAWER v2.0.0 — Phase 4 Polish & Integration
// ============================================================================
// Expandable vocabulary panel per category with source grouping, search,
// pagination, and click-to-add chip clouds.
//
// v2.0.0 changes (Phase 4):
//   4.1 — Scene flavour phrases: "🎬 Scene" tab at top when active scene
//         has flavourPhrases for this category
//   4.2 — Analytics: explore_drawer_opened + explore_chip_clicked events
//   4.3 — All 4 tier badges (not just Tier 4):
//           Tier 1 (CLIP):  ★ on 1–2 word terms (token-efficient)
//           Tier 2 (MJ):    ◆ on 2–4 word terms (keyword-sweet-spot)
//           Tier 3 (NL):    💬 on 3+ word terms (descriptive-friendly)
//           Tier 4 (Plain): ⚡ simple / ⚠ complex (word-count heuristic)
//   4.4 — Cascade relevance ordering: chips sorted by cascade score
//         when available, alphabetical fallback
//
// Layout:
//   ┌─ Trigger bar (collapsed) ──────────────────────────────────────────┐
//   │  "Explore 854 more phrases ▾"                                      │
//   └────────────────────────────────────────────────────────────────────┘
//   ┌─ Expanded panel ───────────────────────────────────────────────────┐
//   │  🔍 [Search phrases...]                                            │
//   │  [🎬 Scene (4)] [📋 All (854)] [📋 Core] [🌤️ Weather] ...        │
//   │  chip · chip · chip · chip · chip · chip · chip                    │
//   │  [Show 60 more (194 left)]                                         │
//   └────────────────────────────────────────────────────────────────────┘
//
// Behaviour:
//   - Collapsed by default. Parent manages accordion (one open at a time).
//   - Chips sorted by cascade score when available, alphabetical fallback.
//   - Click chip → adds to selection via onAddTerm callback
//   - All tiers get contextual badges on chips
//   - Lazy-loads data only when expanded
//   - Paginated: 60 chips at a time, "Show more" button
//   - Search: real-time substring filter with match highlight
//
// Animation placement: ALL animations co-located in this file
// per best-working-practice.md § Animation placement (component-first rule).
// Nothing in globals.css.
//
// Authority: prompt-builder-evolution-plan-v2.md § 7, § 8
//
// v4.5 — Step 7.9d: Compression expendability indicators on chips.
//         compressionLookup prop → thin coloured underline on expendable terms.
// v4.6 — Step 7.9f: Staleness alert when compressionLookup is absent.
// ============================================================================

'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { getOptions, type CategoryKey } from '@/data/vocabulary/prompt-builder';
import {
  getSourceGroupedOptions,
  getExploreCount,
  type SourceGroup,
} from '@/lib/vocabulary/vocabulary-loader';
import { trackEvent } from '@/lib/analytics/events';
import type { PromptCategory } from '@/types/prompt-builder';
import { lookupExpendability, type CompressionLookup } from '@/lib/learning/compression-lookup';

// ============================================================================
// Co-located styles (no globals.css)
// ============================================================================

const EXPLORE_STYLES = `
  @keyframes ed-fade-in {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .ed-panel { animation: ed-fade-in 0.2s ease-out; }
  .ed-chip-highlight { font-weight: 600; text-decoration: underline; text-decoration-color: rgba(56,189,248,0.4); text-underline-offset: 2px; }
`;

// ============================================================================
// Constants
// ============================================================================

const INITIAL_CHIP_LIMIT = 60;
const CHIP_PAGE_SIZE = 60;
const SEARCH_MAX_RESULTS = 200;

// ============================================================================
// Types
// ============================================================================

/** Cascade score lookup: term (lowercase) → relevance score (0–100) */
export type CascadeScoreMap = Map<string, number>;

export interface ExploreDrawerProps {
  /** Which prompt category this drawer belongs to */
  category: PromptCategory;
  /** Currently selected terms (to exclude from chips + show count correctly) */
  selectedTerms: string[];
  /** Called when user clicks a chip — adds to selection */
  onAddTerm: (term: string) => void;
  /** Max selections for this category (to disable when full) */
  maxSelections: number;
  /** Whether the prompt builder is locked */
  isLocked: boolean;
  /** Platform tier for tier-aware badges */
  platformTier: 1 | 2 | 3 | 4;
  /** Whether this drawer is expanded (managed by parent for accordion) */
  isExpanded: boolean;
  /** Toggle callback (parent manages accordion) */
  onToggle: () => void;
  /** Step 4.1: Scene-specific bonus phrases for this category (from active scene) */
  sceneFlavourPhrases?: string[];
  /** Step 4.4: Cascade relevance scores for sorting chips (term → score) */
  cascadeScores?: CascadeScoreMap;
  /** Step 7.9d: Compression lookup for expendability indicators on chips */
  compressionLookup?: CompressionLookup | null;
}

// ============================================================================
// Source tab type (Step 4.1: added 'scene')
// ============================================================================

type SourceTab = 'scene' | 'all' | 'core' | 'weather' | 'commodity' | 'shared';

interface TabInfo {
  key: SourceTab;
  label: string;
  icon: string;
  count: number;
}

// ============================================================================
// Component
// ============================================================================

export function ExploreDrawer({
  category,
  selectedTerms,
  onAddTerm,
  maxSelections,
  isLocked,
  platformTier,
  isExpanded,
  onToggle,
  sceneFlavourPhrases,
  cascadeScores,
  compressionLookup,
}: ExploreDrawerProps) {
  // ── State ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<SourceTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [chipLimit, setChipLimit] = useState(INITIAL_CHIP_LIMIT);
  const searchRef = useRef<HTMLInputElement>(null);
  const hasTrackedOpen = useRef(false);

  // Reset pagination + search when collapsed or category changes
  useEffect(() => {
    if (!isExpanded) {
      setChipLimit(INITIAL_CHIP_LIMIT);
      setSearchQuery('');
      setActiveTab('all');
      hasTrackedOpen.current = false;
    }
  }, [isExpanded]);

  // Step 4.2: Track explore_drawer_opened (once per expand)
  useEffect(() => {
    if (isExpanded && !hasTrackedOpen.current) {
      hasTrackedOpen.current = true;
      trackEvent('explore_drawer_opened', {
        category,
        platform_tier: platformTier,
      });
    }
  }, [isExpanded, category, platformTier]);

  // Focus search when expanded
  useEffect(() => {
    if (isExpanded && searchRef.current) {
      const timeout = setTimeout(() => searchRef.current?.focus(), 150);
      return () => clearTimeout(timeout);
    }
  }, [isExpanded]);

  // ── Derived: selected set for fast lookup ──────────────────────────────
  const selectedSet = useMemo(
    () => new Set(selectedTerms.map((s) => s.toLowerCase())),
    [selectedTerms],
  );

  const canSelectMore = selectedTerms.length < maxSelections;

  // ── Derived: explore count (for trigger label) ─────────────────────────
  const exploreCount = useMemo(
    () => getExploreCount(category as CategoryKey, selectedTerms),
    [category, selectedTerms],
  );

  // ── Derived: source groups (lazy — only computed when expanded) ────────
  const sourceGroups = useMemo<SourceGroup[]>(() => {
    if (!isExpanded) return [];
    return getSourceGroupedOptions(category as CategoryKey);
  }, [isExpanded, category]);

  // ── Derived: core terms ────────────────────────────────────────────────
  const coreTerms = useMemo<string[]>(() => {
    if (!isExpanded) return [];
    return getOptions(category as CategoryKey);
  }, [isExpanded, category]);

  // ── Step 4.1: Scene flavour phrases (filtered by selection) ────────────
  const activeScenePhrases = useMemo<string[]>(() => {
    if (!sceneFlavourPhrases || sceneFlavourPhrases.length === 0) return [];
    return sceneFlavourPhrases.filter((t) => !selectedSet.has(t.toLowerCase()));
  }, [sceneFlavourPhrases, selectedSet]);

  // ── Step 4.1: Scene flavour set for fast lookup in "all" tab ──────────
  const sceneFlavourSet = useMemo<Set<string>>(() => {
    return new Set((sceneFlavourPhrases ?? []).map((t) => t.toLowerCase()));
  }, [sceneFlavourPhrases]);

  // ── Derived: tabs (Step 4.1: scene tab prepended when active) ──────────
  const tabs = useMemo<TabInfo[]>(() => {
    if (!isExpanded) return [];
    const coreCount = coreTerms.filter((t) => !selectedSet.has(t.toLowerCase())).length;

    const result: TabInfo[] = [];

    // Step 4.1: Scene tab — only when active scene has phrases for this category
    if (activeScenePhrases.length > 0) {
      result.push({
        key: 'scene',
        label: 'Scene',
        icon: '🎬',
        count: activeScenePhrases.length,
      });
    }

    const allTab: TabInfo = {
      key: 'all',
      label: 'All',
      icon: '📋',
      count: exploreCount,
    };
    const coreTb: TabInfo = {
      key: 'core',
      label: 'Core',
      icon: '📋',
      count: coreCount,
    };
    const sourceTabs: TabInfo[] = sourceGroups.map((g) => ({
      key: g.source,
      label: g.label,
      icon: g.icon,
      count: g.terms.filter((t) => !selectedSet.has(t.toLowerCase())).length,
    }));

    // If no source groups AND no scene tab, no tabs needed (core-only categories)
    if (sourceGroups.length === 0 && activeScenePhrases.length === 0) return [];

    // If only scene tab + core (no merged sources), show scene + all
    if (sourceGroups.length === 0 && activeScenePhrases.length > 0) {
      result.push(allTab);
      return result;
    }

    result.push(allTab, coreTb, ...sourceTabs);
    return result;
  }, [isExpanded, coreTerms, sourceGroups, selectedSet, exploreCount, activeScenePhrases]);

  // ── Derived: filtered + paginated chips (Step 4.4: cascade ordering) ───
  const { visibleChips, totalFiltered, hasMore } = useMemo(() => {
    if (!isExpanded) return { visibleChips: [] as string[], totalFiltered: 0, hasMore: false };

    // 1. Get terms for active tab
    let pool: string[];
    if (activeTab === 'scene') {
      // Step 4.1: Scene-only tab shows just flavour phrases
      pool = [...activeScenePhrases];
    } else if (activeTab === 'all') {
      pool = [...coreTerms, ...sourceGroups.flatMap((g) => g.terms)];
    } else if (activeTab === 'core') {
      pool = coreTerms;
    } else {
      const group = sourceGroups.find((g) => g.source === activeTab);
      pool = group?.terms ?? [];
    }

    // 2. Exclude already-selected
    pool = pool.filter((t) => !selectedSet.has(t.toLowerCase()));

    // 3. Apply search filter (substring match)
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      pool = pool.filter((t) => t.toLowerCase().includes(query));
      // Cap search results for performance
      pool = pool.slice(0, SEARCH_MAX_RESULTS);
    }

    // 4. Step 4.4: Sort by cascade score when available, alphabetical fallback
    if (cascadeScores && cascadeScores.size > 0 && activeTab !== 'scene') {
      pool.sort((a, b) => {
        const scoreA = cascadeScores.get(a.toLowerCase()) ?? 0;
        const scoreB = cascadeScores.get(b.toLowerCase()) ?? 0;
        if (scoreB !== scoreA) return scoreB - scoreA; // higher score first
        return a.localeCompare(b); // tie-break alphabetical
      });
    } else {
      pool.sort((a, b) => a.localeCompare(b));
    }

    // 5. Paginate
    const limit = searchQuery ? pool.length : chipLimit;
    const visible = pool.slice(0, limit);

    return {
      visibleChips: visible,
      totalFiltered: pool.length,
      hasMore: !searchQuery && pool.length > limit,
    };
  }, [
    isExpanded,
    activeTab,
    coreTerms,
    sourceGroups,
    selectedSet,
    searchQuery,
    chipLimit,
    activeScenePhrases,
    cascadeScores,
  ]);

  const remaining = totalFiltered - visibleChips.length;

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleToggle = useCallback(() => {
    if (isLocked) return;
    onToggle();
  }, [isLocked, onToggle]);

  const handleChipClick = useCallback(
    (term: string) => {
      if (isLocked || !canSelectMore) return;
      onAddTerm(term);

      // Step 4.2: Track explore_chip_clicked
      trackEvent('explore_chip_clicked', {
        category,
        term,
        platform_tier: platformTier,
        source_tab: activeTab,
      });
    },
    [isLocked, canSelectMore, onAddTerm, category, platformTier, activeTab],
  );

  const handleShowMore = useCallback(() => {
    setChipLimit((prev) => prev + CHIP_PAGE_SIZE);
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setChipLimit(INITIAL_CHIP_LIMIT); // reset pagination on new search
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setChipLimit(INITIAL_CHIP_LIMIT);
    searchRef.current?.focus();
  }, []);

  const handleTabClick = useCallback((tab: SourceTab) => {
    setActiveTab(tab);
    setChipLimit(INITIAL_CHIP_LIMIT);
  }, []);

  // Escape key closes drawer (document-level listener — no div onKeyDown needed)
  useEffect(() => {
    if (!isExpanded) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onToggle();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isExpanded, onToggle]);

  // ── Render ─────────────────────────────────────────────────────────────

  if (exploreCount === 0 && !isExpanded && activeScenePhrases.length === 0) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: EXPLORE_STYLES }} />

      {/* ─── Trigger bar — clickable with visible hover affordance ─── */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={isLocked}
        className={`
          w-full flex items-center justify-between rounded-lg border transition-all duration-200
          ${
            isExpanded
              ? 'border-sky-500/30 bg-sky-950/20 ring-1 ring-sky-500/10'
              : 'border-white/10 hover:border-sky-500/30 hover:bg-sky-950/15 ring-1 ring-white/5 hover:ring-sky-500/10'
          }
          ${isLocked ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}
        `}
        style={{
          padding: 'clamp(3px, 0.35vw, 6px) clamp(6px, 0.6vw, 10px)',
          marginTop: 'clamp(2px, 0.2vw, 4px)',
        }}
        aria-expanded={isExpanded}
        aria-label={`Explore ${exploreCount} ${category} phrases`}
      >
        <span
          className="text-white transition-colors"
          style={{ fontSize: 'clamp(0.625rem, 0.7vw, 0.75rem)' }}
        >
          Explore{' '}
          <span className="text-white font-medium">{exploreCount.toLocaleString()}</span> more
          phrases
          {activeScenePhrases.length > 0 && (
            <span className="text-cyan-400 ml-1">
              + {activeScenePhrases.length} scene
            </span>
          )}
        </span>
        <svg
          className={`text-slate-300 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
          style={{ width: 'clamp(10px, 0.8vw, 13px)', height: 'clamp(10px, 0.8vw, 13px)' }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* ─── Expanded panel ──────────────────────────────────────────── */}
      {isExpanded && (
        <div
          className="ed-panel rounded-lg border border-slate-800/30 bg-slate-950/40"
          style={{
            padding: 'clamp(8px, 0.8vw, 14px)',
            marginTop: 'clamp(2px, 0.2vw, 4px)',
          }}
          role="region"
          aria-label={`Explore ${category} vocabulary`}
        >
          {/* Daily refresh notice — amber, always shown when panel is open */}
          {!compressionLookup && (
            <div
              className="flex items-center gap-1.5 rounded bg-amber-500/[0.06] border border-amber-500/10 text-amber-400"
              style={{
                padding: 'clamp(3px, 0.3vw, 5px) clamp(6px, 0.5vw, 8px)',
                marginBottom: 'clamp(4px, 0.4vw, 6px)',
                fontSize: 'clamp(0.625rem, 0.7vw, 0.75rem)',
              }}
            >
              <span aria-hidden="true">✨</span>
              <span>Words and phrases change on a daily basis.</span>
            </div>
          )}

          {/* Search input */}
          <div className="relative" style={{ marginBottom: 'clamp(6px, 0.6vw, 10px)' }}>
            {/* Search icon */}
            <svg
              className="absolute text-slate-300 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
              style={{
                width: 'clamp(11px, 0.85vw, 14px)',
                height: 'clamp(11px, 0.85vw, 14px)',
                left: 'clamp(6px, 0.6vw, 10px)',
                top: '50%',
                transform: 'translateY(-50%)',
              }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder={`Search ${category} phrases...`}
              spellCheck="false"
              aria-label={`Search ${category} vocabulary`}
              className="w-full rounded-md border border-slate-800/40 bg-slate-900/60 text-white placeholder:text-slate-400 outline-none focus:border-sky-500/40 focus:ring-1 focus:ring-sky-500/20 transition-colors"
              style={{
                fontSize: 'clamp(0.625rem, 0.7vw, 0.8rem)',
                padding: 'clamp(4px, 0.4vw, 7px) clamp(6px, 0.6vw, 10px)',
                paddingLeft: 'clamp(24px, 2vw, 32px)',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute text-slate-300 hover:text-white transition-colors"
                style={{
                  right: 'clamp(6px, 0.6vw, 10px)',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
                aria-label="Clear search"
              >
                <svg
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  style={{
                    width: 'clamp(10px, 0.8vw, 12px)',
                    height: 'clamp(10px, 0.8vw, 12px)',
                  }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Source tabs (only if multiple sources exist) */}
          {tabs.length > 0 && (
            <div
              className="flex flex-wrap"
              style={{
                gap: 'clamp(3px, 0.3vw, 5px)',
                marginBottom: 'clamp(6px, 0.6vw, 10px)',
              }}
              role="tablist"
              aria-label="Vocabulary source filter"
            >
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleTabClick(tab.key)}
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  className={`
                    inline-flex items-center rounded-md border transition-colors
                    ${
                      activeTab === tab.key
                        ? tab.key === 'scene'
                          ? 'border-cyan-600/30 bg-cyan-950/30 text-cyan-300'
                          : 'border-sky-600/30 bg-sky-950/30 text-sky-300'
                        : 'border-slate-800/20 bg-slate-900/20 text-slate-200 hover:text-white hover:border-slate-700/30'
                    }
                  `}
                  style={{
                    padding: 'clamp(2px, 0.2vw, 4px) clamp(6px, 0.5vw, 8px)',
                    fontSize: 'clamp(0.625rem, 0.7vw, 0.75rem)',
                    gap: 'clamp(2px, 0.2vw, 4px)',
                  }}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                  <span className="text-slate-300">({tab.count})</span>
                </button>
              ))}
            </div>
          )}

          {/* Chip cloud */}
          <div
            className="flex flex-wrap overflow-y-auto"
            style={{
              gap: 'clamp(3px, 0.3vw, 5px)',
              maxHeight: 'clamp(160px, 16vw, 240px)',
              paddingRight: 'clamp(2px, 0.2vw, 4px)',
            }}
          >
            {visibleChips.length === 0 ? (
              <p
                className="text-slate-300 italic"
                style={{ fontSize: 'clamp(0.625rem, 0.7vw, 0.75rem)' }}
              >
                {searchQuery ? 'No matches found' : 'All phrases selected'}
              </p>
            ) : (
              visibleChips.map((term) => (
                <ExploreChip
                  key={term}
                  term={term}
                  searchQuery={searchQuery}
                  disabled={!canSelectMore || isLocked}
                  platformTier={platformTier}
                  onClick={handleChipClick}
                  isSceneFlavour={
                    activeTab === 'scene' ||
                    (activeTab === 'all' && sceneFlavourSet.has(term.toLowerCase()))
                  }
                  cascadeScore={cascadeScores?.get(term.toLowerCase())}
                  expendability={
                    compressionLookup
                      ? lookupExpendability(compressionLookup, term, platformTier)
                      : 0
                  }
                />
              ))
            )}
          </div>

          {/* Show more + count indicator */}
          <div
            className="flex items-center justify-between"
            style={{ marginTop: 'clamp(6px, 0.6vw, 10px)' }}
          >
            {hasMore ? (
              <button
                type="button"
                onClick={handleShowMore}
                className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 hover:border-sky-400/50 hover:text-sky-200 transition-all duration-200 cursor-pointer"
                style={{
                  fontSize: 'clamp(0.625rem, 0.7vw, 0.75rem)',
                  padding: 'clamp(3px, 0.3vw, 5px) clamp(10px, 0.8vw, 14px)',
                }}
              >
                <svg
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                  style={{ width: 'clamp(10px, 0.8vw, 12px)', height: 'clamp(10px, 0.8vw, 12px)' }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Show {Math.min(CHIP_PAGE_SIZE, remaining)} more ({remaining.toLocaleString()} left)
              </button>
            ) : (
              <span />
            )}
            {searchQuery && totalFiltered > 0 && (
              <span
                className="text-slate-200"
                style={{ fontSize: 'clamp(0.625rem, 0.7vw, 0.75rem)' }}
              >
                {totalFiltered.toLocaleString()} match{totalFiltered !== 1 ? 'es' : ''}
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================================
// Step 4.3: Tier badge helper — all 4 tiers get contextual badges
// ============================================================================
// Word-count heuristic optimised per tier's preferred token density:
//   Tier 1 (CLIP):  ★ on 1–2 word terms (token-efficient for weighted prompts)
//   Tier 2 (MJ):    ◆ on 2–4 word terms (Midjourney keyword sweet-spot)
//   Tier 3 (NL):    💬 on 3+ word terms (natural language descriptive)
//   Tier 4 (Plain): ⚡ simple (1–2) / ⚠ complex (3+)
// ============================================================================

function getTierBadge(
  term: string,
  platformTier: 1 | 2 | 3 | 4,
): { badge: string; className: string; title: string } | null {
  const wordCount = term.split(/\s+/).length;

  switch (platformTier) {
    case 1: // CLIP — short terms are token-efficient
      if (wordCount <= 2)
        return {
          badge: '★',
          className: 'text-amber-400',
          title: 'Token-efficient for CLIP weighting',
        };
      return null;

    case 2: // MJ — 2–4 word keyword phrases work best
      if (wordCount >= 2 && wordCount <= 4)
        return {
          badge: '◆',
          className: 'text-violet-400',
          title: 'Keyword-optimised for Midjourney',
        };
      return null;

    case 3: // NL — descriptive 3+ word phrases shine
      if (wordCount >= 3)
        return {
          badge: '💬',
          className: 'text-emerald-400',
          title: 'Descriptive phrase — great for natural language',
        };
      return null;

    case 4: // Plain — simple vs complex heuristic
      if (wordCount < 3)
        return {
          badge: '⚡',
          className: 'text-sky-400',
          title: 'Simple term — safe for basic platforms',
        };
      return {
        badge: '⚠',
        className: 'text-amber-400',
        title: 'Complex phrase — may be truncated',
      };

    default:
      return null;
  }
}

// ============================================================================
// ExploreChip — individual clickable vocabulary chip (Step 4.3: all-tier badges)
// ============================================================================

interface ExploreChipProps {
  term: string;
  searchQuery: string;
  disabled: boolean;
  platformTier: 1 | 2 | 3 | 4;
  onClick: (term: string) => void;
  /** Step 4.1: Whether this chip is a scene flavour phrase */
  isSceneFlavour?: boolean;
  /** Step 4.4: Cascade relevance score (0–100) */
  cascadeScore?: number;
  /** Step 7.9d: Expendability score 0–1 (0 = valuable, 1 = safe to remove) */
  expendability?: number;
}

const ExploreChip = React.memo(function ExploreChip({
  term,
  searchQuery,
  disabled,
  platformTier,
  onClick,
  isSceneFlavour = false,
  cascadeScore,
  expendability = 0,
}: ExploreChipProps) {
  // Step 4.3: All-tier badge
  const tierBadge = getTierBadge(term, platformTier);

  // Step 7.9d: Expendability indicator — thin colored bottom border
  // Green-ish (not expendable) = invisible, amber (borderline), red (expendable)
  const expStyle: React.CSSProperties | undefined =
    expendability >= 0.55
      ? { borderBottomWidth: '2px', borderBottomStyle: 'solid', borderBottomColor: 'rgba(244,63,94,0.50)' }
      : expendability >= 0.40
        ? { borderBottomWidth: '2px', borderBottomStyle: 'solid', borderBottomColor: 'rgba(245,158,11,0.40)' }
        : undefined;

  const expLabel = expendability >= 0.55
    ? ' · expendable'
    : expendability >= 0.40
      ? ' · borderline'
      : '';

  return (
    <button
      type="button"
      onClick={() => onClick(term)}
      disabled={disabled}
      className={`
        inline-flex items-center rounded-full border transition-all duration-150 ease-out
        ${
          disabled
            ? 'border-slate-800/15 bg-slate-900/20 text-slate-500 cursor-not-allowed'
            : isSceneFlavour
              ? 'border-cyan-700/30 bg-cyan-950/20 text-cyan-400 hover:bg-cyan-900/30 hover:text-cyan-200 hover:border-cyan-600/40 active:scale-95 cursor-pointer'
              : 'border-slate-700/25 bg-slate-800/30 text-slate-200 hover:bg-slate-700/50 hover:text-white hover:border-slate-600/40 active:scale-95 cursor-pointer'
        }
      `}
      style={{
        padding: 'clamp(2px, 0.2vw, 3px) clamp(6px, 0.5vw, 8px)',
        fontSize: 'clamp(0.625rem, 0.7vw, 0.75rem)',
        gap: 'clamp(2px, 0.2vw, 3px)',
        ...expStyle,
      }}
      title={
        tierBadge
          ? `${term} — ${tierBadge.title}${cascadeScore ? ` (relevance: ${cascadeScore})` : ''}${expLabel}`
          : `${term}${expLabel}`
      }
      aria-label={`Add ${term} to selection`}
    >
      {/* Scene flavour indicator */}
      {isSceneFlavour && (
        <span style={{ fontSize: 'clamp(0.625rem, 0.7vw, 0.75rem)' }} aria-hidden="true">
          🎬
        </span>
      )}
      {/* Step 4.3: Tier badge */}
      {tierBadge && (
        <span
          className={tierBadge.className}
          style={{ fontSize: 'clamp(0.625rem, 0.7vw, 0.75rem)' }}
          aria-hidden="true"
        >
          {tierBadge.badge}
        </span>
      )}
      {/* Term text with optional search highlight */}
      {searchQuery ? <HighlightedText text={term} query={searchQuery} /> : <span>{term}</span>}
      {/* Plus icon */}
      {!disabled && (
        <svg
          className="opacity-60"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          style={{
            width: 'clamp(8px, 0.65vw, 10px)',
            height: 'clamp(8px, 0.65vw, 10px)',
          }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      )}
    </button>
  );
});

// ============================================================================
// HighlightedText — highlights substring match within chip
// ============================================================================

function HighlightedText({ text, query }: { text: string; query: string }) {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase().trim();

  if (!lowerQuery) return <span>{text}</span>;

  const idx = lowerText.indexOf(lowerQuery);
  if (idx === -1) return <span>{text}</span>;

  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + lowerQuery.length);
  const after = text.slice(idx + lowerQuery.length);

  return (
    <span>
      {before}
      <span className="ed-chip-highlight">{match}</span>
      {after}
    </span>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default ExploreDrawer;
