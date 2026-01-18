// src/components/prompts/library/library-client.tsx
// ============================================================================
// LIBRARY CLIENT
// ============================================================================
// Client component for the /studio/library page.
// Uses HomepageGrid layout with exchange rails.
// Authority: docs/authority/prompt-intelligence.md §9.2
// UPDATED: Back link now points to /studio (was /prompts).
// ============================================================================

'use client';

import React, { useMemo, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import HomepageGrid from '@/components/layout/homepage-grid';
import ExchangeList from '@/components/ribbon/exchange-list';
import { usePromagenAuth } from '@/hooks/use-promagen-auth';
import { useSavedPrompts } from '@/hooks/use-saved-prompts';
import { getRailsRelative } from '@/lib/location';
import { LibraryFilters } from './library-filters';
import { PromptLibraryGrid } from './prompt-library-grid';
import type { Exchange } from '@/data/exchanges/types';
import type { ExchangeWeather } from '@/lib/weather/exchange-weather';
import type { SavedPrompt } from '@/types/saved-prompt';

// ============================================================================
// TYPES
// ============================================================================

export interface LibraryClientProps {
  /** All exchanges to display (server provides these) */
  exchanges: ReadonlyArray<Exchange>;
  /** Weather data indexed by exchange ID */
  weatherIndex: Map<string, ExchangeWeather>;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function LibraryClient({
  exchanges,
  weatherIndex,
}: LibraryClientProps) {
  const router = useRouter();
  const {
    isAuthenticated,
    userTier,
    locationInfo,
    setReferenceFrame,
  } = usePromagenAuth();

  // Saved prompts hook
  const {
    filteredPrompts,
    filters,
    stats,
    isLoading,
    deletePrompt,
    setFilters,
    resetFilters,
    exportPrompts,
    importPrompts,
  } = useSavedPrompts();

  // Toast state for feedback
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // ============================================================================
  // EXCHANGE ORDERING
  // ============================================================================

  const { left, right } = useMemo(() => {
    return getRailsRelative(exchanges, locationInfo.coordinates);
  }, [exchanges, locationInfo.coordinates]);

  const allOrderedExchanges = useMemo(() => {
    return [...left, ...right.slice().reverse()];
  }, [left, right]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  // Load prompt into builder
  const handleLoad = useCallback(
    (prompt: SavedPrompt) => {
      // Store prompt data in sessionStorage for the builder to pick up
      sessionStorage.setItem('promagen_load_prompt', JSON.stringify(prompt));
      
      // Navigate to the platform's prompt builder
      router.push(`/providers/${prompt.platformId}/prompt-builder`);
    },
    [router]
  );

  // Delete prompt
  const handleDelete = useCallback(
    (id: string) => {
      const success = deletePrompt(id);
      if (success) {
        setToast({ message: 'Prompt deleted', type: 'success' });
        setTimeout(() => setToast(null), 2000);
      }
    },
    [deletePrompt]
  );

  // Export prompts
  const handleExport = useCallback(() => {
    const json = exportPrompts();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `promagen-prompts-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToast({ message: 'Prompts exported', type: 'success' });
    setTimeout(() => setToast(null), 2000);
  }, [exportPrompts]);

  // Import prompts
  const handleImport = useCallback(
    (json: string) => {
      const result = importPrompts(json);
      if (result.imported > 0) {
        setToast({
          message: `Imported ${result.imported} prompt${result.imported === 1 ? '' : 's'}`,
          type: 'success',
        });
      } else if (result.errors > 0) {
        setToast({ message: 'Failed to import prompts', type: 'error' });
      }
      setTimeout(() => setToast(null), 3000);
    },
    [importPrompts]
  );

  // ============================================================================
  // UI CONTENT
  // ============================================================================

  // Centre content: Library panel
  const centreContent = (
    <section
      aria-label="Prompt library"
      className="flex h-full min-h-0 flex-col rounded-3xl bg-slate-950/70 p-4 shadow-sm ring-1 ring-white/10"
      data-testid="library-panel"
    >
      {/* Header */}
      <header className="shrink-0 mb-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-white">Your Saved Prompts</h2>
          <a
            href="/studio"
            className="text-xs text-white/40 hover:text-white/60 transition-colors"
          >
            ← Back to Studio
          </a>
        </div>
        <p className="text-sm text-white/50">
          Save, organise, and reload your favourite prompts
        </p>
      </header>

      {/* Filters */}
      <div className="shrink-0 mb-4">
        <LibraryFilters
          filters={filters}
          stats={stats}
          onFiltersChange={setFilters}
          onReset={resetFilters}
          onExport={handleExport}
          onImport={handleImport}
        />
      </div>

      {/* Grid - scrollable */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30">
        <PromptLibraryGrid
          prompts={filteredPrompts}
          isLoading={isLoading}
          onLoad={handleLoad}
          onDelete={handleDelete}
        />
      </div>

      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl text-sm z-50 transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
              : 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30'
          }`}
        >
          {toast.message}
        </div>
      )}
    </section>
  );

  // Exchange lists
  const leftExchanges = (
    <ExchangeList
      exchanges={left}
      weatherByExchange={weatherIndex}
      emptyMessage="No eastern exchanges selected yet."
    />
  );

  const rightExchanges = (
    <ExchangeList
      exchanges={right}
      weatherByExchange={weatherIndex}
      emptyMessage="No western exchanges selected yet."
    />
  );

  // Location loading
  const effectiveLocationLoading = isAuthenticated && locationInfo.isLoading;

  return (
    <HomepageGrid
      mainLabel="Prompt Library"
      leftContent={leftExchanges}
      centre={centreContent}
      rightContent={rightExchanges}
      showFinanceRibbon
      exchanges={allOrderedExchanges}
      displayedProviderIds={[]}
      isPaidUser={userTier === 'paid'}
      isAuthenticated={isAuthenticated}
      referenceFrame={locationInfo.referenceFrame}
      onReferenceFrameChange={setReferenceFrame}
      isLocationLoading={effectiveLocationLoading}
      cityName={locationInfo.cityName}
    />
  );
}
