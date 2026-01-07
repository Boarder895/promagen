// src/components/prompts/explore/explore-filters.tsx
// ============================================================================
// EXPLORE FILTERS
// ============================================================================
// Filter controls for the Explore page.
// Authority: docs/authority/prompt-intelligence.md §9.2
// ============================================================================

'use client';

import React, { useCallback } from 'react';
import type { ExploreFilters as Filters } from '@/types/style-family';

// ============================================================================
// TYPES
// ============================================================================

export interface ExploreFiltersProps {
  filters: Filters;
  totalFamilies: number;
  filteredCount: number;
  onFiltersChange: (filters: Partial<Filters>) => void;
  onReset: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ExploreFilters({
  filters,
  totalFamilies,
  filteredCount,
  onFiltersChange,
  onReset,
}: ExploreFiltersProps) {
  // Check if any filters are active
  const hasActiveFilters =
    filters.mood !== 'all' || filters.searchQuery.length > 0;

  // Handlers
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFiltersChange({ searchQuery: e.target.value });
    },
    [onFiltersChange]
  );

  const handleMoodChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onFiltersChange({ mood: e.target.value as Filters['mood'] });
    },
    [onFiltersChange]
  );

  const handleSortChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const [sortBy, sortDirection] = e.target.value.split(':') as [
        Filters['sortBy'],
        Filters['sortDirection']
      ];
      onFiltersChange({ sortBy, sortDirection });
    },
    [onFiltersChange]
  );

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search families or terms..."
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

      {/* Filter Row */}
      <div className="flex flex-wrap gap-2">
        {/* Mood Filter */}
        <select
          value={filters.mood}
          onChange={handleMoodChange}
          className="px-3 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-white/70 focus:outline-none focus:ring-1 focus:ring-white/20 cursor-pointer"
        >
          <option value="all">All Moods</option>
          <option value="calm">Calm</option>
          <option value="intense">Intense</option>
          <option value="neutral">Neutral</option>
        </select>

        {/* Sort */}
        <select
          value={`${filters.sortBy}:${filters.sortDirection}`}
          onChange={handleSortChange}
          className="px-3 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-white/70 focus:outline-none focus:ring-1 focus:ring-white/20 cursor-pointer"
        >
          <option value="name:asc">Name (A-Z)</option>
          <option value="name:desc">Name (Z-A)</option>
          <option value="members:desc">Most Terms</option>
          <option value="members:asc">Fewest Terms</option>
          <option value="mood:asc">Mood (Calm first)</option>
          <option value="mood:desc">Mood (Intense first)</option>
        </select>

        {/* Reset Filters */}
        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="px-3 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all"
          >
            Clear Filters
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1" />
      </div>

      {/* Stats Summary */}
      <div className="flex items-center gap-4 text-xs text-white/40">
        <span>
          Showing <strong className="text-white/60">{filteredCount}</strong> of{' '}
          <strong className="text-white/60">{totalFamilies}</strong> families
        </span>
      </div>
    </div>
  );
}

export default ExploreFilters;
