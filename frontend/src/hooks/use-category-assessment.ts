// src/hooks/use-category-assessment.ts
// ============================================================================
// useCategoryAssessment — Prompt Lab v4 Phase 1 (Check)
// ============================================================================
// Calls POST /api/parse-sentence with mode: "assess".
// Returns a CoverageAssessment with per-category covered/confidence data.
//
// This hook is used ONLY by the Prompt Lab v4 flow. The standard builder
// continues to use useSentenceConversion (mode: "extract").
//
// Authority: prompt-lab-v4-flow.md §8, §13
// Non-regression rule #1: Call 2 NEVER fires during Phase 1.
// Non-regression rule #5: Call 1 only assesses raw human text (no side notes).
// ============================================================================

'use client';

import { useState, useCallback, useRef } from 'react';
import type { CoverageAssessment, PromptLabErrorType } from '@/types/category-assessment';

// ============================================================================
// TYPES
// ============================================================================

export interface CategoryAssessmentResult {
  /** The coverage assessment from Call 1, null until check completes */
  assessment: CoverageAssessment | null;
  /** Whether Call 1 is currently in flight */
  isChecking: boolean;
  /** Error state with type for UI routing */
  error: { type: PromptLabErrorType; message: string } | null;
  /** The text that was sent with the last assessment (for stale-check) */
  sentText: string | null;
  /** Trigger Call 1 assessment. Returns the assessment or null on failure. */
  assess: (sentence: string) => Promise<CoverageAssessment | null>;
  /** Clear all assessment state (for Clear All cascade) */
  clear: () => void;
}

// ============================================================================
// ERROR TYPE DETECTION
// ============================================================================

/**
 * Map API error codes to PromptLabErrorType for state machine routing.
 * §13: error.type determines user-facing message.
 */
function classifyError(
  status: number,
  errorCode: string | undefined,
): PromptLabErrorType {
  if (errorCode === 'CONTENT_POLICY') return 'content-policy';
  if (status === 429 || errorCode === 'RATE_LIMITED') return 'rate-limit';
  if (status === 0 || errorCode === 'NETWORK_ERROR') return 'network';
  return 'unknown';
}

// ============================================================================
// HOOK
// ============================================================================

export function useCategoryAssessment(): CategoryAssessmentResult {
  const [assessment, setAssessment] = useState<CoverageAssessment | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<{ type: PromptLabErrorType; message: string } | null>(null);
  const [sentText, setSentText] = useState<string | null>(null);

  // ── Abort controller for cancellation (Clear All, text edit during check) ──
  const abortRef = useRef<AbortController | null>(null);

  const assess = useCallback(async (sentence: string): Promise<CoverageAssessment | null> => {
    const trimmed = sentence.trim();

    // ── Client-side validation ──────────────────────────────────────
    if (!trimmed) {
      setError({ type: 'unknown', message: 'Please enter a description.' });
      return null;
    }
    if (trimmed.length > 1000) {
      setError({ type: 'unknown', message: 'Maximum 1,000 characters.' });
      return null;
    }

    // ── Cancel any in-flight request (§13 race condition: double-click) ──
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    // ── Set state to checking ───────────────────────────────────────
    setIsChecking(true);
    setError(null);
    setAssessment(null);
    setSentText(trimmed);

    try {
      const res = await fetch('/api/parse-sentence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentence: trimmed, mode: 'assess' }),
        signal: controller.signal,
      });

      // ── Handle error responses ──────────────────────────────────────
      if (!res.ok) {
        let data: { error?: string; message?: string } = {};
        try {
          data = await res.json();
        } catch {
          // Can't parse error body
        }

        const errorType = classifyError(res.status, data.error);
        const message = data.message ?? 'Failed to check your description. Please try again.';

        setError({ type: errorType, message });
        setIsChecking(false);
        abortRef.current = null;
        return null;
      }

      // ── Parse successful response ───────────────────────────────────
      const data = await res.json();
      const result = data.assessment as CoverageAssessment;

      if (!result || !result.coverage) {
        setError({ type: 'unknown', message: 'No assessment returned. Please try again.' });
        setIsChecking(false);
        abortRef.current = null;
        return null;
      }

      setAssessment(result);
      setIsChecking(false);
      abortRef.current = null;
      return result;
    } catch (err: unknown) {
      // ── Handle abort (not an error — user cancelled) ────────────────
      if (err instanceof DOMException && err.name === 'AbortError') {
        // Request was cancelled (Clear All, new request, text edit during check)
        // Don't set error state — the cancellation was intentional
        setIsChecking(false);
        abortRef.current = null;
        return null;
      }

      // ── Handle network errors ───────────────────────────────────────
      setError({ type: 'network', message: 'Connection failed. Please check your network and try again.' });
      setIsChecking(false);
      abortRef.current = null;
      return null;
    }
  }, []);

  const clear = useCallback(() => {
    // Cancel any in-flight request (§13: Clear All cancels everything)
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    setAssessment(null);
    setIsChecking(false);
    setError(null);
    setSentText(null);
  }, []);

  return { assessment, isChecking, error, sentText, assess, clear };
}
