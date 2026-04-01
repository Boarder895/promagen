// src/components/layout/mobile-builder-gate.tsx
// ============================================================================
// MOBILE BUILDER GATE v2.0 — Phantom Scroll Preview (Upgrade 1)
// ============================================================================
// Wraps builder pages (Prompt Lab, Provider Builder) on mobile.
//
// v2.0 UPGRADE: PHANTOM SCROLL PREVIEW
// Instead of a static gate card, the ACTUAL builder UI renders on mobile
// at 55% scale inside a height-constrained preview window. A frosted glass
// overlay sits on top with the CTA. The builder is pointer-events:none —
// purely visual. The user scrolls through a frozen preview of the real
// interface: real categories, real prompt output, real tier tabs.
//
// Psychology: Museum glass. You see it, you want it, you can't touch it.
// The Zeigarnik effect at maximum intensity — they've SEEN the tool,
// they know exactly what they'll get on desktop.
//
// Desktop (≥768px): renders children directly via md:contents, zero overhead.
//
// Design: All sizing via clamp(). No grey text. No banned colours.
// prefers-reduced-motion respected (disables shimmer animation).
//
// Existing features preserved: Yes — desktop rendering untouched.
// ============================================================================

'use client';

import React from 'react';

// ============================================================================
// TYPES
// ============================================================================

interface MobileBuilderGateProps {
  /** Page title shown in the gate */
  title: string;
  /** Short description of what this page does */
  description: string;
  /** 3-4 feature bullet points */
  features: string[];
  /** Optional provider name for provider-specific pages */
  providerName?: string;
  /** Desktop content — rendered on desktop AND as phantom preview on mobile */
  children: React.ReactNode;
}

// ============================================================================
// SHIMMER ANIMATION — Frosted glass sweep
// ============================================================================

const PHANTOM_STYLES = `
  @media (prefers-reduced-motion: no-preference) {
    @keyframes phantomShimmer {
      0% { transform: translateX(-100%) rotate(12deg); }
      100% { transform: translateX(200%) rotate(12deg); }
    }
    .phantom-shimmer {
      animation: phantomShimmer 4s ease-in-out infinite;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .phantom-shimmer { animation: none; }
  }
`;

// ============================================================================
// COMPONENT
// ============================================================================

