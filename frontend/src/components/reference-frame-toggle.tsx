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

import { useCallback, useState } from 'react';
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

const TOOLTIP_USER_LOCATION = `📍 Your Location Reference

Stock exchanges are ordered east → west relative to YOUR current position.

• Exchanges to your east appear on the left
• Exchanges to your west appear on the right

This gives you a personalised view of global markets based on where you are in the world.`;

const TOOLTIP_GREENWICH = `🌐 Greenwich Meridian Reference

Stock exchanges are ordered east → west relative to the Greenwich Meridian (0° longitude).

The Greenwich Meridian is an imaginary line running from the North Pole to the South Pole through Greenwich, London. It's the global standard for measuring longitude and time zones.

• Exchanges east of London appear on the left (Asia, Australia)
• Exchanges west of London appear on the right (Americas)

This provides a consistent, universal view regardless of your location.`;

const TOOLTIP_PRO_FEATURE_ANONYMOUS = `\n\n────────────────────────
🔒 Pro Promagen Feature
Sign in to unlock geographic personalisation.`;

const TOOLTIP_PRO_FEATURE_FREE = `\n\n────────────────────────
🔒 Pro Promagen Feature
Upgrade to Pro Promagen to toggle between your location and the Greenwich Meridian.`;

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

  const [showTooltip, setShowTooltip] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

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
  const currentLabel = isUserFrame ? locationLabel : 'Greenwich Meridian';

  // Build tooltip content based on user state
  let tooltipContent = isUserFrame ? TOOLTIP_USER_LOCATION : TOOLTIP_GREENWICH;
  if (!isAuthenticated) {
    tooltipContent += TOOLTIP_PRO_FEATURE_ANONYMOUS;
  } else if (!isPaidUser) {
    tooltipContent += TOOLTIP_PRO_FEATURE_FREE;
  }

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
    inline-flex items-center justify-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium shadow-sm transition-all
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
      aria-label={`Exchange reference frame: ${currentLabel}. ${
        isLocked ? 'Pro Promagen feature.' : 'Click to toggle.'
      }`}
      aria-describedby="reference-frame-tooltip"
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
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => {
          setShowTooltip(false);
          setShowUpgradePrompt(false);
        }}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => {
          setShowTooltip(false);
          setShowUpgradePrompt(false);
        }}
      >
        {/* Wrap in SignInButton for anonymous users */}
        {!isAuthenticated ? <SignInButton mode="modal">{toggleButton}</SignInButton> : toggleButton}

        {/* Tooltip */}
        {showTooltip && !showUpgradePrompt && (
          <div
            id="reference-frame-tooltip"
            role="tooltip"
            className="absolute left-0 top-full z-50 mt-2 w-80 rounded-lg border border-slate-700 bg-slate-800/95 p-3 text-xs text-slate-200 shadow-xl backdrop-blur-sm"
          >
            {/* Tooltip arrow */}
            <div className="absolute -top-1.5 left-4 h-3 w-3 rotate-45 border-l border-t border-slate-700 bg-slate-800/95" />

            {/* Tooltip content */}
            <div className="relative whitespace-pre-line leading-relaxed text-slate-300">
              {tooltipContent}
            </div>

            {/* Click instruction */}
            <p className="mt-2 text-[10px] text-slate-500">
              {isPaidUser
                ? 'Click to switch reference frame'
                : isAuthenticated
                ? 'Click to learn about Pro Promagen'
                : 'Sign in to unlock this feature'}
            </p>
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

              <p className="mb-3 text-xs text-slate-300">
                Unlock the reference frame toggle and personalise your market view.
              </p>

              <div className="mb-3 space-y-1.5 text-xs text-slate-400">
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
