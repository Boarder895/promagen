// src/components/auth/auth-button.tsx
//
// Authentication button for site header.
// Shows "Sign in" when logged out, user avatar when logged in.
// Styled to match the Randomise button (purple-pink gradient).
//
// FIXED: Added timeout fallback when Clerk fails to load (e.g., prod keys on localhost)

'use client';

import { useEffect, useState } from 'react';
import { SignInButton, SignedIn, SignedOut, UserButton, useClerk } from '@clerk/nextjs';

// Timeout in ms before showing Sign In button even if Clerk hasn't loaded
const CLERK_LOAD_TIMEOUT_MS = 3000;

/**
 * AuthButton - Adaptive authentication UI
 *
 * Logged out: Shows a "Sign in" button styled to match Randomise button
 * Logged in: Shows Clerk's UserButton (avatar with dropdown menu)
 *
 * NEW: If Clerk doesn't load within 3 seconds (e.g., wrong keys for domain),
 * shows Sign In button anyway with link to /sign-in page.
 */
export function AuthButton() {
  const { loaded } = useClerk();
  const [mounted, setMounted] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Fallback timeout - if Clerk doesn't load in 3s, show button anyway
    const timeout = setTimeout(() => {
      if (!loaded) {
        console.warn('[AuthButton] Clerk did not load within timeout, showing fallback button');
        setTimedOut(true);
      }
    }, CLERK_LOAD_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [loaded]);

  // Clear timeout flag if Clerk eventually loads
  useEffect(() => {
    if (loaded && timedOut) {
      setTimedOut(false);
    }
  }, [loaded, timedOut]);

  // Not yet mounted on client
  if (!mounted) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-500/50 bg-slate-800/50 px-4 py-1.5 text-sm font-medium text-slate-400 opacity-50"
      >
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
        Loading...
      </button>
    );
  }

  // Clerk hasn't loaded but we've timed out - show fallback Sign In link
  if (!loaded && timedOut) {
    return (
      <a
        href="/sign-in"
        className="inline-flex items-center justify-center gap-2 rounded-full border border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 px-4 py-1.5 text-sm font-medium text-purple-100 shadow-sm transition-all hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400 focus-visible:outline-none focus-visible:ring focus-visible:ring-purple-400/80"
      >
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
        Sign in
      </a>
    );
  }

  // Clerk still loading and not timed out yet - show loading
  if (!loaded) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-500/50 bg-slate-800/50 px-4 py-1.5 text-sm font-medium text-slate-400 opacity-50"
      >
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
        Loading...
      </button>
    );
  }

  // Clerk loaded successfully - show normal auth states
  return (
    <>
      {/* Logged out state */}
      <SignedOut>
        <SignInButton mode="modal">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 px-4 py-1.5 text-sm font-medium text-purple-100 shadow-sm transition-all hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400 focus-visible:outline-none focus-visible:ring focus-visible:ring-purple-400/80"
          >
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
            Sign in
          </button>
        </SignInButton>
      </SignedOut>

      {/* Logged in state */}
      <SignedIn>
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
      </SignedIn>
    </>
  );
}

export default AuthButton;
