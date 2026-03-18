// src/components/reference-frame-toggle.tsx
// ============================================================================
// REFERENCE FRAME TOGGLE
// ============================================================================
// Toggle for switching between location-relative and Greenwich Meridian
// reference frames for exchange ordering.
//
// Visibility: ALWAYS VISIBLE
// - Anonymous: Disabled + lock icon → Sign in on click
// - Free signed-in: Disabled + lock icon → Upgrade prompt on click
// - Pro Promagen (paid): Fully functional toggle
//
// Styled to mirror the Sign In button (purple-pink gradient).
//
// Authority: docs/authority/paid_tier.md §5.2
// ============================================================================

'use client';

import { useCallback, useState, useRef, useEffect } from 'react';
import { SignInButton } from '@clerk/nextjs';
import type { ReferenceFrame } from '@/lib/location';

// ============================================================================
// TYPES
// ============================================================================

export interface ReferenceFrameToggleProps {
  /** Current reference frame */
  referenceFrame: ReferenceFrame;
  /** Callback when reference frame changes */
  onReferenceFrameChange: (frame: ReferenceFrame) => void;
  /** Whether user is paid tier (Pro Promagen) */
  isPaidUser: boolean;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Whether location is loading */
  isLocationLoading?: boolean;
  /** User's city name (if detected) */
  cityName?: string;
  /** Disabled state (additional) */
  disabled?: boolean;
}

// ============================================================================
// TOOLTIP CONTENT
// ============================================================================

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * ReferenceFrameToggle - Switch between "My Location" and "Greenwich Meridian" reference.
 *
 * Always visible to all users. Only functional for Pro Promagen users.
 * Styled to mirror the Sign In button (purple-pink gradient, same height).
 */
