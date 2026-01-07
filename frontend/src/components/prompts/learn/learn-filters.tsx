// src/components/prompts/learn/learn-filters.tsx
// ============================================================================
// LEARN FILTERS
// ============================================================================
// Filter controls for the Learn page.
// Authority: docs/authority/prompt-intelligence.md §9.3
// ============================================================================

'use client';

import React, { useCallback } from 'react';
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
}

// ============================================================================
// COMPONENT
// ============================================================================

export function LearnFilters({
  filters,
  totalGuides,
  filteredCount,
  onFiltersChange,
  onReset,
}: LearnFiltersProps) {
  // Check if any filters are active
  const hasActiveFilters =
    filters.category !== 'all' ||
    filters.difficulty !== 'all' ||
    filters.searchQuery.length > 0;

  // Handlers
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFiltersChange({ searchQuery: e.target.value });
    },
    [onFiltersChange]
  );

  const handleCategoryChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onFiltersChange({ category: e.target.value as Filters['category'] });
    },
    [onFiltersChange]
  );

  const handleDifficultyChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onFiltersChange({ difficulty: e.target.value as Filters['difficulty'] });
    },
    [onFiltersChange]
  );

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

      {/* Filter Row */}
      <div className="flex flex-wrap gap-2">
        {/* Category Filter */}
        <select
          value={filters.category}
          onChange={handleCategoryChange}
          className="px-3 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-white/70 focus:outline-none focus:ring-1 focus:ring-white/20 cursor-pointer"
        >
          <option value="all">All Categories</option>
          <option value="fundamentals">Fundamentals</option>
          <option value="advanced">Advanced</option>
          <option value="platform-specific">Platform-Specific</option>
          <option value="tips">Tips</option>
        </select>

        {/* Difficulty Filter */}
        <select
          value={filters.difficulty}
          onChange={handleDifficultyChange}
          className="px-3 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-white/70 focus:outline-none focus:ring-1 focus:ring-white/20 cursor-pointer"
        >
          <option value="all">All Levels</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
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
          <strong className="text-white/60">{totalGuides}</strong> guides
        </span>
      </div>
    </div>
  );
}

export default LearnFilters;
