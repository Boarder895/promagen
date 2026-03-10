// src/components/prompts/library/quick-save-toast.tsx
// ============================================================================
// QUICK SAVE TOAST (v1.0.0)
// ============================================================================
// Global toast notification for one-click prompt saves.
// Appears when the 💾 icon is clicked on any surface in Promagen.
//
// Architecture: Module-level event emitter.
// - Any component calls triggerQuickSaveToast(data) — no context needed
// - This component subscribes on mount and renders the toast
// - Mount once in root layout.tsx
//
// Human Factors Gate:
// - Feature: Emerald toast confirming save with undo + auto-dismiss
// - Factor: Peak-End Rule (Kahneman) — the toast is the END of the save
//   action. A polished end-moment makes the entire save flow feel premium.
// - Anti-pattern: Alert dialog, blocking modal, or no feedback at all
//
// Design: saved-page.md §8.2
// Sizing: All clamp() with 9px floor (code-standard.md §6.0.1)
// Animations: Co-located <style jsx> (code-standard.md §6.2)
// Existing features preserved: Yes
// ============================================================================

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

// ============================================================================
// MODULE-LEVEL EVENT SYSTEM
// ============================================================================
// This allows any component to trigger the toast without prop drilling
// or React context. Import { triggerQuickSaveToast } from this file.
// ============================================================================

export interface QuickSaveToastData {
  /** The auto-generated or provided prompt name */
  promptName: string;
  /** The ID of the just-saved prompt (needed for undo) */
  promptId: string;
}

type ToastListener = (data: QuickSaveToastData) => void;

const listeners = new Set<ToastListener>();

/**
 * Trigger the quick save toast from any component.
 *
 * Usage:
 * ```ts
 * import { triggerQuickSaveToast } from '@/components/prompts/library/quick-save-toast';
 *
 * const saved = quickSave({ ... });
 * if (saved) {
 *   triggerQuickSaveToast({ promptName: saved.name, promptId: saved.id });
 * }
 * ```
 */
export function triggerQuickSaveToast(data: QuickSaveToastData): void {
  for (const listener of listeners) {
    listener(data);
  }
}

