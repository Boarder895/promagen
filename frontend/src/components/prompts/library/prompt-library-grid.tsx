// src/components/prompts/library/prompt-library-grid.tsx
// ============================================================================
// PROMPT LIBRARY GRID (v2.0.0 — Redesigned for new card API)
// ============================================================================
// Grid layout for displaying saved prompt cards in the library centre column.
//
// v2.0.0: Updated to match new SavedPromptCard props (isSelected, isNew,
// onSelect). Responsive 1→2→3 columns per spec §5.2. Empty state with
// bookmark icon and builder link per spec §5.4. All clamp() sizing.
//
// Authority: saved-page.md §5.2, §5.4
// Existing features preserved: Yes (export names unchanged)
// ============================================================================

'use client';

import React from 'react';
import type { SavedPrompt } from '@/types/saved-prompt';
import SavedPromptCard from './saved-prompt-card';

// ============================================================================
// TYPES
// ============================================================================

export interface PromptLibraryGridProps {
  prompts: SavedPrompt[];
  isLoading: boolean;
  /** Currently selected prompt ID */
  selectedPromptId: string | null;
  /** Called when a card is clicked */
  onSelect: (prompt: SavedPrompt) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Prompts saved in the last 60 seconds show arrival glow */
const NEW_THRESHOLD_MS = 60_000;

// ============================================================================
// COMPONENT
// ============================================================================

export function PromptLibraryGrid({
  prompts,
  isLoading,
  selectedPromptId,
  onSelect,
}: PromptLibraryGridProps) {
  // Loading skeleton
  if (isLoading) {
    return (
      <div
        className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3"
        style={{ gap: 'clamp(8px, 0.7vw, 12px)' }}
      >
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-slate-950/50 ring-1 ring-white/5 animate-pulse"
            style={{ height: 'clamp(100px, 10vw, 140px)' }}
          />
        ))}
      </div>
    );
  }

  // Empty state (spec §5.4)
  if (prompts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center" style={{ paddingTop: 'clamp(40px, 5vw, 80px)', paddingBottom: 'clamp(40px, 5vw, 80px)' }}>
        {/* Bookmark icon */}
        <div
          className="flex items-center justify-center rounded-2xl bg-white/5"
          style={{
            width: 'clamp(40px, 3.5vw, 48px)',
            height: 'clamp(40px, 3.5vw, 48px)',
            marginBottom: 'clamp(10px, 1vw, 16px)',
          }}
        >
          <svg
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            className="text-white/60"
            style={{
              width: 'clamp(20px, 2vw, 28px)',
              height: 'clamp(20px, 2vw, 28px)',
            }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </div>

        <h3
          className="text-white/70 font-semibold"
          style={{
            fontSize: 'clamp(0.7rem, 0.9vw, 1.1rem)',
            marginBottom: 'clamp(4px, 0.4vw, 6px)',
          }}
        >
          No saved prompts yet
        </h3>
        <p
          className="text-white/70"
          style={{
            fontSize: 'clamp(0.55rem, 0.65vw, 0.8rem)',
            maxWidth: 'clamp(200px, 20vw, 280px)',
            marginBottom: 'clamp(12px, 1.2vw, 20px)',
          }}
        >
          Save prompts from anywhere in Promagen using the 💾 icon.
        </p>
        <a
          href="/providers/flux"
          className="inline-flex items-center rounded-xl bg-gradient-to-r from-emerald-500/10 to-sky-500/10 text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/40 transition-all"
          style={{
            padding: 'clamp(5px, 0.5vw, 8px) clamp(12px, 1vw, 18px)',
            fontSize: 'clamp(0.55rem, 0.65vw, 0.8rem)',
            gap: 'clamp(4px, 0.3vw, 6px)',
          }}
        >
          Open Prompt Builder
          <span aria-hidden="true">→</span>
        </a>
      </div>
    );
  }

  // Grid of cards (spec §5.2: 1→2→3 columns)
  const now = Date.now();

  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3"
      style={{ gap: 'clamp(8px, 0.7vw, 12px)' }}
    >
      {prompts.map((prompt) => (
        <SavedPromptCard
          key={prompt.id}
          prompt={prompt}
          isSelected={prompt.id === selectedPromptId}
          isNew={now - new Date(prompt.createdAt).getTime() < NEW_THRESHOLD_MS}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

export default PromptLibraryGrid;
