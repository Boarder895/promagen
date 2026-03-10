// src/types/saved-prompt.ts
// ============================================================================
// SAVED PROMPT TYPES (v1.1.0)
// ============================================================================
// Types for the prompt library system.
//
// UPDATED v1.1.0 (9 March 2026): Saved Prompts page redesign
// - Added `source` field: 'builder' (full structured data) vs 'tooltip' (text-only)
// - Added `folder` field: optional folder name (undefined = "Unsorted")
// - Added `tier` field: platform tier (1-4) at time of save
// - Added `folder` filter to LibraryFilters
// - Added `folderBreakdown` to LibraryStats
// - All existing fields and exports preserved
//
// Authority: docs/authority/saved-page.md §12
// Existing features preserved: Yes
// ============================================================================

import type { PromptSelections, PromptCategory } from './prompt-builder';

/**
 * A saved prompt stored in the library.
 */
export interface SavedPrompt {
  /** Unique identifier (UUID v4) */
  id: string;
  /** User-provided name for the prompt */
  name: string;
  /** Platform this prompt was built for */
  platformId: string;
  /** Platform display name */
  platformName: string;
  /** The assembled positive prompt text */
  positivePrompt: string;
  /** The assembled negative prompt text (if applicable) */
  negativePrompt?: string;
  /** Original selections from the builder */
  selections: PromptSelections;
  /** Custom text entries per category */
  customValues: Partial<Record<PromptCategory, string>>;
  /** Detected style families (from semantic tags) */
  families: string[];
  /** Primary mood of the prompt */
  mood: 'calm' | 'intense' | 'neutral';
  /** Coherence score (0-100) */
  coherenceScore: number;
  /** Character count */
  characterCount: number;
  /** ISO timestamp when saved */
  createdAt: string;
  /** ISO timestamp when last modified */
  updatedAt: string;
  /** Optional user notes */
  notes?: string;
  /** Tags for organization */
  tags?: string[];

  // ── New fields (v1.1.0) ──

  /** Save origin: 'builder' = full structured data, 'tooltip' = text-only */
  source: 'builder' | 'tooltip';
  /** Folder name. undefined = "Unsorted" */
  folder?: string;
  /** Platform tier (1-4) at time of save */
  tier?: number;
  /** Whether this prompt went through the optimisation pipeline */
  isOptimised?: boolean;
  /** The optimised prompt text (if different from positivePrompt) */
  optimisedPrompt?: string;
}

/**
 * Filter options for the library.
 */
export interface LibraryFilters {
  /** Filter by platform */
  platformId?: string;
  /** Filter by style family */
  family?: string;
  /** Filter by mood */
  mood?: 'calm' | 'intense' | 'neutral' | 'all';
  /** Minimum coherence score */
  minCoherence?: number;
  /** Search query (matches name, notes, prompt text) */
  searchQuery?: string;
  /** Sort field */
  sortBy: 'createdAt' | 'updatedAt' | 'name' | 'coherenceScore';
  /** Sort direction */
  sortDirection: 'asc' | 'desc';
  /** Filter by folder name. undefined = show all, 'unsorted' = no folder assigned */
  folder?: string;
}

/**
 * Default filter state.
 */
export const DEFAULT_LIBRARY_FILTERS: LibraryFilters = {
  mood: 'all',
  sortBy: 'updatedAt',
  sortDirection: 'desc',
};

/**
 * Library statistics.
 */
export interface LibraryStats {
  totalPrompts: number;
  averageCoherence: number;
  platformBreakdown: Record<string, number>;
  familyBreakdown: Record<string, number>;
  moodBreakdown: Record<'calm' | 'intense' | 'neutral', number>;
  /** Count of prompts per folder. Key '__unsorted__' = no folder assigned. */
  folderBreakdown: Record<string, number>;
}