function subscribe(fn: ToastListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Auto-dismiss delay in milliseconds */
const DISMISS_DELAY = 4000;
/** "Save undone" confirmation display time */
const UNDO_CONFIRM_DELAY = 1500;
/** Slide-up animation duration */
const ANIMATION_DURATION = 300;
/** Maximum visible characters for prompt name */
const MAX_NAME_DISPLAY = 50;

// ============================================================================
// TYPES
// ============================================================================

type ToastState =
  | { type: 'hidden' }
  | { type: 'saved'; promptName: string; promptId: string }
  | { type: 'undone' };

// ============================================================================
// COMPONENT
// ============================================================================

export interface QuickSaveToastProps {
  /** Called when user clicks "Undo" — should call deletePrompt(id) */
  onUndo?: (promptId: string) => void;
}

export function QuickSaveToast({ onUndo }: QuickSaveToastProps) {
  const [state, setState] = useState<ToastState>({ type: 'hidden' });
  const [isVisible, setIsVisible] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remainingTimeRef = useRef(DISMISS_DELAY);
  const pauseStartRef = useRef(0);

  // ── Clear any active timer ──
  const clearTimer = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  // ── Dismiss with exit animation ──
  const dismiss = useCallback(() => {
    clearTimer();
    setIsVisible(false);
    // Wait for exit animation, then hide
    setTimeout(() => {
      setState({ type: 'hidden' });
      remainingTimeRef.current = DISMISS_DELAY;
    }, ANIMATION_DURATION);
  }, [clearTimer]);

  // ── Start / resume the auto-dismiss countdown ──
  const startTimer = useCallback(
    (duration: number) => {
      clearTimer();
      remainingTimeRef.current = duration;
      dismissTimerRef.current = setTimeout(() => {
        dismiss();
      }, duration);
    },
    [clearTimer, dismiss]
  );

  // ── Subscribe to global toast events ──
  useEffect(() => {
    const unsubscribe = subscribe((data) => {
      // Cancel any existing toast
      clearTimer();

      // Show new toast
      setState({
        type: 'saved',
        promptName: data.promptName,
        promptId: data.promptId,
      });
      remainingTimeRef.current = DISMISS_DELAY;

      // Trigger enter animation on next frame
      requestAnimationFrame(() => {
        setIsVisible(true);
      });

      // Start auto-dismiss
      startTimer(DISMISS_DELAY);
    });

    return () => {
      unsubscribe();
      clearTimer();
    };
  }, [clearTimer, startTimer]);

  // ── Pause on hover ──
  const handleMouseEnter = useCallback(() => {
    if (state.type !== 'saved') return;
    setIsPaused(true);
    pauseStartRef.current = Date.now();

    // Calculate remaining time
    if (dismissTimerRef.current) {
      clearTimer();
    }
  }, [state.type, clearTimer]);

  const handleMouseLeave = useCallback(() => {
    if (state.type !== 'saved') return;
    setIsPaused(false);

    // Resume with remaining time
    const pausedFor = Date.now() - pauseStartRef.current;
    const remaining = Math.max(remainingTimeRef.current - pausedFor, 500);
    startTimer(remaining);
  }, [state.type, startTimer]);

  // ── Undo handler ──
  const handleUndo = useCallback(() => {
    if (state.type !== 'saved') return;

    const { promptId } = state;

    // Call external undo handler
    onUndo?.(promptId);

    // Switch to "undone" state
    clearTimer();
    setState({ type: 'undone' });

    // Auto-dismiss the "undone" confirmation
    setTimeout(() => {
      dismiss();
    }, UNDO_CONFIRM_DELAY);
  }, [state, onUndo, clearTimer, dismiss]);

  // ── Truncate name ──
  const displayName =
    state.type === 'saved'
      ? state.promptName.length > MAX_NAME_DISPLAY
        ? state.promptName.slice(0, MAX_NAME_DISPLAY - 1) + '…'
        : state.promptName
      : '';

  // ── Don't render anything when hidden ──
  if (state.type === 'hidden') return null;

  // Suppress lint warning for isPaused (used for future progress bar)
  void isPaused;

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`quick-save-toast fixed z-50 ${
          isVisible ? 'quick-save-toast--enter' : 'quick-save-toast--exit'
        }`}
        style={{
          bottom: 'clamp(16px, 2vw, 24px)',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: 'clamp(10px, 1vw, 14px) clamp(14px, 1.4vw, 20px)',
          borderRadius: 'clamp(10px, 1vw, 14px)',
          maxWidth: 'clamp(300px, 40vw, 480px)',
          minWidth: 'clamp(250px, 28vw, 320px)',
        }}
      >
        {state.type === 'saved' ? (
          <>
            {/* ── Saved state ── */}
            <div className="flex items-center justify-between" style={{ gap: 'clamp(8px, 0.8vw, 12px)' }}>
              <div className="flex items-center" style={{ gap: 'clamp(6px, 0.6vw, 10px)' }}>
                {/* Check icon */}
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-emerald-400 shrink-0"
                  style={{
                    width: 'clamp(14px, 1.2vw, 18px)',
                    height: 'clamp(14px, 1.2vw, 18px)',
                  }}
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>

                <span
                  className="font-medium text-emerald-400"
                  style={{ fontSize: 'clamp(0.6rem, 0.75vw, 0.85rem)' }}
                >
                  Saved to Library
                </span>
              </div>

              {/* Undo button */}
              <button
                onClick={handleUndo}
                className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors shrink-0"
                style={{ fontSize: 'clamp(0.55rem, 0.65vw, 0.75rem)' }}
                aria-label="Undo save"
              >
                Undo
              </button>
            </div>

            {/* Prompt name */}
            <p
              className="text-white/70 truncate"
              style={{
                fontSize: 'clamp(0.5625rem, 0.6vw, 0.72rem)',
                marginTop: 'clamp(3px, 0.3vw, 5px)',
                paddingLeft: 'clamp(20px, 1.8vw, 28px)',
              }}
            >
              &ldquo;{displayName}&rdquo;
            </p>
          </>
        ) : (
          <>
            {/* ── Undone state ── */}
            <div className="flex items-center" style={{ gap: 'clamp(6px, 0.6vw, 10px)' }}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-white/70 shrink-0"
                style={{
                  width: 'clamp(14px, 1.2vw, 18px)',
                  height: 'clamp(14px, 1.2vw, 18px)',
                }}
              >
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>

              <span
                className="text-white/70"
                style={{ fontSize: 'clamp(0.6rem, 0.75vw, 0.85rem)' }}
              >
                Save undone
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── Animations (co-located per code-standard.md §6.2) ── */}
      <style jsx>{`
        .quick-save-toast {
          background: rgba(16, 185, 129, 0.12);
          box-shadow:
            0 0 0 1px rgba(16, 185, 129, 0.25),
            0 4px 20px rgba(0, 0, 0, 0.3),
            0 0 40px rgba(16, 185, 129, 0.06);
          backdrop-filter: blur(12px);
          opacity: 0;
          transform: translateX(-50%) translateY(8px);
          transition:
            opacity ${ANIMATION_DURATION}ms ease-out,
            transform ${ANIMATION_DURATION}ms ease-out;
          pointer-events: none;
        }

        .quick-save-toast--enter {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
          pointer-events: auto;
        }

        .quick-save-toast--exit {
          opacity: 0;
          transform: translateX(-50%) translateY(8px);
          pointer-events: none;
        }

        @media (prefers-reduced-motion: reduce) {
          .quick-save-toast {
            transition: opacity ${ANIMATION_DURATION}ms ease-out;
            transform: translateX(-50%) translateY(0);
          }

          .quick-save-toast--exit {
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>
    </>
  );
}

export default QuickSaveToast;
