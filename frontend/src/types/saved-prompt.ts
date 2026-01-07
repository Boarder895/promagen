// src/types/saved-prompt.ts
// ============================================================================
// SAVED PROMPT TYPES
// ============================================================================
// Types for the prompt library system.
// Authority: docs/authority/prompt-intelligence.md §9.2
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
}
