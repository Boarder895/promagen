// src/types/learn-content.ts
// ============================================================================
// LEARN CONTENT TYPES
// ============================================================================
// Types for the /studio/learn education hub.
// Updated to support platform tier system and simplified filters.
// ============================================================================

import type { PromptCategory } from '@/types/prompt-builder';

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
  /** Maps to Prompt Builder category (null for overview guides) */
  promptBuilderCategory?: PromptCategory | null;
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
 * Simplified: only search query, platform filter handled separately
 */
export interface LearnFilters {
  /** Text search query */
  searchQuery: string;
  /** Category filter (kept for backward compat, not shown in UI) */
  category: 'all' | 'fundamentals' | 'advanced' | 'platform-specific' | 'tips';
  /** Difficulty filter (kept for backward compat, not shown in UI) */
  difficulty: 'all' | 'beginner' | 'intermediate' | 'advanced';
}

/**
 * Default filters
 */
export const DEFAULT_LEARN_FILTERS: LearnFilters = {
  searchQuery: '',
  category: 'all',
  difficulty: 'all',
};