export function ReferenceFrameToggle({
  referenceFrame,
  onReferenceFrameChange,
  isPaidUser,
  isAuthenticated,
  isLocationLoading = false,
  cityName,
  disabled = false,
}: ReferenceFrameToggleProps) {
  // ============================================================================
  // HOOKS
  // ============================================================================

  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [showGreenwichInfo, setShowGreenwichInfo] = useState(false);
  const greenwichTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Greenwich tooltip: 400ms close delay (matches weather/commodity tooltips)
  const handleGreenwichEnter = useCallback(() => {
    if (greenwichTimerRef.current) clearTimeout(greenwichTimerRef.current);
    setShowGreenwichInfo(true);
  }, []);
  const handleGreenwichLeave = useCallback(() => {
    greenwichTimerRef.current = setTimeout(() => setShowGreenwichInfo(false), 400);
  }, []);
  useEffect(() => () => { if (greenwichTimerRef.current) clearTimeout(greenwichTimerRef.current); }, []);

  // Handle toggle click - only works for Pro users
  const handleToggle = useCallback(() => {
    if (disabled || isLocationLoading) return;

    // Pro users: toggle works
    if (isPaidUser) {
      const newFrame: ReferenceFrame = referenceFrame === 'user' ? 'greenwich' : 'user';
      onReferenceFrameChange(newFrame);
      return;
    }

    // Free signed-in users: show upgrade prompt
    if (isAuthenticated && !isPaidUser) {
      setShowUpgradePrompt(true);
      // Auto-hide after 3 seconds
      setTimeout(() => setShowUpgradePrompt(false), 3000);
    }

    // Anonymous users: handled by SignInButton wrapper
  }, [
    referenceFrame,
    onReferenceFrameChange,
    disabled,
    isLocationLoading,
    isPaidUser,
    isAuthenticated,
  ]);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const isUserFrame = referenceFrame === 'user';
  const locationLabel = cityName || 'My Location';
  const currentLabel = isUserFrame ? locationLabel : 'Greenwich';

  // Determine if toggle is locked (non-functional)
  const isLocked = !isPaidUser;

  // ============================================================================
  // BUTTON STYLING - Mirrors Sign In button exactly
  // ============================================================================

  // Base classes matching Sign In button
  // Cursor logic:
  // - disabled/loading → cursor-not-allowed (greyed out)
  // - locked (non-paid) → cursor-default (shows tooltip on hover, not clickable)
  // - paid user → cursor-pointer (fully interactive)
  const getCursorClass = () => {
    if (disabled || isLocationLoading) return 'opacity-50 cursor-not-allowed';
    if (isLocked) return 'cursor-default';
    return 'cursor-pointer';
  };

  const buttonClasses = `
    inline-flex items-center justify-center gap-2 rounded-full border px-4 py-1.5 font-medium shadow-sm transition-all
    focus-visible:outline-none focus-visible:ring focus-visible:ring-purple-400/80
    border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-purple-100
    hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400
    ${getCursorClass()}
  `;

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const toggleButton = (
    <button
      type="button"
      onClick={handleToggle}
      disabled={disabled || isLocationLoading}
      className={buttonClasses}
      style={{ fontSize: 'clamp(0.4rem, 0.5vw, 0.8rem)' }}
      aria-label={`Exchange reference frame: ${currentLabel}. ${
        isLocked ? 'Pro Promagen feature.' : 'Click to toggle.'
      }`}
    >
      {/* Globe icon - matches Sign In user icon style */}
      <svg
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
        />
      </svg>

      {/* Label */}
      <span className="max-w-[140px] truncate">
        {isLocationLoading ? 'Detecting...' : currentLabel}
      </span>

      {/* Lock icon for non-Pro users OR toggle arrows for Pro users */}
      {isLocked ? (
        <svg
          className="h-4 w-4 text-purple-300/70"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      ) : (
        <svg
          className="h-4 w-4 text-purple-300/70"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 9l4-4 4 4m0 6l-4 4-4-4"
          />
        </svg>
      )}
    </button>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="relative">
      {/* Toggle button with tooltip trigger */}
      <div
        className="relative"
        onMouseEnter={handleGreenwichEnter}
        onMouseLeave={handleGreenwichLeave}
      >
        {/* Wrap in SignInButton for anonymous users */}
        {!isAuthenticated ? <SignInButton mode="modal">{toggleButton}</SignInButton> : toggleButton}

        {/* Greenwich educational tooltip — 400ms close delay, solid bg, matches weather/commodity tooltip style */}
        {showGreenwichInfo && !showUpgradePrompt && (
          <div
            role="tooltip"
            className="absolute left-0 top-full z-50 mt-2 rounded-lg border border-purple-500/30 shadow-xl"
            style={{
              width: 'clamp(260px, 22vw, 340px)',
              background: 'rgba(15, 23, 42, 0.97)',
              backdropFilter: 'blur(12px)',
              padding: 'clamp(12px, 1.2vw, 18px)',
            }}
            onMouseEnter={handleGreenwichEnter}
            onMouseLeave={handleGreenwichLeave}
          >
            {/* Arrow */}
            <div
              className="absolute -top-1.5 left-4 h-3 w-3 rotate-45 border-l border-t border-purple-500/30"
              style={{ background: 'rgba(15, 23, 42, 0.97)' }}
            />

            <div className="relative" style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(8px, 0.8vw, 12px)' }}>
              {/* Header */}
              <div className="flex items-center" style={{ gap: 'clamp(6px, 0.6vw, 10px)' }}>
                <span style={{ fontSize: 'clamp(1rem, 1.2vw, 1.4rem)' }}>🌍</span>
                <span className="font-semibold text-white" style={{ fontSize: 'clamp(0.75rem, 0.85vw, 0.95rem)' }}>
                  Greenwich Meridian
                </span>
              </div>

              {/* Educational text */}
              <p className="text-white leading-relaxed" style={{ fontSize: 'clamp(0.65rem, 0.7vw, 0.8rem)' }}>
                The Greenwich Meridian (0° longitude) in London is the global reference line for timezones.
                Every timezone on Earth is measured as hours ahead or behind Greenwich.
              </p>

              {/* Why it matters for Promagen */}
              <div
                className="rounded-lg"
                style={{
                  background: 'rgba(139, 92, 246, 0.1)',
                  border: '1px solid rgba(139, 92, 246, 0.2)',
                  padding: 'clamp(8px, 0.8vw, 12px)',
                }}
              >
                <p className="font-medium text-purple-300" style={{ fontSize: 'clamp(0.65rem, 0.7vw, 0.8rem)', marginBottom: 'clamp(4px, 0.4vw, 6px)' }}>
                  Why this matters for your prompts
                </p>
                <p className="text-white leading-relaxed" style={{ fontSize: 'clamp(0.6rem, 0.65vw, 0.75rem)' }}>
                  Promagen orders exchanges east to west — following the sun across the globe.
                  Morning light in Tokyo, golden hour in London, sunset in New York.
                  Each exchange feeds real weather and time into your prompts.
                </p>
              </div>

              {/* Pro teaser */}
              {isPaidUser ? (
                <div className="flex items-center" style={{ gap: 'clamp(4px, 0.4vw, 6px)' }}>
                  <span className="text-emerald-400" style={{ fontSize: 'clamp(0.6rem, 0.65vw, 0.75rem)' }}>✓</span>
                  <span className="text-emerald-400 font-medium" style={{ fontSize: 'clamp(0.6rem, 0.65vw, 0.75rem)' }}>
                    Toggle to recentre exchanges around {cityName || 'your location'}
                  </span>
                </div>
              ) : (
                <div className="flex items-center" style={{ gap: 'clamp(4px, 0.4vw, 6px)' }}>
                  <span style={{ fontSize: 'clamp(0.6rem, 0.65vw, 0.75rem)' }}>🔒</span>
                  <span className="text-amber-400 font-medium" style={{ fontSize: 'clamp(0.6rem, 0.65vw, 0.75rem)' }}>
                    Pro: Recentre exchanges around your location
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Upgrade prompt (for free signed-in users) */}
        {showUpgradePrompt && isAuthenticated && !isPaidUser && (
          <div
            role="alert"
            className="absolute left-0 top-full z-50 mt-2 w-72 rounded-lg border border-purple-500/30 bg-slate-800/95 p-4 shadow-xl backdrop-blur-sm"
          >
            {/* Arrow */}
            <div className="absolute -top-1.5 left-4 h-3 w-3 rotate-45 border-l border-t border-purple-500/30 bg-slate-800/95" />

            {/* Content */}
            <div className="relative">
              <p className="mb-2 text-sm font-semibold text-purple-200">Pro Promagen Feature</p>

              <p className="mb-3 text-xs text-white">
                Unlock the reference frame toggle and personalise your market view.
              </p>

              <div className="mb-3 space-y-1.5 text-xs text-white">
                <div className="flex items-center gap-2">
                  <svg
                    className="h-3.5 w-3.5 text-emerald-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>Toggle between your location & Greenwich</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg
                    className="h-3.5 w-3.5 text-emerald-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>Unlimited daily prompts</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg
                    className="h-3.5 w-3.5 text-emerald-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>1.5× vote weight on leaderboard</span>
                </div>
              </div>

              <button
                type="button"
                className="w-full rounded-full border border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 px-4 py-2 text-sm font-semibold text-purple-100 shadow-sm transition-all hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400 focus-visible:outline-none focus-visible:ring focus-visible:ring-purple-400/80"
                onClick={() => {
                  // TODO: Navigate to upgrade page or open upgrade modal
                  setShowUpgradePrompt(false);
                }}
              >
                Upgrade to Pro Promagen
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ReferenceFrameToggle;
