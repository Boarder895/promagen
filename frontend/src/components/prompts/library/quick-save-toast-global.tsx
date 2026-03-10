// src/components/prompts/library/quick-save-toast-global.tsx
// ============================================================================
// QUICK SAVE TOAST — GLOBAL MOUNT
// ============================================================================
// Lightweight client wrapper that mounts the QuickSaveToast in root layout.
//
// Undo is handled via direct localStorage manipulation (not the full
// useSavedPrompts hook) to avoid loading the entire prompt library on every
// page. If the library page is open simultaneously, it will pick up the
// change on the next storage read.
//
// Mount in layout.tsx:
//   import { QuickSaveToastGlobal } from '@/components/prompts/library/quick-save-toast-global';
//   // Inside <body>:
//   <QuickSaveToastGlobal />
//
// Existing features preserved: Yes
// ============================================================================

'use client';

import React, { useCallback } from 'react';
import { QuickSaveToast } from './quick-save-toast';

// ============================================================================
// STORAGE KEY (must match use-saved-prompts.ts)
// ============================================================================

const STORAGE_KEY = 'promagen_saved_prompts';

// ============================================================================
// COMPONENT
// ============================================================================

export function QuickSaveToastGlobal() {
  /**
   * Lightweight undo: remove a prompt by ID directly from localStorage.
   * This avoids mounting the full useSavedPrompts hook on every page.
   */
  const handleUndo = useCallback((promptId: string) => {
    if (typeof window === 'undefined') return;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const data = JSON.parse(raw);
      if (!data.prompts || !Array.isArray(data.prompts)) return;

      const before = data.prompts.length;
      data.prompts = data.prompts.filter(
        (p: { id?: string }) => p.id !== promptId
      );

      if (data.prompts.length < before) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

        // Dispatch a storage event so any mounted useSavedPrompts
        // hooks on the same page can pick up the change
        window.dispatchEvent(new StorageEvent('storage', {
          key: STORAGE_KEY,
          newValue: JSON.stringify(data),
        }));
      }
    } catch (error) {
      console.error('[QuickSaveToast] Undo failed:', error);
    }
  }, []);

  return <QuickSaveToast onUndo={handleUndo} />;
}

export default QuickSaveToastGlobal;
