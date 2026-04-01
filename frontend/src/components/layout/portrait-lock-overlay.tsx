// src/components/layout/portrait-lock-overlay.tsx
// ============================================================================
// PORTRAIT LOCK OVERLAY — Rotate-to-landscape prompt for phones
// ============================================================================
// Shows a full-screen overlay on portrait orientation below 768px.
// Uses CSS media queries only — zero JS, zero hydration cost.
// Desktop/tablet/landscape: completely invisible.
//
// Existing features preserved: Yes — pure additive CSS overlay.
// ============================================================================

import React from 'react';

const PORTRAIT_STYLES = `
  .portrait-lock-overlay {
    display: none;
  }

  @media (orientation: portrait) and (max-width: 767px) {
    .portrait-lock-overlay {
      display: flex;
      position: fixed;
      inset: 0;
      z-index: 9999;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: clamp(16px, 4vw, 24px);
      background: rgba(2, 6, 23, 0.97);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      padding: clamp(24px, 6vw, 40px);
      text-align: center;
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    @keyframes portraitRotateHint {
      0%, 15% { transform: rotate(0deg); }
      40%, 60% { transform: rotate(-90deg); }
      85%, 100% { transform: rotate(0deg); }
    }
    .portrait-rotate-icon {
      animation: portraitRotateHint 3s ease-in-out infinite;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .portrait-rotate-icon {
      transform: rotate(-90deg);
      animation: none;
    }
  }
`;

export default function PortraitLockOverlay() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PORTRAIT_STYLES }} />
      <div className="portrait-lock-overlay" aria-live="polite">
        {/* Phone icon with rotation animation */}
        <div className="portrait-rotate-icon">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ width: 'clamp(48px, 12vw, 64px)', height: 'clamp(48px, 12vw, 64px)', color: '#38bdf8' }}
          >
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
            <line x1="12" y1="18" x2="12" y2="18.01" strokeWidth="2" />
          </svg>
        </div>

        <h2
          className="font-semibold"
          style={{ fontSize: 'clamp(1.1rem, 4.5vw, 1.4rem)' }}
        >
          <span className="bg-gradient-to-r from-sky-400 via-emerald-300 to-indigo-400 bg-clip-text text-transparent">
            Rotate for Promagen
          </span>
        </h2>

        <p
          className="text-white/70"
          style={{ fontSize: 'clamp(0.85rem, 3.5vw, 1rem)', lineHeight: 1.5, maxWidth: '280px' }}
        >
          Promagen is built for landscape viewing.
          Turn your phone sideways for the best experience.
        </p>
      </div>
    </>
  );
}
