// src/components/prompts/library/library-client.tsx
// ============================================================================
// LIBRARY CLIENT (v3.3.0 — Cloud Storage + Sync Banner)
// ============================================================================
// Client component for the /studio/library page.
// Three-rail layout: left (filters+folders) | centre (card grid) | right (preview).
//
// v3.3.0 (7 April 2026): Cloud storage UI wiring
//   - storageMode indicator (cloud/local icon) next to "● Saved Prompts"
//   - syncError toast (red banner) when cloud writes fail
//   - proSyncBanner passed to left rail for Pro conversion trigger
//
// v3.0.0 (9 March 2026): Full redesign per saved-page.md.
//   - Exchange rails REMOVED — replaced by library-specific left/right rails
//   - Left rail: search, smart groups (platform/mood/sort), folders, import/export
//   - Centre: compact card grid with selection state, arrival glow
//   - Right rail: preview panel (overview stats or selected prompt detail)
//   - All exchange/weather/index hooks removed (no longer needed on this page)
//   - page.tsx simplified (only provides providers)
//
// Authority: saved-page.md §2.2, §3
// Non-regression: HomepageGrid not modified (only props passed)
// Existing features preserved: Yes (export name unchanged)
// ============================================================================

'use client';

import React, { useMemo, useCallback, useState } from 'react';
import HomepageGrid from '@/components/layout/homepage-grid';
import { usePromagenAuth } from '@/hooks/use-promagen-auth';
import { useSavedPrompts } from '@/hooks/use-saved-prompts';
import { LibraryLeftRail } from './library-left-rail';
import { LibraryRightRail } from './library-right-rail';
import { PromptLibraryGrid } from './prompt-library-grid';
import type { SavedPrompt } from '@/types/saved-prompt';
import type { Provider } from '@/types/providers';

// ============================================================================
// TYPES
// ============================================================================

export interface LibraryClientProps {
  /** All AI providers for Engine Bay */
  providers: Provider[];
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function LibraryClient({ providers }: LibraryClientProps) {
  const { isAuthenticated, userTier, locationInfo, setReferenceFrame } = usePromagenAuth();

  // ── Saved prompts hook (all data + operations) ──
  const {
    allPrompts,
    filteredPrompts,
    filters,
    stats,
    isLoading,
    updatePrompt,
    deletePrompt,
    savePrompt,
    setFilters,
    folders,
    createFolder,
    renameFolder,
    deleteFolder,
    moveToFolder,
    storageMode,
    syncError,
    proSyncBanner,
  } = useSavedPrompts();

  // ── Selection state ──
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);

  const selectedPrompt = useMemo(() => {
    if (!selectedPromptId) return null;
    return allPrompts.find((p) => p.id === selectedPromptId) ?? null;
  }, [allPrompts, selectedPromptId]);

  // ── Provider IDs for Engine Bay ──
  const providerIds = useMemo(() => providers.map((p) => p.id), [providers]);

  // ============================================================================
  // CALLBACKS
  // ============================================================================

  // Card selected
  const handleSelect = useCallback((prompt: SavedPrompt) => {
    setSelectedPromptId((prev) => (prev === prompt.id ? null : prompt.id));
  }, []);

  // Load prompt into builder
  // Uses window.location.href (not router.push) because the React render loop
  // from the auth context blocks Next.js router state updates.
  const handleLoad = useCallback(
    (prompt: SavedPrompt) => {
      console.debug('[Library] Load clicked:', prompt.name, prompt.platformId, prompt.source);

      try {
        const payload = {
          ...prompt,
          _rawPositivePrompt: prompt.positivePrompt,
          _rawNegativePrompt: prompt.negativePrompt,
        };
        sessionStorage.setItem('promagen_load_prompt', JSON.stringify(payload));
        console.debug('[Library] Wrote to sessionStorage, navigating to /providers/' + prompt.platformId);

        // Hard navigation — bypasses React router which is blocked by the infinite loop
        window.location.href = `/providers/${prompt.platformId}`;
      } catch (err) {
        console.error('[Library] Load failed:', err);
      }
    },
    [],
  );

