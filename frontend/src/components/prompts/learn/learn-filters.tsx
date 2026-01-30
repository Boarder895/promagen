// src/components/prompts/learn/learn-filters.tsx
// ============================================================================
// LEARN FILTERS
// ============================================================================
// Filter controls for the Learn page.
// - AI Platform dropdown (Combobox, 42 platforms, 123rf last)
// - "Explore Styles" button (Core Colours gradient) → /studio/explore
// - "Build with [Platform]" button (conditional) → /providers/[id]
// - Green explainer text
// Authority: docs/authority/code-standard.md §6.1 Canonical Button Styling
// FIXED: Using anchor tags for reliable navigation
// FIXED: Replaced "Showing X of Y guides" with platform-learning guidance text
// ============================================================================

'use client';

import React, { useCallback, useMemo } from 'react';
import { Combobox } from '@/components/ui/combobox';
import type { LearnFilters as Filters } from '@/types/learn-content';

// ============================================================================
// TYPES
// ============================================================================

export interface LearnFiltersProps {
  filters: Filters;
  totalGuides: number;
  filteredCount: number;
  onFiltersChange: (filters: Partial<Filters>) => void;
  onReset: () => void;
  /** All available platforms for the dropdown */
  platforms: Array<{ id: string; name: string }>;
  /** Currently selected platform ID */
  selectedPlatformId: string | null;
  /** Callback when platform selection changes */
  onPlatformChange: (platformId: string | null) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function LearnFilters({
  filters,
  totalGuides: _totalGuides,
  filteredCount: _filteredCount,
  onFiltersChange,
  onReset,
  platforms,
  selectedPlatformId,
  onPlatformChange,
}: LearnFiltersProps) {
  // Note: _totalGuides and _filteredCount kept for API compatibility but not displayed
  void _totalGuides;
  void _filteredCount;
  // Check if any filters are active
  const hasActiveFilters = filters.searchQuery.length > 0 || selectedPlatformId !== null;

  // ============================================================================
  // Platform Dropdown Options
  // Sort alphabetically, but 123rf last
  // ============================================================================

  const platformOptions = useMemo(() => {
    const sorted = [...platforms].sort((a, b) => {
      // 123rf always last
      if (a.id === '123rf') return 1;
      if (b.id === '123rf') return -1;
      return a.name.localeCompare(b.name);
    });
    return sorted.map((p) => p.name);
  }, [platforms]);

  // Map name back to ID
  const platformNameToId = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of platforms) {
      map.set(p.name, p.id);
    }
    return map;
  }, [platforms]);

  // Map ID to name
  const platformIdToName = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of platforms) {
      map.set(p.id, p.name);
    }
    return map;
  }, [platforms]);

  // Selected platform name for the combobox
  const selectedPlatformName = selectedPlatformId
    ? (platformIdToName.get(selectedPlatformId) ?? null)
    : null;

  // Get display name for selected platform (with fallback)
  const selectedPlatformDisplayName = selectedPlatformId
    ? (platformIdToName.get(selectedPlatformId) ?? 'Platform')
    : null;

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFiltersChange({ searchQuery: e.target.value });
    },
    [onFiltersChange],
  );

  const handlePlatformSelect = useCallback(
    (selected: string[]) => {
      if (selected.length === 0) {
        onPlatformChange(null);
      } else {
        const platformName = selected[0];
        if (!platformName) {
          onPlatformChange(null);
          return;
        }
        const foundId = platformNameToId.get(platformName);
        onPlatformChange(foundId ?? null);
      }
    },
    [onPlatformChange, platformNameToId],
  );

  const handleResetAll = useCallback(() => {
    onReset();
    onPlatformChange(null);
  }, [onReset, onPlatformChange]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search guides..."
          value={filters.searchQuery}
          onChange={handleSearchChange}
          className="w-full px-4 py-2.5 pl-10 text-sm rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20 transition-all"
        />
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30"
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
      </div>

      {/* Platform Selector Row */}
      <div className="flex flex-wrap items-start gap-3">
        {/* Platform Combobox - Single Select */}
        <div className="flex-1 min-w-[200px] max-w-[280px]">
          <Combobox
            id="platform-selector"
            label=""
            options={platformOptions}
            selected={selectedPlatformName ? [selectedPlatformName] : []}
            customValue=""
            onSelectChange={handlePlatformSelect}
            onCustomChange={() => {}}
            placeholder="Select AI Platform..."
            maxSelections={1}
            allowFreeText={false}
            compact
            singleColumn
          />
        </div>

        {/* Buttons Container */}
        <div className="flex flex-col gap-2">
          {/* Explore Styles Button - Using anchor tag for reliable navigation */}
          <a
            href="/studio/explore"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-sky-400/50 bg-gradient-to-r from-sky-400/20 via-emerald-300/20 to-indigo-400/20 px-4 py-1.5 text-sm font-medium text-sky-100 shadow-sm transition-all hover:from-sky-400/30 hover:via-emerald-300/30 hover:to-indigo-400/30 hover:border-sky-300 focus-visible:outline-none focus-visible:ring focus-visible:ring-sky-400/80 cursor-pointer no-underline"
          >
            <svg
              className="w-4 h-4 text-sky-100"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
              />
            </svg>
            <span className="text-sky-100">Explore Styles</span>
          </a>

          {/* Build with Platform Button - Only when platform selected */}
          {selectedPlatformId && (
            <a
              href={`/providers/${selectedPlatformId}`}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-sky-400/50 bg-gradient-to-r from-sky-400/20 via-emerald-300/20 to-indigo-400/20 px-4 py-1.5 text-sm font-medium text-sky-100 shadow-sm transition-all hover:from-sky-400/30 hover:via-emerald-300/30 hover:to-indigo-400/30 hover:border-sky-300 focus-visible:outline-none focus-visible:ring focus-visible:ring-sky-400/80 cursor-pointer no-underline"
            >
              <svg
                className="w-4 h-4 text-sky-100"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                />
              </svg>
              <span className="text-sky-100">Build with {selectedPlatformDisplayName}</span>
              <svg
                className="w-3 h-3 text-sky-100"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
            </a>
          )}
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleResetAll}
            className="text-xs text-white/50 hover:text-white/80 transition-colors mt-2"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Guidance Text - Replaced "Showing X of Y guides" */}
      <div className="text-sm text-emerald-300/80">
        {selectedPlatformId ? (
          <>Learning tips optimised for {selectedPlatformDisplayName}</>
        ) : (
          <>Choose a specific platform to learn, or explore generic prompting</>
        )}
      </div>
    </div>
  );
}
