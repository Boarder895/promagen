// src/components/prompts/library/save-icon.tsx
// ============================================================================
// SAVE ICON (💾) — Shared across all prompt surfaces
// ============================================================================
// Lightweight save button that writes directly to localStorage.
// Does NOT mount useSavedPrompts hook — avoids loading the full prompt
// library on every page that shows a tooltip.
//
// Usage:
//   <SaveIcon
//     positivePrompt="A cyberpunk hacker..."
//     platformId="midjourney"
//     platformName="Midjourney"
//     source="tooltip"
//   />
//
// Human Factors Gate:
// - Feature: One-click save icon on every prompt surface
// - Factor: Fitts's Law — button is adjacent to copy (cursor is already there)
//   + Loss Aversion — once saved, the "undo" toast creates a micro-loss frame
// - Anti-pattern: Modal, name prompt, or any friction before saving
//
// Authority: saved-page.md §7
// Sizing: Matches copy icon on each surface (clamp-aware)
// Existing features preserved: Yes
// ============================================================================

'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { triggerQuickSaveToast } from './quick-save-toast';

// ============================================================================
// LIGHTWEIGHT SAVE HELPER (no hook dependency)
// ============================================================================

const STORAGE_KEY = 'promagen_saved_prompts';
const STORAGE_VERSION = '1.1.0';

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface QuickSaveData {
  positivePrompt: string;
  negativePrompt?: string;
  platformId: string;
  platformName: string;
  source: 'builder' | 'tooltip';
  tier?: number;
  families?: string[];
  mood?: 'calm' | 'intense' | 'neutral';
  coherenceScore?: number;
  selections?: Record<string, unknown>;
  customValues?: Record<string, string>;
  /** Whether this prompt went through the optimisation pipeline */
  isOptimised?: boolean;
  /** The optimised prompt text */
  optimisedPrompt?: string;
}

/**
 * Save a prompt directly to localStorage without mounting the full hook.
 * Returns the saved prompt's { id, name } or null on failure.
 */
function saveToLibrary(
  data: QuickSaveData
): { id: string; name: string } | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const store = raw ? JSON.parse(raw) : { version: STORAGE_VERSION, prompts: [] };

    // Auto-name: first 30 chars of prompt text + platform
    const subject = data.positivePrompt.slice(0, 30).trim();
    const autoName = `${subject || 'Untitled'} — ${data.platformName}`;

    const now = new Date().toISOString();
    const id = generateId();

    const newPrompt = {
      id,
      name: autoName,
      platformId: data.platformId,
      platformName: data.platformName,
      positivePrompt: data.positivePrompt,
      negativePrompt: data.negativePrompt,
      selections: data.selections ?? {},
      customValues: data.customValues ?? {},
      families: data.families ?? [],
      mood: data.mood ?? 'neutral',
      coherenceScore: data.coherenceScore ?? 0,
      characterCount: data.positivePrompt.length,
      createdAt: now,
      updatedAt: now,
      source: data.source,
      tier: data.tier,
      isOptimised: data.isOptimised ?? false,
      optimisedPrompt: data.optimisedPrompt,
    };

    store.prompts.push(newPrompt);
    store.version = STORAGE_VERSION;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));

    // Notify any mounted useSavedPrompts hooks
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: STORAGE_KEY,
        newValue: JSON.stringify(store),
      })
    );

    return { id, name: autoName };
  } catch (error) {
    console.error('[SaveIcon] Failed to save prompt:', error);
    return null;
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export interface SaveIconProps extends QuickSaveData {
  /** Icon sizing variant (matches the surface's copy icon) */
  size?: 'sm' | 'md' | 'lg';
}

export function SaveIcon({
  size = 'md',
  ...saveData
}: SaveIconProps) {
  const [saved, setSaved] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleSave = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (saved) return; // Prevent double-save during feedback

      const result = saveToLibrary(saveData);
      if (result) {
        setSaved(true);
        triggerQuickSaveToast({
          promptName: result.name,
          promptId: result.id,
        });
        timeoutRef.current = setTimeout(() => setSaved(false), 1500);
      }
    },
    [saveData, saved]
  );

  // Size configurations matching each surface's copy icon
  const sizeStyles = {
    sm: {
      width: '20px',
      height: '20px',
      iconW: '12px',
      iconH: '12px',
    },
    md: {
      width: '24px',
      height: '24px',
      iconW: '14px',
      iconH: '14px',
    },
    lg: {
      width: 'clamp(24px, 1.8vw, 30px)',
      height: 'clamp(24px, 1.8vw, 30px)',
      iconW: 'clamp(12px, 0.9vw, 16px)',
      iconH: 'clamp(12px, 0.9vw, 16px)',
    },
  };

  const s = sizeStyles[size];

  return (
    <button
      type="button"
      onClick={handleSave}
      className={`inline-flex items-center justify-center rounded-md transition-all duration-200 ${
        saved
          ? 'bg-emerald-500/20 text-emerald-400'
          : 'text-white/70 hover:text-white hover:bg-white/5'
      }`}
      style={{ width: s.width, height: s.height }}
      title={saved ? 'Saved!' : 'Save to Library'}
      aria-label={saved ? 'Saved to Library' : 'Save prompt to Library'}
    >
      {saved ? (
        /* Checkmark — matches copy feedback */
        <svg
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
          style={{ width: s.iconW, height: s.iconH }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        /* Bookmark icon — visual metaphor for "save/collect" */
        <svg
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          style={{ width: s.iconW, height: s.iconH }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
          />
        </svg>
      )}
    </button>
  );
}

export default SaveIcon;
