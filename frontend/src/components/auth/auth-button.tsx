// src/components/auth/auth-button.tsx
//
// Authentication button for site header.
// Shows "Sign in" when logged out, user avatar when logged in.
// Styled to match the Randomise button (purple-pink gradient).
//
// FIXES:
// - Timeout fallback when Clerk fails to load (prod keys on localhost)
// - Sign-out button disappearing - uses useUser() for reliable state
// - Facebook OAuth #_=_ hash cleanup
// - Post-OAuth "Loading..." stuck state - uses useUser() + session detection

'use client';

import { useEffect, useState, useCallback } from 'react';
import { SignInButton, UserButton, useUser, useClerk } from '@clerk/nextjs';

// Timeout in ms before showing Sign In button even if Clerk hasn't loaded
const CLERK_LOAD_TIMEOUT_MS = 3000;

/**
 * AuthButton - Adaptive authentication UI
 *
 * Logged out: Shows a "Sign in" button styled to match Randomise button
 * Logged in: Shows Clerk's UserButton (avatar with dropdown menu)
 */
export function AuthButton() {
  const clerk = useClerk();
  const { isLoaded, isSignedIn, user } = useUser();
  const [mounted, setMounted] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  // Clean up Facebook's #_=_ hash fragment
  const cleanupOAuthHash = useCallback(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash === '#_=_' || hash === '#') {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    cleanupOAuthHash();

    // Fallback timeout - if Clerk doesn't load in 3s, show button anyway
    const timeout = setTimeout(() => {
      if (!isLoaded && !clerk.loaded) {
        console.warn('[AuthButton] Clerk did not load within timeout, showing fallback button');
        setTimedOut(true);
      }
    }, CLERK_LOAD_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [isLoaded, clerk.loaded, cleanupOAuthHash]);

  // Clear timeout flag if Clerk eventually loads
  useEffect(() => {
    if (isLoaded && timedOut) {
      setTimedOut(false);
    }
  }, [isLoaded, timedOut]);

  // Also clean hash when user state changes (post-OAuth)
  useEffect(() => {
    if (isSignedIn) {
      cleanupOAuthHash();
    }
  }, [isSignedIn, cleanupOAuthHash]);

  // Shared styles
  const signInButtonStyles =
    'inline-flex items-center justify-center gap-2 rounded-full border border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 px-4 py-1.5 text-sm font-medium text-purple-100 shadow-sm transition-all hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400 focus-visible:outline-none focus-visible:ring focus-visible:ring-purple-400/80';

  const loadingButtonStyles =
    'inline-flex items-center justify-center gap-2 rounded-full border border-slate-500/50 bg-slate-800/50 px-4 py-1.5 text-sm font-medium text-slate-400 opacity-50';

  const UserIcon = () => (
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
        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
      />
    </svg>
  );

  const LoadingIcon = () => (
    <svg
      className="h-4 w-4 animate-pulse"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
      />
    </svg>
  );

  // ─────────────────────────────────────────────────────────────────
  // RENDER STATES
  // ─────────────────────────────────────────────────────────────────

  // 1. Not yet mounted on client - show loading placeholder
  if (!mounted) {
    return (
      <button type="button" disabled className={loadingButtonStyles}>
        <LoadingIcon />
        Loading...
      </button>
    );
  }

  // 2. Clerk hasn't loaded but we've timed out - show fallback Sign In link
  if (!isLoaded && timedOut) {
    return (
      <a href="/sign-in" className={signInButtonStyles}>
        <UserIcon />
        Sign in
      </a>
    );
  }

  // 3. Clerk still loading and not timed out yet - show loading
  //    BUT: If we already have a user object, skip to signed-in state
  //    This handles the OAuth redirect case where user exists before isLoaded=true
  if (!isLoaded && !user) {
    return (
      <button type="button" disabled className={loadingButtonStyles}>
        <LoadingIcon />
        Loading...
      </button>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // CLERK LOADED (or user already available) - Show appropriate state
  // ─────────────────────────────────────────────────────────────────

  // 4. User is signed in - show avatar
  //    Check both isSignedIn AND user object for robustness
  if (isSignedIn || user) {
    return (
      <UserButton
        appearance={{
          elements: {
            avatarBox: 'h-8 w-8 ring-2 ring-purple-500/50 hover:ring-purple-400',
            userButtonPopoverCard: 'bg-slate-900 border border-slate-800',
            userButtonPopoverActionButton: 'text-slate-300 hover:bg-slate-800',
            userButtonPopoverActionButtonText: 'text-slate-300',
            userButtonPopoverActionButtonIcon: 'text-slate-400',
            userButtonPopoverFooter: 'hidden',
          },
        }}
        afterSignOutUrl="/"
      />
    );
  }

  // 5. User is signed out - show Sign In button
  return (
    <SignInButton mode="modal" forceRedirectUrl="/">
      <button type="button" className={signInButtonStyles}>
        <UserIcon />
        Sign in
      </button>
    </SignInButton>
  );
}

export default AuthButton;
