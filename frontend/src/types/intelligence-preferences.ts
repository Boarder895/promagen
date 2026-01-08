// src/types/intelligence-preferences.ts
// ============================================================================
// INTELLIGENCE PREFERENCES TYPES
// ============================================================================
// Type definitions for Prompt Intelligence user preferences.
// Authority: docs/authority/prompt-intelligence.md §10
// ============================================================================

/**
 * User preferences for Prompt Intelligence features.
 * Stored in localStorage, persists across sessions.
 */
export interface IntelligencePreferences {
  // ============================================
  // Feature Toggles
  // ============================================
  
  /** Enable live reordering of dropdown options by relevance */
  liveReorderEnabled: boolean;
  
  /** Enable smart trim (by relevance) vs dumb trim (by position) */
  smartTrimEnabled: boolean;
  
  /** Show conflict warnings when incompatible terms selected */
  conflictWarningsEnabled: boolean;
  
  /** Show context-aware suggestions */
  suggestionsEnabled: boolean;
  
  /** Enable market mood influence on suggestions */
  marketMoodEnabled: boolean;
  
  // ============================================
  // Display Preferences
  // ============================================
  
  /** Show the DNA bar (category fill indicator) */
  showDNABar: boolean;
  
  /** Show coherence percentage score */
  showCoherenceScore: boolean;
  
  /** Use compact suggestion chips */
  compactSuggestions: boolean;
  
  /** Show educational "Why this?" tooltips */
  showWhyThisTooltips: boolean;
  
  // ============================================
  // Scoring Preferences
  // ============================================
  
  /** Preferred style family (bias scoring toward this) */
  preferFamily: string | null;
  
  /** Families to avoid in suggestions */
  avoidFamilies: string[];
}

/**
 * Default preferences for new users.
 */
export const DEFAULT_INTELLIGENCE_PREFERENCES: IntelligencePreferences = {
  // Feature toggles - all enabled by default except market mood
  liveReorderEnabled: true,
  smartTrimEnabled: true,
  conflictWarningsEnabled: true,
  suggestionsEnabled: true,
  marketMoodEnabled: false,
  
  // Display preferences - all enabled
  showDNABar: true,
  showCoherenceScore: true,
  compactSuggestions: false,
  showWhyThisTooltips: true,
  
  // Scoring preferences - neutral
  preferFamily: null,
  avoidFamilies: [],
};

/**
 * Preference categories for UI grouping.
 */
export type PreferenceCategory = 'features' | 'display' | 'scoring';

/**
 * Metadata for a single preference setting.
 */
export interface PreferenceMeta {
  key: keyof IntelligencePreferences;
  label: string;
  description: string;
  category: PreferenceCategory;
  type: 'toggle' | 'select' | 'multiselect';
}

/**
 * All preference metadata for UI rendering.
 */
export const PREFERENCE_METADATA: PreferenceMeta[] = [
  // Feature toggles
  {
    key: 'liveReorderEnabled',
    label: 'Live Reorder',
    description: 'Reorder dropdown options by relevance as you build your prompt',
    category: 'features',
    type: 'toggle',
  },
  {
    key: 'smartTrimEnabled',
    label: 'Smart Trim',
    description: 'When over character limit, trim lowest-relevance terms first',
    category: 'features',
    type: 'toggle',
  },
  {
    key: 'conflictWarningsEnabled',
    label: 'Conflict Warnings',
    description: 'Show warnings when selected terms clash (e.g., vintage + cyberpunk)',
    category: 'features',
    type: 'toggle',
  },
  {
    key: 'suggestionsEnabled',
    label: 'Smart Suggestions',
    description: 'Show context-aware "Suggested for you" options',
    category: 'features',
    type: 'toggle',
  },
  {
    key: 'marketMoodEnabled',
    label: 'Market Mood',
    description: 'Let live market data influence suggestions (Promagen unique feature)',
    category: 'features',
    type: 'toggle',
  },
  
  // Display preferences
  {
    key: 'showDNABar',
    label: 'DNA Bar',
    description: 'Show visual indicator of category fill status',
    category: 'display',
    type: 'toggle',
  },
  {
    key: 'showCoherenceScore',
    label: 'Coherence Score',
    description: 'Show percentage coherence score for your prompt',
    category: 'display',
    type: 'toggle',
  },
  {
    key: 'compactSuggestions',
    label: 'Compact Suggestions',
    description: 'Use smaller suggestion chips to save space',
    category: 'display',
    type: 'toggle',
  },
  {
    key: 'showWhyThisTooltips',
    label: '"Why this?" Tooltips',
    description: 'Show educational tooltips explaining suggestions',
    category: 'display',
    type: 'toggle',
  },
  
  // Scoring preferences
  {
    key: 'preferFamily',
    label: 'Preferred Style',
    description: 'Bias suggestions toward a specific style family',
    category: 'scoring',
    type: 'select',
  },
  {
    key: 'avoidFamilies',
    label: 'Avoid Styles',
    description: 'Never suggest options from these style families',
    category: 'scoring',
    type: 'multiselect',
  },
];
