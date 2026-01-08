// src/hooks/use-intelligence-preferences.ts
// ============================================================================
// INTELLIGENCE PREFERENCES HOOK
// ============================================================================
// Manages Prompt Intelligence preferences in localStorage.
// Authority: docs/authority/prompt-intelligence.md §10
// ============================================================================

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { IntelligencePreferences } from '@/types/intelligence-preferences';
import { DEFAULT_INTELLIGENCE_PREFERENCES } from '@/types/intelligence-preferences';

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = 'promagen_intelligence_preferences';
const STORAGE_VERSION = '1.0.0';

interface StorageData {
  version: string;
  preferences: IntelligencePreferences;
  updatedAt: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Validate preferences object has all required keys.
 */
function isValidPreferences(obj: unknown): obj is IntelligencePreferences {
  if (!obj || typeof obj !== 'object') return false;
  
  const prefs = obj as Record<string, unknown>;
  
  // Check all required boolean keys exist
  const booleanKeys = [
    'liveReorderEnabled',
    'smartTrimEnabled',
    'conflictWarningsEnabled',
    'suggestionsEnabled',
    'marketMoodEnabled',
    'showDNABar',
    'showCoherenceScore',
    'compactSuggestions',
    'showWhyThisTooltips',
  ];
  
  for (const key of booleanKeys) {
    if (typeof prefs[key] !== 'boolean') return false;
  }
  
  // Check preferFamily is string or null
  if (prefs.preferFamily !== null && typeof prefs.preferFamily !== 'string') {
    return false;
  }
  
  // Check avoidFamilies is array
  if (!Array.isArray(prefs.avoidFamilies)) return false;
  
  return true;
}

/**
 * Merge stored preferences with defaults (handles version migrations).
 */
function mergeWithDefaults(
  stored: Partial<IntelligencePreferences>
): IntelligencePreferences {
  return {
    ...DEFAULT_INTELLIGENCE_PREFERENCES,
    ...stored,
  };
}

/**
 * Load preferences from localStorage.
 */
function loadFromStorage(): IntelligencePreferences {
  if (typeof window === 'undefined') return DEFAULT_INTELLIGENCE_PREFERENCES;
  
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_INTELLIGENCE_PREFERENCES;
    
    const data: StorageData = JSON.parse(raw);
    
    // Version check for future migrations
    if (data.version !== STORAGE_VERSION) {
      // Version mismatch - merge with defaults (silent)
    }
    
    // Validate and merge
    if (isValidPreferences(data.preferences)) {
      return data.preferences;
    }
    
    // Partial data - merge with defaults
    return mergeWithDefaults(data.preferences || {});
  } catch {
    // Failed to load - return defaults (silent)
    return DEFAULT_INTELLIGENCE_PREFERENCES;
  }
}

/**
 * Save preferences to localStorage.
 */
function saveToStorage(preferences: IntelligencePreferences): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const data: StorageData = {
      version: STORAGE_VERSION,
      preferences,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    // Failed to save (silent)
    return false;
  }
}

// ============================================================================
// HOOK
// ============================================================================

export interface UseIntelligencePreferencesReturn {
  /** Current preferences */
  preferences: IntelligencePreferences;
  
  /** Whether preferences are loading */
  isLoading: boolean;
  
  /** Update a single preference */
  setPreference: <K extends keyof IntelligencePreferences>(
    key: K,
    value: IntelligencePreferences[K]
  ) => void;
  
  /** Update multiple preferences at once */
  setPreferences: (updates: Partial<IntelligencePreferences>) => void;
  
  /** Reset all preferences to defaults */
  resetToDefaults: () => void;
  
  /** Toggle a boolean preference */
  togglePreference: (key: keyof IntelligencePreferences) => void;
  
  /** Add a family to avoid list */
  addAvoidFamily: (family: string) => void;
  
  /** Remove a family from avoid list */
  removeAvoidFamily: (family: string) => void;
  
  /** Export preferences as JSON */
  exportPreferences: () => string;
  
  /** Import preferences from JSON */
  importPreferences: (json: string) => boolean;
}

export function useIntelligencePreferences(): UseIntelligencePreferencesReturn {
  const [preferences, setPreferencesState] = useState<IntelligencePreferences>(
    DEFAULT_INTELLIGENCE_PREFERENCES
  );
  const [isLoading, setIsLoading] = useState(true);
  
  // Load from storage on mount
  useEffect(() => {
    const loaded = loadFromStorage();
    setPreferencesState(loaded);
    setIsLoading(false);
  }, []);
  
  // Save to storage when preferences change
  useEffect(() => {
    if (!isLoading) {
      saveToStorage(preferences);
    }
  }, [preferences, isLoading]);
  
  // Set a single preference
  const setPreference = useCallback(<K extends keyof IntelligencePreferences>(
    key: K,
    value: IntelligencePreferences[K]
  ) => {
    setPreferencesState(prev => ({
      ...prev,
      [key]: value,
    }));
  }, []);
  
  // Set multiple preferences
  const setPreferences = useCallback((updates: Partial<IntelligencePreferences>) => {
    setPreferencesState(prev => ({
      ...prev,
      ...updates,
    }));
  }, []);
  
  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setPreferencesState(DEFAULT_INTELLIGENCE_PREFERENCES);
  }, []);
  
  // Toggle a boolean preference
  const togglePreference = useCallback((key: keyof IntelligencePreferences) => {
    setPreferencesState(prev => {
      const currentValue = prev[key];
      if (typeof currentValue !== 'boolean') {
        // Cannot toggle non-boolean preference (silent)
        return prev;
      }
      return {
        ...prev,
        [key]: !currentValue,
      };
    });
  }, []);
  
  // Add family to avoid list
  const addAvoidFamily = useCallback((family: string) => {
    setPreferencesState(prev => {
      if (prev.avoidFamilies.includes(family)) return prev;
      return {
        ...prev,
        avoidFamilies: [...prev.avoidFamilies, family],
      };
    });
  }, []);
  
  // Remove family from avoid list
  const removeAvoidFamily = useCallback((family: string) => {
    setPreferencesState(prev => ({
      ...prev,
      avoidFamilies: prev.avoidFamilies.filter(f => f !== family),
    }));
  }, []);
  
  // Export as JSON
  const exportPreferences = useCallback((): string => {
    return JSON.stringify({
      version: STORAGE_VERSION,
      exportedAt: new Date().toISOString(),
      preferences,
    }, null, 2);
  }, [preferences]);
  
  // Import from JSON
  const importPreferences = useCallback((json: string): boolean => {
    try {
      const data = JSON.parse(json);
      const imported = data.preferences;
      
      if (isValidPreferences(imported)) {
        setPreferencesState(imported);
        return true;
      }
      
      // Try merging partial data
      const merged = mergeWithDefaults(imported || {});
      setPreferencesState(merged);
      return true;
    } catch {
      // Failed to import (silent)
      return false;
    }
  }, []);
  
  return useMemo(() => ({
    preferences,
    isLoading,
    setPreference,
    setPreferences,
    resetToDefaults,
    togglePreference,
    addAvoidFamily,
    removeAvoidFamily,
    exportPreferences,
    importPreferences,
  }), [
    preferences,
    isLoading,
    setPreference,
    setPreferences,
    resetToDefaults,
    togglePreference,
    addAvoidFamily,
    removeAvoidFamily,
    exportPreferences,
    importPreferences,
  ]);
}

export default useIntelligencePreferences;
