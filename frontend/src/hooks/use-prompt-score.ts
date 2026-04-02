// src/hooks/use-prompt-score.ts
// ============================================================================
// usePromptScore — Call 4 Scoring Hook
// ============================================================================
// Auto-fires after Call 3 completes (Pro users only).
// Three-layer duplicate prevention:
//   1. Exact-match cache (same prompt + platform = cached, zero API cost)
//   2. 3-second debounce (absorbs rapid edit→optimise flurries)
//   3. 30/hour server-side rate limit (abuse prevention — in route.ts)
//
// Authority: docs/authority/call4-chatgpt-review-v4.md
// Existing features preserved: Yes (new file).
// ============================================================================

'use client';

import { useState, useRef, useCallback } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface PromptScoreAxes {
  anchorPreservation: number;   // 0-30 raw
  platformFit: number;          // 0-25 raw
  visualSpecificity: number;    // 0-20 raw
  economyClarity: number;       // 0-15 raw
  negativeQuality: number | null; // 0-10 raw, or null when N/A
}

export interface PromptScoreResult {
  score: number;                // 0-100 normalised headline
  axes: PromptScoreAxes;
  directives: string[];         // 2-3 phrase-based improvements
  summary: string;
}

export interface ScoreRequestPayload {
  optimisedPrompt: string;
  humanText: string;
  assembledPrompt: string;
  negativePrompt?: string;
  platformId: string;
  platformName: string;
  tier: 1 | 2 | 3 | 4;
  promptStyle: 'keywords' | 'natural';
  maxChars: number;
  idealMin: number;
  idealMax: number;
  negativeSupport: 'separate' | 'inline' | 'none';
  call3Changes: string[];
  call3Mode: 'reorder_only' | 'format_only' | 'gpt_rewrite' | 'pass_through' | 'mj_deterministic';
  categoryRichness: Record<string, number>;
}

export interface UsePromptScoreReturn {
  result: PromptScoreResult | null;
  isScoring: boolean;
  error: string | null;
  score: (payload: ScoreRequestPayload) => void;
  clear: () => void;
}

// ============================================================================
// CACHE — Exact-match, session-scoped
// ============================================================================

/** Simple hash for cache keys — not cryptographic, just dedup */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return hash.toString(36);
}

function cacheKey(platformId: string, prompt: string): string {
  return `${platformId}:${simpleHash(prompt)}`;
}

/** Debounce delay after Call 3 before firing Call 4 (ms) */
const DEBOUNCE_MS = 3000;

// ============================================================================
// HOOK
// ============================================================================

export function usePromptScore(): UsePromptScoreReturn {
  const [result, setResult] = useState<PromptScoreResult | null>(null);
  const [isScoring, setIsScoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cacheRef = useRef<Map<string, PromptScoreResult>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const score = useCallback((payload: ScoreRequestPayload) => {
    // Cancel any pending debounce or in-flight request
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    // Check cache first
    const key = cacheKey(payload.platformId, payload.optimisedPrompt);
    const cached = cacheRef.current.get(key);
    if (cached) {
      setResult(cached);
      setIsScoring(false);
      setError(null);
      return;
    }

    // Show scoring state immediately (visual feedback)
    setIsScoring(true);
    setError(null);

    // Debounce the actual API call
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch('/api/score-prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({ error: 'Scoring failed' }));
          setError(errBody.error ?? `Scoring failed (${res.status})`);
          setIsScoring(false);
          return;
        }

        const data: PromptScoreResult = await res.json();
        cacheRef.current.set(key, data);
        setResult(data);
        setIsScoring(false);
        setError(null);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return; // cancelled — ignore
        setError('Scoring request failed');
        setIsScoring(false);
      }
    }, DEBOUNCE_MS);
  }, []);

  const clear = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
    setResult(null);
    setIsScoring(false);
    setError(null);
  }, []);

  return { result, isScoring, error, score, clear };
}
