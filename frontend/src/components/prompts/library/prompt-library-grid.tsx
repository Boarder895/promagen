// src/components/prompts/library/prompt-library-grid.tsx
// ============================================================================
// PROMPT LIBRARY GRID
// ============================================================================
// Grid layout for displaying saved prompt cards.
// Authority: docs/authority/prompt-intelligence.md §9.2
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
  onLoad: (prompt: SavedPrompt) => void;
  onDelete: (id: string) => void;
  onEdit?: (prompt: SavedPrompt) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function PromptLibraryGrid({
  prompts,
  isLoading,
  onLoad,
  onDelete,
  onEdit,
}: PromptLibraryGridProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-48 rounded-2xl bg-slate-950/50 ring-1 ring-white/5 animate-pulse"
          />
        ))}
      </div>
    );
  }

  // Empty state
  if (prompts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-white/20"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-white/70 mb-2">
          No saved prompts yet
        </h3>
        <p className="text-sm text-white/40 max-w-xs">
          Create prompts in the Prompt Builder and save them here for quick access.
        </p>
        <a
          href="/providers"
          className="mt-6 px-4 py-2 text-sm rounded-xl bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-all ring-1 ring-white/10"
        >
          Go to Prompt Builder →
        </a>
      </div>
    );
  }

  // Grid of cards
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {prompts.map((prompt) => (
        <SavedPromptCard
          key={prompt.id}
          prompt={prompt}
          onLoad={onLoad}
          onDelete={onDelete}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}

export default PromptLibraryGrid;
