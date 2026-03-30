// src/components/prompts/lab-gate-overlay.tsx
// ============================================================================
// LAB GATE OVERLAY — Post-Generation Upgrade Prompt (v1.0.0)
// ============================================================================
// Inline overlay shown when a free signed-in user has exhausted their
// 1 daily Prompt Lab generation. Replaces the workspace content with a
// value-reminder + upgrade CTA.
//
// Design principles:
//   - Remind them of the value they just received (Loss Aversion §8)
//   - Show the path forward without punishment (invitation, not redirect)
//   - Same visual language as the rest of Promagen (dark glass, clamp sizing)
//   - No grey text (code-standard §6.0.2)
//   - All sizing via clamp() (code-standard §6.0)
//   - cursor-pointer on clickable elements (code-standard §6.0.4)
//
// Authority: paid_tier.md §5.13, human-factors.md §8
// Existing features preserved: Yes
// ============================================================================

'use client';

import React from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface LabGateOverlayProps {
  /** Whether to show the "sign in first" variant (anonymous user) */
  requiresSignIn?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function LabGateOverlay({ requiresSignIn = false }: LabGateOverlayProps) {
  if (requiresSignIn) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-3xl bg-slate-950/70 ring-1 ring-white/10"
        style={{
          padding: 'clamp(24px, 2.5vw, 40px)',
          gap: 'clamp(16px, 1.5vw, 28px)',
          minHeight: 'clamp(200px, 20vw, 320px)',
        }}
      >
        {/* Lock icon */}
        <div
          className="flex items-center justify-center rounded-full"
          style={{
            width: 'clamp(48px, 4vw, 64px)',
            height: 'clamp(48px, 4vw, 64px)',
            background: 'rgba(251, 146, 60, 0.15)',
          }}
        >
          <svg
            className="text-amber-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            style={{
              width: 'clamp(24px, 2vw, 32px)',
              height: 'clamp(24px, 2vw, 32px)',
            }}
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <div className="flex flex-col items-center text-center" style={{ gap: 'clamp(6px, 0.5vw, 10px)' }}>
          <h3
            className="font-semibold text-white"
            style={{ fontSize: 'clamp(0.9rem, 1.1vw, 1.3rem)' }}
          >
            Sign in to use the Prompt Lab
          </h3>
          <p
            className="text-slate-300"
            style={{ fontSize: 'clamp(0.7rem, 0.8vw, 0.9rem)', maxWidth: '400px' }}
          >
            The Prompt Lab turns your words into 4 platform-optimised prompts in seconds.
            Sign in to get 1 free generation per day.
          </p>
        </div>

        <a
          href="/sign-in?redirect_url=/studio/playground"
          className="inline-flex items-center justify-center rounded-xl border border-sky-400/[0.60] bg-gradient-to-r from-sky-400/[0.40] via-emerald-300/[0.40] to-indigo-400/[0.40] font-medium shadow-sm no-underline cursor-pointer transition-all hover:from-sky-400/[0.50] hover:via-emerald-300/[0.50] hover:to-indigo-400/[0.50]"
          style={{
            padding: 'clamp(0.5rem, 0.6vw, 0.8rem) clamp(1.2rem, 1.5vw, 2rem)',
            fontSize: 'clamp(0.7rem, 0.85vw, 1rem)',
            gap: 'clamp(0.3rem, 0.4vw, 0.6rem)',
          }}
        >
          {/* COLOUR FIX (buttons.md §1.1): body { color: #020617 } + a { color: inherit }
              means <a> children inherit BLACK. Must set text-white on every child. */}
          <span className="text-white">Sign in</span>
          <svg
            className="text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            style={{ width: 'clamp(14px, 1.2vw, 18px)', height: 'clamp(14px, 1.2vw, 18px)' }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </a>
      </div>
    );
  }

  // ── Exhausted free user variant ──────────────────────────────────────
  return (
    <div
      className="flex flex-col items-center justify-center rounded-3xl bg-slate-950/70 ring-1 ring-white/10"
      style={{
        padding: 'clamp(24px, 2.5vw, 40px)',
        gap: 'clamp(16px, 1.5vw, 28px)',
        minHeight: 'clamp(200px, 20vw, 320px)',
      }}
    >
      {/* Checkmark icon — they succeeded, this is a positive moment */}
      <div
        className="flex items-center justify-center rounded-full"
        style={{
          width: 'clamp(48px, 4vw, 64px)',
          height: 'clamp(48px, 4vw, 64px)',
          background: 'rgba(52, 211, 153, 0.15)',
        }}
      >
        <svg
          className="text-emerald-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          style={{
            width: 'clamp(24px, 2vw, 32px)',
            height: 'clamp(24px, 2vw, 32px)',
          }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <div className="flex flex-col items-center text-center" style={{ gap: 'clamp(6px, 0.5vw, 10px)' }}>
        <h3
          className="font-semibold text-white"
          style={{ fontSize: 'clamp(0.9rem, 1.1vw, 1.3rem)' }}
        >
          Your daily generation has been used
        </h3>
        <p
          className="text-slate-300"
          style={{ fontSize: 'clamp(0.7rem, 0.8vw, 0.9rem)', maxWidth: '420px' }}
        >
          The Prompt Lab reshapes every description into prompts tailored for 40 platforms.
          One generation per day barely scratches the surface.
          Go unlimited — no waiting, no limits.
        </p>
      </div>

      <a
        href="/pro-promagen"
        className="inline-flex items-center justify-center rounded-xl border border-amber-400/[0.60] bg-gradient-to-r from-amber-500/[0.30] to-orange-500/[0.30] font-semibold shadow-sm no-underline cursor-pointer transition-all hover:from-amber-500/[0.40] hover:to-orange-500/[0.40]"
        style={{
          padding: 'clamp(0.5rem, 0.6vw, 0.8rem) clamp(1.2rem, 1.5vw, 2rem)',
          fontSize: 'clamp(0.7rem, 0.85vw, 1rem)',
          gap: 'clamp(0.3rem, 0.4vw, 0.6rem)',
        }}
      >
        {/* COLOUR FIX (buttons.md §1.1): body { color: #020617 } + a { color: inherit }
            means <a> children inherit BLACK. Must set text colour on every child. */}
        <span className="text-amber-300">Unlock unlimited prompts</span>
        <svg
          className="text-amber-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          style={{ width: 'clamp(14px, 1.2vw, 18px)', height: 'clamp(14px, 1.2vw, 18px)' }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      </a>
    </div>
  );
}

// ============================================================================
// FREE GENERATION BADGE — "1 free generation — make it count"
// ============================================================================

export function FreeGenerationBadge({ remaining }: { remaining: number }) {
  if (remaining <= 0) return null;

  return (
    <div
      className="flex items-center justify-center rounded-lg"
      style={{
        padding: 'clamp(4px, 0.4vw, 8px) clamp(10px, 1vw, 16px)',
        gap: 'clamp(4px, 0.4vw, 8px)',
        background: 'rgba(251, 146, 60, 0.1)',
        border: '1px solid rgba(251, 146, 60, 0.25)',
      }}
    >
      <span
        className="text-amber-400 font-medium"
        style={{ fontSize: 'clamp(0.6rem, 0.7vw, 0.8rem)' }}
      >
        ✦ {remaining} free generation — make it count
      </span>
    </div>
  );
}

export default LabGateOverlay;
