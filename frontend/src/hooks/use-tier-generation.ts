// src/hooks/use-tier-generation.ts
// ============================================================================
// useTierGeneration — AI Tier Prompt Generation (Call 2) v2.0.0
// ============================================================================
// v2.0.0 (5 Apr 2026): Resilience layer
//   - Auto-retry once on transient errors (network, format, rate limit)
//   - No retry on content policy violations
//   - Tier validation: at least 1 tier must have non-empty positive content
//   - Error type classification for UI routing
//   - 1.5s delay before retry (avoids hammering on rate limits)
//
// Calls POST /api/generate-tier-prompts to generate all 4 tier prompts
// directly from the user's human text description.
//
// Authority: ai-disguise.md §5 (Call 2 — AI Tier Generation)
// Existing features preserved: Yes — same return type, same API contract.
// ============================================================================

'use client';

import { useState, useCallback, useRef } from 'react';
import type { GeneratedPrompts } from '@/types/prompt-intelligence';

// ============================================================================
// TYPES
// ============================================================================

export interface TierGenerationProviderContext {
  tier: number;
  name: string;
  promptStyle: string;
  sweetSpot: number;
  tokenLimit: number;
  qualityPrefix?: string[];
  weightingSyntax?: string;
  supportsWeighting?: boolean;
  negativeSupport: 'separate' | 'inline' | 'none' | 'converted';
}

/** Error types for UI routing */
export type TierErrorType = 'content-policy' | 'rate-limit' | 'network' | 'format' | 'validation' | 'unknown';

export interface TierGenerationError {
  type: TierErrorType;
  message: string;
  /** Whether the error is retryable (false for content policy) */
  retryable: boolean;
}

export interface UseTierGenerationReturn {
  aiTierPrompts: GeneratedPrompts | null;
  isGenerating: boolean;
  error: TierGenerationError | null;
  generatedForProvider: string | null;
  generatedForProviderId: string | null;
  generate: (
    sentence: string,
    providerId: string | null,
    providerContext: TierGenerationProviderContext | null,
    gapIntent?: 'all-satisfied' | 'skipped' | 'user-decided',
    categoryDecisions?: Array<{ category: string; fill: string }>,
  ) => Promise<boolean>;
  clear: () => void;
}

// ============================================================================
// API RESPONSE SHAPE
// ============================================================================

interface ApiTierOutput {
  positive: string;
  negative: string;
}

