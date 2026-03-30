// src/hooks/use-lab-gate.ts
// ============================================================================
// PROMPT LAB GATE — Daily Generation Limiter (v2.0.0)
// ============================================================================
// Tracks free-tier Prompt Lab usage: 1 generation per day.
// Pro users: unlimited. Anonymous: blocked (redirected to sign-in).
//
// v2.0.0 (30 Mar 2026): Three bug fixes:
//   1. Key is now USER-SPECIFIC: `promagen:lab-gen:{userId}:{date}`
//      Previously browser-global — a second account on the same browser
//      inherited the first account's counter. New account = locked out.
//   2. Added `isReady` flag — render gates on this to prevent flash
//      between "auth loaded" and "usage read" states.
//   3. Removed immediate markUsed from generate handler. Workspace now
//      calls markUsed via useEffect AFTER successful generation.
//
// Storage: localStorage with user+date-keyed counter.
//   Key: 'promagen:lab-gen:{userId}:{YYYY-MM-DD}'
//   Value: number of generations used today
//
// Authority: paid_tier.md §5.13, human-factors.md §8 (Loss Aversion)
// Existing features preserved: Yes
// ============================================================================

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { usePromagenAuth } from '@/hooks/use-promagen-auth';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Free tier: 1 generation per day */
const FREE_DAILY_LIMIT = 1;

/** localStorage key prefix */
const STORAGE_PREFIX = 'promagen:lab-gen';

// ============================================================================
// HELPERS
// ============================================================================

/** Get today's date string (YYYY-MM-DD) */
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Full localStorage key for a specific user today */
function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}:${todayKey()}`;
}

/** Read today's usage count from localStorage for a specific user */
function readUsage(userId: string): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return 0;
    const n = parseInt(raw, 10);
    return isNaN(n) ? 0 : n;
  } catch {
    return 0;
  }
}

/** Write today's usage count to localStorage for a specific user */
function writeUsage(userId: string, count: number): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(userId), String(count));
  } catch {
    // Storage full or blocked — silent
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface UseLabGateResult {
  /** Whether the user can generate right now */
  canGenerate: boolean;
  /** Number of generations used today */
  generationsUsed: number;
  /** Whether user has exhausted their free quota (only relevant for free tier) */
  isExhausted: boolean;
  /** Whether user is Pro (unlimited) */
  isPro: boolean;
  /** Whether user is signed in */
  isAuthenticated: boolean;
  /** Whether the gate has fully resolved (auth + usage read) */
  isReady: boolean;
  /** Mark a generation as used — call AFTER successful generation */
  markUsed: () => void;
  /** Remaining generations for free users (0 when exhausted, Infinity for Pro) */
  remaining: number;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Gate for Prompt Lab generation.
 *
 * - Anonymous: canGenerate = false (must sign in)
 * - Free signed-in: canGenerate = true for first generation, false after
 * - Pro: canGenerate = always true
 *
 * The hook is not "ready" until both Clerk auth AND the user-specific
 * localStorage read have completed. Consumers should render null until
 * isReady is true — this prevents flash between loading states.
 */
export function useLabGate(): UseLabGateResult {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { userTier } = usePromagenAuth();

  const isPro = userTier === 'paid';
  const isAuthenticated = isLoaded && isSignedIn === true;

  const [generationsUsed, setGenerationsUsed] = useState(0);
  const [usageReady, setUsageReady] = useState(false);

  // ★ Read user-specific usage when userId resolves.
  // This fires once when Clerk loads, and never again (userId is stable).
  // The usageReady flag prevents the workspace from rendering before
  // we've read the correct counter — no flash, no race.
  useEffect(() => {
    if (userId) {
      setGenerationsUsed(readUsage(userId));
      setUsageReady(true);
    } else if (isLoaded && !isSignedIn) {
      // Anonymous user — no usage to read, but mark as ready
      setUsageReady(true);
    }
  }, [userId, isLoaded, isSignedIn]);

  // Gate is ready when auth is loaded AND usage has been read
  const isReady = isLoaded && usageReady;

  const isExhausted = !isPro && generationsUsed >= FREE_DAILY_LIMIT;
  const canGenerate = isAuthenticated && (isPro || !isExhausted);
  const remaining = isPro ? Infinity : Math.max(0, FREE_DAILY_LIMIT - generationsUsed);

  const markUsed = useCallback(() => {
    if (isPro) return; // Pro users don't consume quota
    if (!userId) return; // Safety — should never happen when authenticated
    const next = generationsUsed + 1;
    setGenerationsUsed(next);
    writeUsage(userId, next);
  }, [isPro, userId, generationsUsed]);

  return {
    canGenerate,
    generationsUsed,
    isExhausted,
    isPro,
    isAuthenticated,
    isReady,
    markUsed,
    remaining,
  };
}