  // Copy prompt text to clipboard
  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard may not be available
    }
  }, []);

  // Delete prompt (deselect if it was selected)
  const handleDelete = useCallback(
    (id: string) => {
      deletePrompt(id);
      if (selectedPromptId === id) {
        setSelectedPromptId(null);
      }
    },
    [deletePrompt, selectedPromptId],
  );

  // Save reformatted prompt as new entry
  const handleSaveAsNew = useCallback(
    (data: {
      positivePrompt: string;
      negativePrompt?: string;
      platformId: string;
      platformName: string;
      selections: SavedPrompt['selections'];
      customValues: SavedPrompt['customValues'];
      families: string[];
      mood: SavedPrompt['mood'];
      coherenceScore: number;
      source: 'builder';
      tier: number;
    }) => {
      const subject = data.positivePrompt.slice(0, 30).trim() || 'Untitled';
      savePrompt({
        name: `${subject} — ${data.platformName}`,
        platformId: data.platformId,
        platformName: data.platformName,
        positivePrompt: data.positivePrompt,
        negativePrompt: data.negativePrompt,
        selections: data.selections,
        customValues: data.customValues,
        families: data.families,
        mood: data.mood,
        coherenceScore: data.coherenceScore,
        characterCount: data.positivePrompt.length,
        source: data.source,
        tier: data.tier,
      });
    },
    [savePrompt],
  );

  // ============================================================================
  // RAIL CONTENT
  // ============================================================================

  // Left rail: filters + folders
  const leftRail = (
    <LibraryLeftRail
      filters={filters}
      stats={stats}
      allPrompts={allPrompts}
      folders={folders}
      onFiltersChange={setFilters}
      onCreateFolder={createFolder}
      onRenameFolder={renameFolder}
      onDeleteFolder={deleteFolder}
      proSyncBanner={proSyncBanner}
      storageMode={storageMode}
    />
  );

  // Centre: header + card grid
  const platformCount = Object.keys(stats.platformBreakdown).length;

  const centreContent = (
    <section
      aria-label="My Prompts"
      className="flex h-full min-h-0 flex-col"
      data-testid="library-panel"
    >
      {/* ── Build Your Prompt CTA — between page heading and ● Saved Prompts ── */}
      <a
        href="/"
        className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-400/60 bg-gradient-to-r from-sky-400/40 via-emerald-300/40 to-indigo-400/40 font-semibold text-white shadow-sm no-underline cursor-pointer transition-all hover:from-sky-400/50 hover:via-emerald-300/50 hover:to-indigo-400/50 hover:border-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/80"
        style={{
          padding: 'clamp(12px, 1.2vw, 18px) clamp(16px, 2vw, 28px)',
          fontSize: 'clamp(0.85rem, 1vw, 1.1rem)',
          marginBottom: 'clamp(8px, 0.7vw, 12px)',
        }}
      >
        <span>✦</span>
        <span>Build Your Prompt</span>
        <svg
          className="shrink-0 transition-transform group-hover:translate-x-1"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          style={{ width: 'clamp(16px, 1.2vw, 20px)', height: 'clamp(16px, 1.2vw, 20px)' }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      </a>

      {/* Header */}
      <header className="shrink-0" style={{ marginBottom: 'clamp(8px, 0.7vw, 12px)', textAlign: 'center' }}>
        <h2
          className="bg-gradient-to-r from-sky-400 via-emerald-300 to-indigo-400 bg-clip-text text-transparent font-semibold"
          style={{ fontSize: 'clamp(0.65rem, 0.9vw, 1.2rem)', marginBottom: 'clamp(2px, 0.2vw, 4px)' }}
        >
          ● Saved Prompts
          {/* Storage mode indicator — cloud (Pro) or local (free) */}
          {storageMode === 'cloud' && (
            <span
              title="Synced to cloud — your prompts are safe across all devices"
              className="inline-flex items-center align-middle text-emerald-400"
              style={{ marginLeft: 'clamp(6px, 0.5vw, 10px)', fontSize: 'clamp(0.55rem, 0.7vw, 0.85rem)' }}
            >
              <svg
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                style={{ width: 'clamp(12px, 1vw, 16px)', height: 'clamp(12px, 1vw, 16px)', marginRight: 'clamp(2px, 0.2vw, 4px)' }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
              </svg>
              Cloud
            </span>
          )}
          {storageMode === 'local' && (
            <span
              title="Stored in this browser only"
              className="inline-flex items-center align-middle text-amber-400"
              style={{ marginLeft: 'clamp(6px, 0.5vw, 10px)', fontSize: 'clamp(0.55rem, 0.7vw, 0.85rem)' }}
            >
              <svg
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                style={{ width: 'clamp(12px, 1vw, 16px)', height: 'clamp(12px, 1vw, 16px)', marginRight: 'clamp(2px, 0.2vw, 4px)' }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Local
            </span>
          )}
        </h2>
        {stats.totalPrompts > 0 && (
          <p
            className="text-white/80"
            style={{ fontSize: 'clamp(0.625rem, 0.7vw, 0.85rem)' }}
          >
            {stats.totalPrompts} prompt{stats.totalPrompts !== 1 ? 's' : ''}
            {' · '}
            {platformCount} platform{platformCount !== 1 ? 's' : ''}
            {folders.length > 0 && (
              <>
                {' · '}
                {folders.length} folder{folders.length !== 1 ? 's' : ''}
              </>
            )}
            {' · '}
            {stats.averageCoherence}% avg score
          </p>
        )}
      </header>

      {/* Active filter banner — confirms which folder/platform is active */}
      {(filters.folder || filters.platformId) && (
        <div
          className="shrink-0 flex items-center justify-center flex-wrap"
          style={{
            gap: 'clamp(6px, 0.5vw, 8px)',
            marginBottom: 'clamp(6px, 0.5vw, 10px)',
          }}
        >
          {filters.folder && (
            <span
              className="inline-flex items-center rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"
              style={{
                padding: 'clamp(2px, 0.2vw, 4px) clamp(8px, 0.6vw, 12px)',
                fontSize: 'clamp(0.625rem, 0.7vw, 0.85rem)',
                gap: 'clamp(4px, 0.3vw, 6px)',
              }}
            >
              📂 {filters.folder === '__unsorted__' ? 'Unsorted' : filters.folder}
              {' · '}
              {filteredPrompts.length} prompt{filteredPrompts.length !== 1 ? 's' : ''}
              <button
                type="button"
                onClick={() => setFilters({ folder: undefined })}
                className="cursor-pointer text-cyan-400/70 hover:text-cyan-300 transition-colors"
                style={{ fontSize: 'clamp(0.75rem, 0.8vw, 1rem)' }}
                title="Clear folder filter"
                aria-label="Clear folder filter"
              >
                ×
              </button>
            </span>
          )}
          {filters.platformId && (
            <span
              className="inline-flex items-center rounded-lg bg-violet-500/10 text-violet-300 border border-violet-500/20"
              style={{
                padding: 'clamp(2px, 0.2vw, 4px) clamp(8px, 0.6vw, 12px)',
                fontSize: 'clamp(0.625rem, 0.7vw, 0.85rem)',
                gap: 'clamp(4px, 0.3vw, 6px)',
              }}
            >
              {allPrompts.find((p) => p.platformId === filters.platformId)?.platformName ?? filters.platformId}
              <button
                type="button"
                onClick={() => setFilters({ platformId: undefined })}
                className="cursor-pointer text-violet-400/70 hover:text-violet-300 transition-colors"
                style={{ fontSize: 'clamp(0.75rem, 0.8vw, 1rem)' }}
                title="Clear platform filter"
                aria-label="Clear platform filter"
              >
                ×
              </button>
            </span>
          )}
        </div>
      )}

      {/* Grid — scrollable */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30">
        <PromptLibraryGrid
          prompts={filteredPrompts}
          isLoading={isLoading}
          selectedPromptId={selectedPromptId}
          onSelect={handleSelect}
        />
      </div>

      {/* ── Sync error toast (cloud mode) ── */}
      {syncError && (
        <div
          className="shrink-0 flex items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10"
          style={{
            padding: 'clamp(6px, 0.5vw, 10px) clamp(10px, 0.8vw, 16px)',
            marginTop: 'clamp(6px, 0.5vw, 10px)',
            gap: 'clamp(6px, 0.5vw, 10px)',
          }}
        >
          <svg
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            className="shrink-0 text-red-400"
            style={{ width: 'clamp(14px, 1.1vw, 18px)', height: 'clamp(14px, 1.1vw, 18px)' }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span
            className="text-red-300"
            style={{ fontSize: 'clamp(0.5625rem, 0.7vw, 0.85rem)' }}
          >
            {syncError}
          </span>
        </div>
      )}
    </section>
  );

  // Right rail: preview panel
  const rightRail = (
    <LibraryRightRail
      selectedPrompt={selectedPrompt}
      stats={stats}
      allPrompts={allPrompts}
      folders={folders}
      onCopy={handleCopy}
      onLoad={handleLoad}
      onUpdate={updatePrompt}
      onMoveToFolder={moveToFolder}
      onDelete={handleDelete}
      onDeselect={() => setSelectedPromptId(null)}
      onReformat={() => {/* reformat mode toggled inside right rail */}}
      onSaveAsNew={handleSaveAsNew}
    />
  );

  // Location loading
  const effectiveLocationLoading = isAuthenticated && locationInfo.isLoading;

  return (
    <HomepageGrid
        mainLabel="My Prompts"
        headingText="Promagen — Your Saved Prompts"
        leftContent={leftRail}
        centre={centreContent}
        rightContent={rightRail}
        showFinanceRibbon={false}
        displayedProviderIds={providerIds}
        isPaidUser={userTier === 'paid'}
        isAuthenticated={isAuthenticated}
        referenceFrame={locationInfo.referenceFrame}
        onReferenceFrameChange={setReferenceFrame}
        isLocationLoading={effectiveLocationLoading}
        cityName={locationInfo.cityName}
        countryCode={locationInfo.countryCode}
        providers={providers}
        showEngineBay
        showMissionControl
        hideCommodities
        isStudioSubPage
        isMyPromptsPage
        leftRailClassName="flex min-h-0 flex-1 flex-col rounded-3xl bg-slate-950/70 p-4 shadow-sm border-2 border-emerald-500/30"
        rightRailClassName="flex min-h-0 flex-1 flex-col rounded-3xl bg-slate-950/70 p-4 shadow-sm border-2 border-violet-500/30"
      />
  );
}
