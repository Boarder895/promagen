// src/hooks/use-lab-gate.ts
// ============================================================================
// PROMPT LAB GATE — Daily Generation Limiter (v1.0.0)
// ============================================================================
// Tracks free-tier Prompt Lab usage: 1 generation per day.
// Pro users: unlimited. Anonymous: blocked (redirected to sign-in).
//
// Storage: localStorage with date-keyed counter.
//   Key: 'promagen:lab-gen:{YYYY-MM-DD}'
//   Value: number of generations used today
//
// Why localStorage (not server-side KV):
//   - Instant feedback — no round-trip to check quota
//   - The actual GPT cost gate is on the API routes (rate limiting)
//   - localStorage is per-browser, so a user could clear it — but that's
//     acceptable for 1 free gen/day (cost: $0.008). The friction of clearing
//     localStorage is higher than the cost of one extra generation.
//
// Authority: paid_tier.md §5.13, human-factors.md §8 (Loss Aversion)
// Existing features preserved: Yes
// ============================================================================

'use client';

import { useState, useCallback } from 'react';
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

/** Get today's date string in user's local timezone (YYYY-MM-DD) */
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Full localStorage key for today */
function storageKey(): string {
  return `${STORAGE_PREFIX}:${todayKey()}`;
}

/** Read today's usage count from localStorage */
function readUsage(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return 0;
    const n = parseInt(raw, 10);
    return isNaN(n) ? 0 : n;
  } catch {
    return 0;
  }
}

/** Write today's usage count to localStorage */
function writeUsage(count: number): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(), String(count));
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
  /** Whether Clerk has finished loading */
  isLoaded: boolean;
  /** Mark a generation as used — call this AFTER successful generation */
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
 */
export function useLabGate(): UseLabGateResult {
  const { isLoaded, isSignedIn } = useAuth();
  const { userTier } = usePromagenAuth();

  const isPro = userTier === 'paid';
  const isAuthenticated = isLoaded && isSignedIn === true;

  // ★ Initialize directly from localStorage (no useEffect race).
  // Previous version used useState(0) + useEffect → brief flash where
  // isExhausted=false, workspace renders, then effect fires and overlay
  // rips it away mid-interaction. Lazy initializer runs synchronously
  // on first render, so the correct state is available immediately.
  const [generationsUsed, setGenerationsUsed] = useState(() => readUsage());

  const isExhausted = !isPro && generationsUsed >= FREE_DAILY_LIMIT;
  const canGenerate = isAuthenticated && (isPro || !isExhausted);
  const remaining = isPro ? Infinity : Math.max(0, FREE_DAILY_LIMIT - generationsUsed);

  const markUsed = useCallback(() => {
    if (isPro) return; // Pro users don't consume quota
    const next = generationsUsed + 1;
    setGenerationsUsed(next);
    writeUsage(next);
  }, [isPro, generationsUsed]);

  return {
    canGenerate,
    generationsUsed,
    isExhausted,
    isPro,
    isAuthenticated,
    isLoaded,
    markUsed,
    remaining,
  };
}
