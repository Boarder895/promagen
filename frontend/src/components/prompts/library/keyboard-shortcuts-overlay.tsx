// src/components/prompts/library/keyboard-shortcuts-overlay.tsx
// ============================================================================
// KEYBOARD SHORTCUTS OVERLAY (v1.0.0)
// ============================================================================
// Press "?" on the library page to show a floating cheat sheet of all
// keyboard shortcuts. Press "?" or Escape to dismiss.
//
// Human Factors Gate:
// - Feature: Keyboard shortcut cheat sheet overlay
// - Factor: Curiosity Gap (Loewenstein) — power users discover shortcuts
//   exist when they accidentally press "?". The overlay rewards exploration
//   with a compact reference that makes them faster.
// - Anti-pattern: Always-visible help text (wastes space, teaches nothing)
//
// Authority: saved-page.md §17 open question #5
// Sizing: All clamp() with 9px (0.5625rem) floor
// Animations: Co-located <style jsx>
// Existing features preserved: Yes
// ============================================================================

'use client';

import React, { useState, useEffect, useCallback } from 'react';

// ============================================================================
// SHORTCUT DATA
// ============================================================================

interface Shortcut {
  keys: string[];
  description: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ['↑', '←'], description: 'Previous card' },
  { keys: ['↓', '→'], description: 'Next card' },
  { keys: ['Esc'], description: 'Deselect card' },
  { keys: ['/'], description: 'Focus search' },
  { keys: ['?'], description: 'Toggle this overlay' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function KeyboardShortcutsOverlay() {
  const [isVisible, setIsVisible] = useState(false);

  const toggle = useCallback(() => {
    setIsVisible((v) => !v);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === '?') {
        e.preventDefault();
        toggle();
      } else if (e.key === 'Escape' && isVisible) {
        setIsVisible(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, toggle]);

  if (!isVisible) return null;

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        className="shortcut-overlay-backdrop fixed inset-0 z-[9998] cursor-default"
        onClick={() => setIsVisible(false)}
        style={{ background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(2px)' }}
        aria-label="Close keyboard shortcuts"
        tabIndex={-1}
      />

      {/* Panel */}
      <div
        className="shortcut-overlay-panel fixed z-[9999]"
        role="dialog"
        aria-label="Keyboard shortcuts"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(15, 23, 42, 0.97)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: 'clamp(12px, 1vw, 16px)',
          padding: 'clamp(16px, 1.5vw, 24px)',
          boxShadow: '0 8px 40px rgba(0, 0, 0, 0.5), 0 0 60px rgba(56, 189, 248, 0.06)',
          minWidth: 'clamp(240px, 24vw, 320px)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{ marginBottom: 'clamp(12px, 1vw, 16px)' }}
        >
          <h3
            className="bg-gradient-to-r from-sky-400 via-emerald-300 to-indigo-400 bg-clip-text text-transparent font-semibold"
            style={{ fontSize: 'clamp(0.7rem, 0.9vw, 1.1rem)' }}
          >
            Keyboard Shortcuts
          </h3>
          <button
            type="button"
            onClick={() => setIsVisible(false)}
            className="text-white/70 hover:text-white transition-colors"
            style={{
              width: 'clamp(18px, 1.5vw, 22px)',
              height: 'clamp(18px, 1.5vw, 22px)',
            }}
            aria-label="Close shortcuts"
          >
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="flex flex-col" style={{ gap: 'clamp(6px, 0.5vw, 10px)' }}>
          {SHORTCUTS.map((shortcut, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between"
              style={{ gap: 'clamp(12px, 1vw, 20px)' }}
            >
              {/* Keys */}
              <div className="flex items-center" style={{ gap: 'clamp(3px, 0.25vw, 4px)' }}>
                {shortcut.keys.map((key, kidx) => (
                  <React.Fragment key={kidx}>
                    {kidx > 0 && (
                      <span
                        className="text-white/70"
                        style={{ fontSize: 'clamp(0.5625rem, 0.65vw, 0.8rem)' }}
                      >
                        /
                      </span>
                    )}
                    <kbd
                      className="inline-flex items-center justify-center rounded bg-white/10 text-white font-mono font-medium"
                      style={{
                        padding: 'clamp(2px, 0.15vw, 3px) clamp(6px, 0.5vw, 8px)',
                        fontSize: 'clamp(0.5625rem, 0.65vw, 0.8rem)',
                        minWidth: 'clamp(22px, 2vw, 28px)',
                      }}
                    >
                      {key}
                    </kbd>
                  </React.Fragment>
                ))}
              </div>

              {/* Description */}
              <span
                className="text-white/70"
                style={{ fontSize: 'clamp(0.5625rem, 0.7vw, 0.85rem)' }}
              >
                {shortcut.description}
              </span>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <p
          className="text-white/70 text-center"
          style={{
            fontSize: 'clamp(0.5625rem, 0.6vw, 0.75rem)',
            marginTop: 'clamp(10px, 0.9vw, 14px)',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            paddingTop: 'clamp(8px, 0.7vw, 10px)',
          }}
        >
          Press <kbd className="inline-flex items-center justify-center rounded bg-white/10 text-white font-mono" style={{ padding: '1px 4px', fontSize: 'clamp(0.5625rem, 0.6vw, 0.75rem)' }}>?</kbd> to toggle
        </p>
      </div>

      <style jsx>{`
        .shortcut-overlay-backdrop {
          animation: overlayFadeIn 150ms ease-out;
        }
        .shortcut-overlay-panel {
          animation: overlaySlideIn 200ms ease-out;
        }
        @keyframes overlayFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes overlaySlideIn {
          from { opacity: 0; transform: translate(-50%, -48%); }
          to { opacity: 1; transform: translate(-50%, -50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .shortcut-overlay-backdrop,
          .shortcut-overlay-panel {
            animation: none;
          }
        }
      `}</style>
    </>
  );
}

export default KeyboardShortcutsOverlay;
