// src/hooks/use-lab-gate.ts
// ============================================================================
// PROMPT LAB GATE — Daily Generation Limiter (v3.0.0)
// ============================================================================
// Tracks Prompt Lab usage per tier:
//   - Anonymous (not signed in): 1 generation per day
//   - Free (signed in):          2 generations per day
//   - Pro (paid):                unlimited
//
// v3.0.0 (4 Apr 2026): Open gate for anonymous users.
//   - Anonymous users get 1 free generation (browser-level localStorage)
//   - Free signed-in users get 2 generations (user-keyed localStorage)
//   - Pro: unlimited (unchanged)
//   - canGenerate no longer requires isAuthenticated
//
// v2.0.0 (30 Mar 2026): Three bug fixes (user-specific key, isReady, markUsed).
//
// Storage: localStorage with user+date-keyed counter.
//   Key: 'promagen:lab-gen:{userId|anon}:{YYYY-MM-DD}'
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

/** Anonymous (not signed in): 1 generation per day */
const ANON_DAILY_LIMIT = 1;

/** Free tier (signed in): 2 generations per day */
const FREE_DAILY_LIMIT = 2;

/** localStorage key prefix */
const STORAGE_PREFIX = 'promagen:lab-gen';

// ============================================================================
// HELPERS
// ============================================================================

/** Get today's date string (YYYY-MM-DD) */
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Full localStorage key for a specific user (or 'anon') today */
function storageKey(userIdOrAnon: string): string {
  return `${STORAGE_PREFIX}:${userIdOrAnon}:${todayKey()}`;
}

/** Read today's usage count from localStorage */
function readUsage(userIdOrAnon: string): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(storageKey(userIdOrAnon));
    if (!raw) return 0;
    const n = parseInt(raw, 10);
    return isNaN(n) ? 0 : n;
  } catch {
    return 0;
  }
}

/** Write today's usage count to localStorage */
function writeUsage(userIdOrAnon: string, count: number): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(userIdOrAnon), String(count));
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
  /** Whether user has exhausted their quota */
  isExhausted: boolean;
  /** Whether user is Pro (unlimited) */
  isPro: boolean;
  /** Whether user is signed in */
  isAuthenticated: boolean;
  /** Whether the gate has fully resolved (auth + usage read) */
  isReady: boolean;
  /** Mark a generation as used — call AFTER successful generation */
  markUsed: () => void;
  /** Remaining generations (0 when exhausted, Infinity for Pro) */
  remaining: number;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Gate for Prompt Lab generation.
 *
 * - Anonymous: canGenerate = true for 1 generation per day
 * - Free signed-in: canGenerate = true for 2 generations per day
 * - Pro: canGenerate = always true
 */
export function useLabGate(): UseLabGateResult {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { userTier } = usePromagenAuth();

  const isPro = userTier === 'paid';
  const isAuthenticated = isLoaded && isSignedIn === true;

  // Resolve the effective user key: real userId for signed-in, 'anon' otherwise
  const effectiveUserId = userId ?? 'anon';

  // Daily limit depends on auth state
  const dailyLimit = isPro ? Infinity : isAuthenticated ? FREE_DAILY_LIMIT : ANON_DAILY_LIMIT;

  const [generationsUsed, setGenerationsUsed] = useState(0);
  const [usageReady, setUsageReady] = useState(false);

  // ★ Read usage when auth resolves.
  // For anonymous: reads 'anon' key immediately once Clerk loads.
  // For signed-in: reads user-specific key once userId resolves.
  useEffect(() => {
    if (!isLoaded) return;

    if (userId) {
      // Signed-in user
      setGenerationsUsed(readUsage(userId));
      setUsageReady(true);
    } else if (!isSignedIn) {
      // Anonymous user
      setGenerationsUsed(readUsage('anon'));
      setUsageReady(true);
    }
  }, [userId, isLoaded, isSignedIn]);

  // Gate is ready when auth is loaded AND usage has been read
  const isReady = isLoaded && usageReady;

  const isExhausted = !isPro && generationsUsed >= dailyLimit;
  const canGenerate = isPro || !isExhausted;
  const remaining = isPro ? Infinity : Math.max(0, dailyLimit - generationsUsed);

  const markUsed = useCallback(() => {
    if (isPro) return; // Pro users don't consume quota
    const next = generationsUsed + 1;
    setGenerationsUsed(next);
    writeUsage(effectiveUserId, next);
  }, [isPro, effectiveUserId, generationsUsed]);

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
