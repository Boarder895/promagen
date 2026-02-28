// src/hooks/use-vocab-submission.ts
// ============================================================================
// VOCABULARY CROWDSOURCING — Client Submission Hook (Phase 7.7, Part 4)
// ============================================================================
//
// Lightweight fire-and-forget hook that silently POSTs custom terms to the
// vocab submissions API when a user types a custom word/phrase into any
// prompt builder category and presses Enter.
//
// Design:
//   - Layer 1 dedup: in-memory Set of all known vocab terms (client-side)
//   - Reuses the same sessionId from prompt telemetry (sessionStorage)
//   - Fire-and-forget: no retry, no error UI, silent failure
//   - Zero user-visible impact — completely invisible
//
// Usage in prompt-builder.tsx:
//   const submitCustomTerm = useVocabSubmission(platformId, platformTier);
//   // Then in the Combobox:
//   onCustomTermSubmitted={(term) => submitCustomTerm(term, category)}
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 7.7
//
// Version: 1.0.0
// Created: 2026-02-27
//
// Existing features preserved: Yes.
// ============================================================================

'use client';

import { useCallback, useRef, useEffect } from 'react';
import type { PromptCategory } from '@/types/prompt-builder';
import { CATEGORY_ORDER } from '@/types/prompt-builder';
import type { PlatformTierId } from '@/data/platform-tiers';
import { getOptions, type CategoryKey } from '@/data/vocabulary/prompt-builder';
import { getMergedOptions } from '@/data/vocabulary/merged';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Reuse the same sessionStorage key as prompt telemetry */
const SESSION_KEY = 'promagen_telemetry_sid';

/** API endpoint */
const ENDPOINT = '/api/admin/vocab-submissions';

/** Minimum term length to bother submitting */
const MIN_TERM_LENGTH = 2;

// ============================================================================
// SESSION ID (shared with prompt telemetry)
// ============================================================================

/**
 * Get or create the anonymous session ID.
 * Same implementation as prompt-telemetry-client.ts — reuses the same key
 * so the session ID is consistent across telemetry and vocab submissions.
 */
function getSessionId(): string {
  try {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    // SSR or sessionStorage unavailable — generate ephemeral ID
    return crypto.randomUUID();
  }
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook that provides a `submitCustomTerm()` function for silently capturing
 * user-typed custom vocabulary terms.
 *
 * @param platformId   - Current platform (e.g. 'midjourney')
 * @param platformTier - Current tier (1-4)
 * @returns Function to call when a user adds a custom term via Enter
 *
 * @example
 * const submitCustomTerm = useVocabSubmission('midjourney', 1);
 * // Later, in Combobox callback:
 * submitCustomTerm('bioluminescent fog', 'atmosphere');
 */
export function useVocabSubmission(
  platformId: string,
  platformTier: PlatformTierId,
): (term: string, category: PromptCategory) => void {
  // Layer 1 dedup: in-memory Set of all known vocab terms (lowercased)
  // Built once on mount — covers core + merged vocab across all 12 categories.
  const knownTermsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    // Build the known terms set on mount (deferred to avoid blocking render)
    const terms = new Set<string>();

    for (const cat of CATEGORY_ORDER) {
      const key = cat as CategoryKey;
      for (const opt of getOptions(key)) {
        const lower = opt.trim().toLowerCase();
        if (lower) terms.add(lower);
      }
      for (const opt of getMergedOptions(key)) {
        const lower = opt.trim().toLowerCase();
        if (lower) terms.add(lower);
      }
    }

    knownTermsRef.current = terms;
  }, []); // Build once on mount

  const submitCustomTerm = useCallback(
    (term: string, category: PromptCategory) => {
      // Normalise
      const normalised = term.trim().toLowerCase();

      // Skip empty or too-short terms
      if (normalised.length < MIN_TERM_LENGTH) return;

      // Layer 1 dedup: check in-memory set
      if (knownTermsRef.current?.has(normalised)) return;

      // Fire-and-forget POST
      try {
        fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            term: normalised,
            category,
            platformId,
            tier: platformTier,
            sessionId: getSessionId(),
          }),
        }).catch(() => {
          // Silent failure — never show errors for vocab collection
        });
      } catch {
        // Silent failure
      }
    },
    [platformId, platformTier],
  );

  return submitCustomTerm;
}