interface ApiResponse {
  tiers: {
    tier1: ApiTierOutput;
    tier2: ApiTierOutput;
    tier3: ApiTierOutput;
    tier4: ApiTierOutput;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Delay before auto-retry (ms) */
const RETRY_DELAY = 1500;

// ============================================================================
// HELPERS
// ============================================================================

function apiToGeneratedPrompts(api: ApiResponse['tiers']): GeneratedPrompts {
  return {
    tier1: api.tier1.positive,
    tier2: api.tier2.positive,
    tier3: api.tier3.positive,
    tier4: api.tier4.positive,
    negative: {
      tier1: api.tier1.negative,
      tier2: api.tier2.negative,
      tier3: api.tier3.negative,
      tier4: api.tier4.negative,
    },
  };
}

/** Validate that at least 1 tier has non-empty positive content */
function validateTiers(prompts: GeneratedPrompts): boolean {
  return !!(
    prompts.tier1?.trim() ||
    prompts.tier2?.trim() ||
    prompts.tier3?.trim() ||
    prompts.tier4?.trim()
  );
}

/** Classify error type from HTTP status and response body */
function classifyTierError(
  status: number,
  errorCode?: string,
  message?: string,
): TierGenerationError {
  const msg = message ?? 'Something went wrong. Please try again.';

  if (errorCode === 'CONTENT_POLICY' || status === 451) {
    return { type: 'content-policy', message: 'Your description may contain restricted content. Try different wording.', retryable: false };
  }
  if (status === 429 || errorCode === 'RATE_LIMITED') {
    return { type: 'rate-limit', message: 'Busy — retrying...', retryable: true };
  }
  if (status === 0) {
    return { type: 'network', message: 'Connection issue — retrying...', retryable: true };
  }
  if (msg.toLowerCase().includes('format') || msg.toLowerCase().includes('parse')) {
    return { type: 'format', message: 'Algorithm hiccup — retrying...', retryable: true };
  }
  return { type: 'unknown', message: 'Algorithm overload — retrying...', retryable: true };
}

/** Wait for a specified duration */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// SINGLE ATTEMPT — extracted for retry logic
// ============================================================================

interface AttemptResult {
  ok: boolean;
  prompts?: GeneratedPrompts;
  error?: TierGenerationError;
}

async function attemptGenerate(
  requestBody: Record<string, unknown>,
  signal: AbortSignal,
): Promise<AttemptResult> {
  const res = await fetch('/api/generate-tier-prompts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
    signal,
  });

  if (signal.aborted) return { ok: false };

  if (!res.ok) {
    let data: { error?: string; message?: string } = {};
    try { data = await res.json(); } catch { /* ignore */ }
    return { ok: false, error: classifyTierError(res.status, data.error, data.message) };
  }

  const data: ApiResponse = await res.json();

  if (!data.tiers) {
    return { ok: false, error: { type: 'format', message: 'No prompts returned. Please try again.', retryable: true } };
  }

  const prompts = apiToGeneratedPrompts(data.tiers);

  // Validate: at least 1 tier must have content
  if (!validateTiers(prompts)) {
    return { ok: false, error: { type: 'validation', message: 'Generated prompts were empty. Please try again.', retryable: true } };
  }

  return { ok: true, prompts };
}

// ============================================================================
// HOOK
// ============================================================================

export function useTierGeneration(): UseTierGenerationReturn {
  const [aiTierPrompts, setAiTierPrompts] = useState<GeneratedPrompts | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<TierGenerationError | null>(null);
  const [generatedForProvider, setGeneratedForProvider] = useState<string | null>(null);
  const [generatedForProviderId, setGeneratedForProviderId] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  // Generation counter — only the latest generation's results are accepted.
  // Eliminates abort race condition where old response arrives after new call starts.
  const generationIdRef = useRef(0);

  const generate = useCallback(
    async (
      sentence: string,
      providerId: string | null,
      providerContext: TierGenerationProviderContext | null,
      gapIntent?: 'all-satisfied' | 'skipped' | 'user-decided',
      categoryDecisions?: Array<{ category: string; fill: string }>,
    ): Promise<boolean> => {
      const trimmed = sentence.trim();
      if (!trimmed) {
        setError({ type: 'unknown', message: 'No description provided.', retryable: false });
        return false;
      }

      // Cancel any in-flight request
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      // Increment generation ID — stale responses from older calls are rejected
      generationIdRef.current += 1;
      const thisGenerationId = generationIdRef.current;

      setIsGenerating(true);
      setError(null);

      try {
        const requestBody: Record<string, unknown> = {
          sentence: trimmed,
          providerId,
          providerContext,
        };
        if (gapIntent) requestBody.gapIntent = gapIntent;
        if (categoryDecisions && categoryDecisions.length > 0) {
          requestBody.categoryDecisions = categoryDecisions;
        }

        // ── Attempt 1 ──────────────────────────────────────────────
        const first = await attemptGenerate(requestBody, controller.signal);

        // Reject if aborted OR a newer generation has started
        if (controller.signal.aborted || generationIdRef.current !== thisGenerationId) return false;

        if (first.ok && first.prompts) {
          setAiTierPrompts(first.prompts);
          setGeneratedForProvider(providerContext?.name ?? null);
          setGeneratedForProviderId(providerId);
          setIsGenerating(false);
          return true;
        }

        // ── Check if retryable ─────────────────────────────────────
        if (!first.error?.retryable) {
          // Content policy — don't retry, show error immediately
          setError(first.error ?? { type: 'unknown', message: 'Generation failed.', retryable: false });
          setIsGenerating(false);
          return false;
        }

        // ── Auto-retry after delay ─────────────────────────────────
        console.debug('[PromptAlgorithm] Attempt 1 failed, retrying in', RETRY_DELAY, 'ms...');
        await wait(RETRY_DELAY);

        if (controller.signal.aborted || generationIdRef.current !== thisGenerationId) return false;

        const second = await attemptGenerate(requestBody, controller.signal);

        if (controller.signal.aborted || generationIdRef.current !== thisGenerationId) return false;

        if (second.ok && second.prompts) {
          setAiTierPrompts(second.prompts);
          setGeneratedForProvider(providerContext?.name ?? null);
          setGeneratedForProviderId(providerId);
          setIsGenerating(false);
          return true;
        }

        // ── Both attempts failed ───────────────────────────────────
        const finalError = second.error ?? first.error ?? {
          type: 'unknown' as TierErrorType,
          message: 'Something went wrong. Please try again.',
          retryable: true,
        };
        // Override message for user-facing display after retry exhausted
        setError({
          ...finalError,
          message: finalError.type === 'rate-limit'
            ? 'Service is busy. Please try again in a moment.'
            : 'Something went wrong. Your free prompt is still available — try again.',
        });
        setIsGenerating(false);
        return false;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return false;
        }
        console.error('[PromptAlgorithm] Error:', err);
        setError({ type: 'network', message: 'Connection failed. Your free prompt is still available — try again.', retryable: true });
        setIsGenerating(false);
        return false;
      }
    },
    [],
  );

  const clear = useCallback(() => {
    setAiTierPrompts(null);
    setError(null);
    setGeneratedForProvider(null);
    setGeneratedForProviderId(null);
  }, []);

  return {
    aiTierPrompts,
    isGenerating,
    error,
    generatedForProvider,
    generatedForProviderId,
    generate,
    clear,
  };
}
