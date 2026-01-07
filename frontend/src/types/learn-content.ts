// src/types/learn-content.ts
// ============================================================================
// LEARN CONTENT TYPES
// ============================================================================
// Types for the /prompts/learn education hub.
// Authority: docs/authority/prompt-intelligence.md §9.3
// ============================================================================

/**
 * A learning guide or article
 */
export interface LearnGuide {
  /** Unique ID */
  id: string;
  /** Display title */
  title: string;
  /** Short description */
  description: string;
  /** Category for grouping */
  category: 'fundamentals' | 'advanced' | 'platform-specific' | 'tips';
  /** Difficulty level */
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  /** Estimated read time in minutes */
  readTime: number;
  /** Content sections */
  sections: LearnSection[];
  /** Related guide IDs */
  related: string[];
  /** Tags for filtering */
  tags: string[];
}

/**
 * A section within a guide
 */
export interface LearnSection {
  /** Section title */
  title: string;
  /** Section content (markdown) */
  content: string;
  /** Optional example prompt */
  example?: {
    prompt: string;
    explanation: string;
  };
  /** Optional tips */
  tips?: string[];
}

/**
 * Quick tip card
 */
export interface QuickTip {
  id: string;
  title: string;
  content: string;
  category: string;
}

/**
 * Filter options for Learn page
 */
export interface LearnFilters {
  category: 'all' | 'fundamentals' | 'advanced' | 'platform-specific' | 'tips';
  difficulty: 'all' | 'beginner' | 'intermediate' | 'advanced';
  searchQuery: string;
}

/**
 * Default filters
 */
export const DEFAULT_LEARN_FILTERS: LearnFilters = {
  category: 'all',
  difficulty: 'all',
  searchQuery: '',
};
