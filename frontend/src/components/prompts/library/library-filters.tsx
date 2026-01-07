// src/components/prompts/library/library-filters.tsx
// ============================================================================
// LIBRARY FILTERS
// ============================================================================
// Filter controls for the prompt library.
// Authority: docs/authority/prompt-intelligence.md §9.2
// ============================================================================

'use client';

import React, { useCallback, useMemo } from 'react';
import type { LibraryFilters as Filters, LibraryStats } from '@/types/saved-prompt';

// ============================================================================
// TYPES
// ============================================================================

export interface LibraryFiltersProps {
  filters: Filters;
  stats: LibraryStats;
  onFiltersChange: (filters: Partial<Filters>) => void;
  onReset: () => void;
  onExport: () => void;
  onImport: (json: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function LibraryFilters({
  filters,
  stats,
  onFiltersChange,
  onReset,
  onExport,
  onImport,
}: LibraryFiltersProps) {
  // Get unique platforms from stats
  const platforms = useMemo(() => {
    return Object.keys(stats.platformBreakdown).sort();
  }, [stats.platformBreakdown]);

  // Get unique families from stats
  const families = useMemo(() => {
    return Object.keys(stats.familyBreakdown).sort();
  }, [stats.familyBreakdown]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return !!(
      filters.platformId ||
      filters.family ||
      (filters.mood && filters.mood !== 'all') ||
      filters.searchQuery ||
      filters.minCoherence
    );
  }, [filters]);

  // Handlers
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFiltersChange({ searchQuery: e.target.value || undefined });
    },
    [onFiltersChange]
  );

  const handlePlatformChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onFiltersChange({ platformId: e.target.value || undefined });
    },
    [onFiltersChange]
  );

  const handleFamilyChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onFiltersChange({ family: e.target.value || undefined });
    },
    [onFiltersChange]
  );

  const handleMoodChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value as Filters['mood'];
      onFiltersChange({ mood: value || 'all' });
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

  const handleImportClick = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        onImport(text);
      } catch (error) {
        console.error('[LibraryFilters] Failed to read file:', error);
      }
    };
    input.click();
  }, [onImport]);

  const handleExportClick = useCallback(() => {
    onExport();
  }, [onExport]);

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search prompts..."
          value={filters.searchQuery || ''}
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
        {/* Platform Filter */}
        <select
          value={filters.platformId || ''}
          onChange={handlePlatformChange}
          className="px-3 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-white/70 focus:outline-none focus:ring-1 focus:ring-white/20 cursor-pointer"
        >
          <option value="">All Platforms</option>
          {platforms.map((platform) => (
            <option key={platform} value={platform}>
              {platform} ({stats.platformBreakdown[platform]})
            </option>
          ))}
        </select>

        {/* Family Filter */}
        <select
          value={filters.family || ''}
          onChange={handleFamilyChange}
          className="px-3 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-white/70 focus:outline-none focus:ring-1 focus:ring-white/20 cursor-pointer"
        >
          <option value="">All Families</option>
          {families.map((family) => (
            <option key={family} value={family}>
              {family} ({stats.familyBreakdown[family]})
            </option>
          ))}
        </select>

        {/* Mood Filter */}
        <select
          value={filters.mood || 'all'}
          onChange={handleMoodChange}
          className="px-3 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-white/70 focus:outline-none focus:ring-1 focus:ring-white/20 cursor-pointer"
        >
          <option value="all">All Moods</option>
          <option value="calm">Calm ({stats.moodBreakdown.calm})</option>
          <option value="intense">Intense ({stats.moodBreakdown.intense})</option>
          <option value="neutral">Neutral ({stats.moodBreakdown.neutral})</option>
        </select>

        {/* Sort */}
        <select
          value={`${filters.sortBy}:${filters.sortDirection}`}
          onChange={handleSortChange}
          className="px-3 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-white/70 focus:outline-none focus:ring-1 focus:ring-white/20 cursor-pointer"
        >
          <option value="updatedAt:desc">Recently Updated</option>
          <option value="createdAt:desc">Recently Created</option>
          <option value="name:asc">Name (A-Z)</option>
          <option value="name:desc">Name (Z-A)</option>
          <option value="coherenceScore:desc">Highest Coherence</option>
          <option value="coherenceScore:asc">Lowest Coherence</option>
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

        {/* Import/Export */}
        <button
          onClick={handleImportClick}
          className="px-3 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Import
        </button>
        <button
          onClick={handleExportClick}
          className="px-3 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export
        </button>
      </div>

      {/* Stats Summary */}
      <div className="flex items-center gap-4 text-xs text-white/40">
        <span>
          <strong className="text-white/60">{stats.totalPrompts}</strong> prompts
        </span>
        {stats.totalPrompts > 0 && (
          <>
            <span className="text-white/20">•</span>
            <span>
              <strong className="text-white/60">{stats.averageCoherence}%</strong> avg coherence
            </span>
            <span className="text-white/20">•</span>
            <span>
              <strong className="text-white/60">{Object.keys(stats.platformBreakdown).length}</strong> platforms
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export default LibraryFilters;
