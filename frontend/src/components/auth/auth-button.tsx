// src/components/auth/auth-button.tsx
//
// Authentication button for site header.
// Shows "Sign in" when logged out, user avatar when logged in.
//
// FIXES:
// - Timeout fallback when Clerk fails to load
// - Sign-out button disappearing
// - Facebook OAuth #_=_ hash cleanup
// - Post-OAuth "Loading..." stuck - direct client state check + auto-reload

'use client';

import { useEffect, useState, useCallback } from 'react';
import { SignInButton, UserButton, useClerk } from '@clerk/nextjs';

// Timeout in ms before showing Sign In button even if Clerk hasn't loaded
const CLERK_LOAD_TIMEOUT_MS = 3000;
// How often to poll for session state changes (ms)
const SESSION_POLL_INTERVAL_MS = 500;
// Max time to poll before giving up (ms)
const MAX_POLL_TIME_MS = 5000;

// Icon components with display names
function UserIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}

function LoadingIcon() {
  return (
    <svg className="h-4 w-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}

// Shared styles
const signInButtonStyles =
  'inline-flex items-center justify-center gap-2 rounded-full border border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 px-4 py-1.5 text-sm font-medium text-purple-100 shadow-sm transition-all hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400 focus-visible:outline-none focus-visible:ring focus-visible:ring-purple-400/80';

const loadingButtonStyles =
  'inline-flex items-center justify-center gap-2 rounded-full border border-slate-500/50 bg-slate-800/50 px-4 py-1.5 text-sm font-medium text-slate-400 opacity-50';

/**
 * AuthButton - Adaptive authentication UI
 * 
 * Uses direct Clerk client state checking to avoid hook synchronization issues
 * that can occur after OAuth redirects.
 */
export function AuthButton() {
  const clerk = useClerk();
  
  const [mounted, setMounted] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [sessionState, setSessionState] = useState<'loading' | 'signed-in' | 'signed-out'>('loading');
  const [pollCount, setPollCount] = useState(0);

  // Clean up OAuth hash fragments
  const cleanupOAuthHash = useCallback(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash === '#_=_' || hash === '#') {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
  }, []);

  // Check session state directly from Clerk client
  const checkSessionState = useCallback((): 'loading' | 'signed-in' | 'signed-out' => {
    if (!clerk.loaded) return 'loading';
    
    // Direct check on clerk client
    if (clerk.user) return 'signed-in';
    if (clerk.session) return 'signed-in';
    
    return 'signed-out';
  }, [clerk]);

  // Initial mount
  useEffect(() => {
    setMounted(true);
    cleanupOAuthHash();
  }, [cleanupOAuthHash]);

  // Poll for session state changes after OAuth redirect
  useEffect(() => {
    if (!mounted) return;

    const pollSession = () => {
      const state = checkSessionState();
      setSessionState(state);
      
      // If still loading, continue polling
      if (state === 'loading') {
        setPollCount(c => c + 1);
      }
    };

    // Initial check
    pollSession();

    // Set up polling interval
    const interval = setInterval(() => {
      if (pollCount * SESSION_POLL_INTERVAL_MS < MAX_POLL_TIME_MS) {
        pollSession();
      }
    }, SESSION_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [mounted, checkSessionState, pollCount]);

  // Update session state when clerk changes
  useEffect(() => {
    if (clerk.loaded) {
      const state = checkSessionState();
      setSessionState(state);
      cleanupOAuthHash();
    }
  }, [clerk.loaded, clerk.user, clerk.session, checkSessionState, cleanupOAuthHash]);

  // Listen for Clerk events
  useEffect(() => {
    if (!clerk.loaded) return;

    const unsubscribe = clerk.addListener(() => {
      const state = checkSessionState();
      setSessionState(state);
      cleanupOAuthHash();
    });

    return () => unsubscribe();
  }, [clerk, checkSessionState, cleanupOAuthHash]);

  // Timeout fallback
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (sessionState === 'loading') {
        console.warn('[AuthButton] Clerk did not load within timeout');
        setTimedOut(true);
      }
    }, CLERK_LOAD_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [sessionState]);

  // Nuclear option: If we detect a stuck state, force reload once
  useEffect(() => {
    if (!mounted || sessionState !== 'loading') return;

    const stuckTimer = setTimeout(() => {
      // Check if we have session cookies but still showing loading
      const hasCookie = typeof document !== 'undefined' && 
        (document.cookie.includes('__session') || 
         document.cookie.includes('__client') ||
         document.cookie.includes('__clerk'));
      
      const alreadyReloaded = typeof sessionStorage !== 'undefined' && 
        sessionStorage.getItem('clerk_auth_reload');

      if (hasCookie && !alreadyReloaded) {
        console.warn('[AuthButton] Detected stuck state with session cookie - reloading');
        sessionStorage.setItem('clerk_auth_reload', Date.now().toString());
        window.location.reload();
      }
    }, 3000);

    return () => clearTimeout(stuckTimer);
  }, [mounted, sessionState]);

  // Clear reload flag when successfully loaded
  useEffect(() => {
    if (sessionState !== 'loading' && typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('clerk_auth_reload');
    }
  }, [sessionState]);

  // ─────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────

  // Not mounted yet (SSR)
  if (!mounted) {
    return (
      <button type="button" disabled className={loadingButtonStyles}>
        <LoadingIcon />
        Loading...
      </button>
    );
  }

  // Timed out - show fallback link
  if (timedOut && sessionState === 'loading') {
    return (
      <a href="/sign-in" className={signInButtonStyles}>
        <UserIcon />
        Sign in
      </a>
    );
  }

  // Still loading
  if (sessionState === 'loading') {
    return (
      <button type="button" disabled className={loadingButtonStyles}>
        <LoadingIcon />
        Loading...
      </button>
    );
  }

  // Signed in - show avatar
  if (sessionState === 'signed-in') {
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

  // Signed out - show sign in button
  return (
    <SignInButton mode="modal">
      <button type="button" className={signInButtonStyles}>
        <UserIcon />
        Sign in
      </button>
    </SignInButton>
  );
}

export default AuthButton;