export default function MobileBuilderGate({
  title,
  description,
  features,
  providerName,
  children,
}: MobileBuilderGateProps) {
  return (
    <>
      {/* ── MOBILE: PHANTOM SCROLL PREVIEW — <768px ──────────────── */}
      <div className="md:hidden" data-testid="mobile-builder-gate">
        <style dangerouslySetInnerHTML={{ __html: PHANTOM_STYLES }} />

        {/* Gate card — CTA sits above the phantom preview */}
        <div
          className="flex flex-col rounded-2xl border border-white/[0.08] bg-slate-950/70"
          style={{ padding: 'clamp(16px, 4vw, 24px)', gap: 'clamp(12px, 3vw, 16px)' }}
        >
          {/* Header */}
          <div className="text-center">
            <h2
              className="font-semibold"
              style={{ fontSize: 'clamp(1.1rem, 4.5vw, 1.4rem)' }}
            >
              <span className="bg-gradient-to-r from-sky-400 via-emerald-300 to-indigo-400 bg-clip-text text-transparent">
                {title}
              </span>
            </h2>
            {providerName && (
              <p
                className="mt-1 font-medium text-white"
                style={{ fontSize: 'clamp(0.85rem, 3.5vw, 1rem)' }}
              >
                {providerName}
              </p>
            )}
            <p
              className="mt-2 text-white/70"
              style={{ fontSize: 'clamp(0.78rem, 3vw, 0.9rem)', lineHeight: 1.5 }}
            >
              {description}
            </p>
          </div>

          {/* ── PHANTOM PREVIEW WINDOW ─────────────────────────────
              The REAL builder UI, scaled to 55%, non-interactive.
              Height-capped with overflow-y:auto so user can scroll
              through the frozen interface. Frosted glass on top. */}
          <div
            className="relative overflow-hidden rounded-xl border border-white/[0.06]"
            style={{ height: 'clamp(220px, 55vw, 320px)' }}
          >
            {/* Builder content — scaled down, non-interactive */}
            <div
              className="overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30"
              style={{
                height: '100%',
                pointerEvents: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
              }}
              aria-hidden="true"
              tabIndex={-1}
            >
              <div
                style={{
                  transform: 'scale(0.55)',
                  transformOrigin: 'top left',
                  width: '182%', /* 1/0.55 = 1.818 → content fills scaled container */
                }}
              >
                {children}
              </div>
            </div>

            {/* Frosted glass overlay */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: 'linear-gradient(180deg, rgba(2, 6, 23, 0.3) 0%, rgba(2, 6, 23, 0.5) 60%, rgba(2, 6, 23, 0.85) 100%)',
                backdropFilter: 'blur(2px)',
                WebkitBackdropFilter: 'blur(2px)',
              }}
            />

            {/* Shimmer sweep — subtle moving light across the glass */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div
                className="phantom-shimmer absolute inset-y-0"
                style={{
                  width: '40%',
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)',
                }}
              />
            </div>

            {/* "Preview" label */}
            <div
              className="absolute font-semibold text-white/50"
              style={{
                top: 'clamp(8px, 2vw, 12px)',
                right: 'clamp(8px, 2vw, 12px)',
                fontSize: 'clamp(0.6rem, 2.5vw, 0.7rem)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Preview
            </div>
          </div>

          {/* Feature highlights */}
          <div
            className="flex flex-col rounded-xl border border-white/[0.06] bg-white/[0.03]"
            style={{ padding: 'clamp(10px, 2.5vw, 16px)', gap: 'clamp(6px, 1.5vw, 10px)' }}
          >
            <p
              className="font-semibold text-sky-400"
              style={{ fontSize: 'clamp(0.7rem, 2.8vw, 0.8rem)' }}
            >
              What you get on desktop
            </p>
            {features.map((feature, i) => (
              <div
                key={i}
                className="flex items-start"
                style={{ gap: 'clamp(6px, 1.5vw, 10px)' }}
              >
                <span
                  className="shrink-0 text-emerald-400"
                  style={{ fontSize: 'clamp(0.65rem, 2.5vw, 0.8rem)', marginTop: '2px' }}
                >
                  ✦
                </span>
                <span
                  className="text-white"
                  style={{ fontSize: 'clamp(0.73rem, 2.8vw, 0.85rem)', lineHeight: 1.4 }}
                >
                  {feature}
                </span>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex flex-col items-stretch" style={{ gap: 'clamp(8px, 2vw, 12px)' }}>
            <a
              href="/pro-promagen"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-purple-500/70 bg-gradient-to-r from-purple-600/25 to-pink-600/25 font-semibold text-purple-100 shadow-sm transition-all hover:from-purple-600/35 hover:to-pink-600/35 hover:border-purple-400 cursor-pointer"
              style={{
                padding: 'clamp(10px, 2.5vw, 14px) clamp(16px, 4vw, 24px)',
                fontSize: 'clamp(0.85rem, 3.5vw, 0.95rem)',
              }}
            >
              <svg
                className="shrink-0"
                style={{ width: 'clamp(14px, 3.5vw, 18px)', height: 'clamp(14px, 3.5vw, 18px)' }}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              See what Pro unlocks
            </a>

            <p
              className="text-center text-white/50"
              style={{ fontSize: 'clamp(0.7rem, 2.8vw, 0.8rem)' }}
            >
              Open on desktop for the full builder
            </p>
          </div>
        </div>
      </div>

      {/* ── DESKTOP CONTENT — ≥768px ─────────────────────────────── */}
      <div className="hidden md:contents">
        {children}
      </div>
    </>
  );
}
