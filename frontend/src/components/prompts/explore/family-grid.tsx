// src/components/prompts/explore/family-grid.tsx
// ============================================================================
// FAMILY GRID
// ============================================================================
// Grid layout for displaying family cards.
// Authority: docs/authority/prompt-intelligence.md §9.2
// ============================================================================

'use client';

import React from 'react';
import type { StyleFamily } from '@/types/style-family';
import FamilyCard from './family-card';

// ============================================================================
// TYPES
// ============================================================================

export interface FamilyGridProps {
  families: StyleFamily[];
  isLoading: boolean;
  onSelect: (family: StyleFamily) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function FamilyGrid({
  families,
  isLoading,
  onSelect,
}: FamilyGridProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="h-48 rounded-2xl bg-slate-950/50 ring-1 ring-white/5 animate-pulse"
          />
        ))}
      </div>
    );
  }

  // Empty state
  if (families.length === 0) {
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
              d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-white/70 mb-2">
          No families found
        </h3>
        <p className="text-sm text-white/40 max-w-xs">
          Try adjusting your filters or search query.
        </p>
      </div>
    );
  }

  // Grid of cards
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {families.map((family) => (
        <FamilyCard
          key={family.id}
          family={family}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

export default FamilyGrid;
