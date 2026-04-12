// src/hooks/use-category-assessment.ts
// ============================================================================
// useCategoryAssessment — Call 1 Coverage + Matched Phrases v1.1.0
// ============================================================================
// v1.1.0 (13 Apr 2026): Phase A documentation
//   - Documented downstream accessibility for coverageSeed wiring
//   - assessment.coverage is the canonical state owner for matchedPhrases
//   - Downstream consumers (Call 2, Call T2) access via buildCoverageSeed()
//   - No code changes — hook already stores and exposes everything needed
//
// Calls POST /api/parse-sentence with mode: "assess".
// Returns per-category coverage (covered/not) with matched phrases from
// the user's text. Used for text colouring and category coverage pills.
//
// STATE OWNERSHIP:
//   assessment (CoverageAssessment | null) — owned here, exposed to consumers.
//   Downstream path: playground-workspace reads assessment via this hook,
//   converts to CoverageSeed[] via buildCoverageSeed(), passes to
//   generateTiers() which forwards to generate-tier-prompts/route.ts.
//
// This hook is used ONLY by the Prompt Lab. The standard builder
// continues to use useSentenceConversion (mode: "extract").
//
// Security: No "AI", "GPT", "OpenAI" in any client-facing string.
// Authority: prompt-lab.md, prompt-lab-api-architecture-v1.1.md §5.1
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
 * Map error codes to PromptLabErrorType.
 * All user-facing messages use neutral language — no backend references.
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

  // Abort controller for cancellation (Clear All, double-click)
  const abortRef = useRef<AbortController | null>(null);

  const assess = useCallback(async (sentence: string): Promise<CoverageAssessment | null> => {
    const trimmed = sentence.trim();

    // Client-side validation
    if (!trimmed) {
      setError({ type: 'unknown', message: 'Please enter a description.' });
      return null;
    }
    if (trimmed.length > 1000) {
      setError({ type: 'unknown', message: 'Maximum 1,000 characters.' });
      return null;
    }

    // Cancel any in-flight request (race condition: double-click)
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    // Set state to checking
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

      // Handle error responses — auto-retry once on transient errors
      if (!res.ok) {
        let data: { error?: string; message?: string } = {};
        try { data = await res.json(); } catch { /* ignore */ }

        const errorType = classifyError(res.status, data.error);

        // Content policy — don't retry
        if (errorType === 'content-policy') {
          setError({ type: errorType, message: 'Your description may contain restricted content.' });
          setIsChecking(false);
          abortRef.current = null;
          return null;
        }

        // Transient error — retry once after 1s
        if (!controller.signal.aborted) {
          console.debug('[TextAnalysis] Attempt 1 failed, retrying...');
          await new Promise((r) => setTimeout(r, 1000));

          if (controller.signal.aborted) { setIsChecking(false); return null; }

          const retry = await fetch('/api/parse-sentence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sentence: trimmed, mode: 'assess' }),
            signal: controller.signal,
          });

          if (retry.ok) {
            const retryData = await retry.json();
            const retryResult = retryData.assessment as CoverageAssessment;
            if (retryResult?.coverage) {
              setAssessment(retryResult);
              setIsChecking(false);
              abortRef.current = null;
              return retryResult;
            }
          }
        }

        // Both attempts failed — set error but don't block (Call 1 is non-critical)
        setError({ type: errorType, message: 'Text analysis unavailable. Your prompts still work.' });
        setIsChecking(false);
        abortRef.current = null;
        return null;
      }

      // Parse successful response
      const data = await res.json();
      const result = data.assessment as CoverageAssessment;

      if (!result || !result.coverage) {
        setError({ type: 'unknown', message: 'Text analysis unavailable. Your prompts still work.' });
        setIsChecking(false);
        abortRef.current = null;
        return null;
      }

      setAssessment(result);
      setIsChecking(false);
      abortRef.current = null;
      return result;
    } catch (err: unknown) {
      // Handle abort (not an error — user cancelled)
      if (err instanceof DOMException && err.name === 'AbortError') {
        setIsChecking(false);
        abortRef.current = null;
        return null;
      }

      // Handle network errors
      setError({ type: 'network', message: 'Connection failed. Please check your network and try again.' });
      setIsChecking(false);
      abortRef.current = null;
      return null;
    }
  }, []);

  const clear = useCallback(() => {
    // Cancel any in-flight request
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
