// src/types/style-family.ts
// ============================================================================
// STYLE FAMILY TYPES
// ============================================================================
// Types for the style family system used in Explore page.
// Authority: docs/authority/prompt-intelligence.md §4
// ============================================================================

/**
 * A style family definition from families.json
 */
export interface StyleFamily {
  /** Internal ID (key in JSON) */
  id: string;
  /** Human-readable name */
  displayName: string;
  /** Brief description of the aesthetic */
  description: string;
  /** Terms that belong to this family */
  members: string[];
  /** Related family IDs for discovery */
  related: string[];
  /** Opposing family IDs (conflict indicators) */
  opposes: string[];
  /** Overall mood: calm, intense, or neutral */
  mood: 'calm' | 'intense' | 'neutral';
  /** Suggested colour terms */
  suggestedColours: string[];
  /** Suggested lighting terms */
  suggestedLighting: string[];
  /** Suggested atmosphere terms */
  suggestedAtmosphere: string[];
}

/**
 * Raw JSON structure from families.json
 */
export interface FamiliesJson {
  version: string;
  updated: string;
  families: Record<string, Omit<StyleFamily, 'id'>>;
}

/**
 * Filter options for the Explore page
 */
export interface ExploreFilters {
  /** Filter by mood */
  mood: 'all' | 'calm' | 'intense' | 'neutral';
  /** Search query */
  searchQuery: string;
  /** Sort field */
  sortBy: 'name' | 'members' | 'mood';
  /** Sort direction */
  sortDirection: 'asc' | 'desc';
}

/**
 * Default filter state
 */
export const DEFAULT_EXPLORE_FILTERS: ExploreFilters = {
  mood: 'all',
  searchQuery: '',
  sortBy: 'name',
  sortDirection: 'asc',
};
