// src/hooks/use-tier-generation.ts
// ============================================================================
// useTierGeneration — AI Tier Prompt Generation (Call 2)
// ============================================================================
// Calls POST /api/generate-tier-prompts to generate all 4 tier prompts
// directly from the user's human text description via the Prompt Intelligence Engine.
//
// Fires in parallel with Call 1 (useSentenceConversion).
// When a provider is selected, generates provider-tailored output.
// When no provider is selected, generates generic best-practice tiers.
//
// Human factors:
//   §2 Variable Reward — each generation produces different AI output
//       for the same input, keeping the user engaged with "what will
//       it produce this time?"
//
// Authority: ai-disguise.md §5 (Call 2 — AI Tier Generation)
// Scope: Prompt Lab (/studio/playground) ONLY
// One Brain rule: This does NOT replace generators.ts or assemblePrompt().
//                 Template generators remain as fallback.
// Existing features preserved: Yes (new file, no modifications).
// ============================================================================

'use client';

import { useState, useCallback, useRef } from 'react';
import type { GeneratedPrompts } from '@/types/prompt-intelligence';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Provider context sent to the API for provider-tailored generation.
 * Built from PlatformFormat + PlatformTierId on the client side.
 */
export interface TierGenerationProviderContext {
  /** Platform tier (1–4) */
  tier: number;
  /** Provider display name */
  name: string;
  /** Prompt style: keywords | natural | plain */
  promptStyle: string;
  /** Sweet spot token count */
  sweetSpot: number;
  /** Maximum token limit */
  tokenLimit: number;
  /** Quality prefix terms */
  qualityPrefix?: string[];
  /** Weight syntax pattern (e.g., "{term}::{weight}") */
  weightingSyntax?: string;
  /** Whether the platform supports term weighting */
  supportsWeighting?: boolean;
  /** How the platform handles negative prompts */
  negativeSupport: 'separate' | 'inline' | 'none' | 'converted';
}

export interface UseTierGenerationReturn {
  /** AI-generated tier prompts (null until first generation) */
  aiTierPrompts: GeneratedPrompts | null;
  /** Whether the API call is in progress */
  isGenerating: boolean;
  /** Error message if the call failed */
  error: string | null;
  /** Provider name the tiers were generated for (null = generic). For badge display. */
  generatedForProvider: string | null;
  /** Provider ID the tiers were generated for (null = generic). For re-fire detection. */
  generatedForProviderId: string | null;
  /** Trigger tier generation. Returns true if successful, false if failed. */
  generate: (
    sentence: string,
    providerId: string | null,
    providerContext: TierGenerationProviderContext | null,
    /** v4: Gap intent from Check → Assess → Decide flow */
    gapIntent?: 'all-satisfied' | 'skipped' | 'user-decided',
    /** v4: Category decisions (only when gapIntent is "user-decided") */
    categoryDecisions?: Array<{ category: string; fill: string }>,
  ) => Promise<boolean>;
  /** Clear all generated results (e.g., on "Clear All") */
  clear: () => void;
}

// ============================================================================
// API RESPONSE SHAPE (matches route.ts ResponseSchema)
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
// HELPERS
// ============================================================================

/**
 * Convert API response shape → GeneratedPrompts (UI shape).
 * The API returns { positive, negative } per tier.
 * The UI expects flat strings + a nested negative object.
 */
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

// ============================================================================
// HOOK
// ============================================================================

export function useTierGeneration(): UseTierGenerationReturn {
  const [aiTierPrompts, setAiTierPrompts] = useState<GeneratedPrompts | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedForProvider, setGeneratedForProvider] = useState<string | null>(null);
  const [generatedForProviderId, setGeneratedForProviderId] = useState<string | null>(null);

  // Abort controller for in-flight requests (cancel on re-fire)
  const abortRef = useRef<AbortController | null>(null);

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
        setError('No description provided.');
        return false;
      }

      // Cancel any in-flight request (e.g., provider switch mid-generation)
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      setIsGenerating(true);
      setError(null);

      try {
        // Build request body — v4 fields are optional for backward compat
        const requestBody: Record<string, unknown> = {
          sentence: trimmed,
          providerId,
          providerContext,
        };
        if (gapIntent) {
          requestBody.gapIntent = gapIntent;
        }
        if (categoryDecisions && categoryDecisions.length > 0) {
          requestBody.categoryDecisions = categoryDecisions;
        }

        const res = await fetch('/api/generate-tier-prompts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        // Don't process if this request was aborted (a newer one replaced it)
        if (controller.signal.aborted) return false;

        if (!res.ok) {
          const data = await res.json().catch(() => ({ message: 'Request failed' }));
          setError(data.message ?? 'Failed to generate prompts. Please try again.');
          setIsGenerating(false);
          return false;
        }

        const data: ApiResponse = await res.json();

        if (!data.tiers) {
          setError('No prompts returned. Please try again.');
          setIsGenerating(false);
          return false;
        }

        // Convert to UI shape and store
        const prompts = apiToGeneratedPrompts(data.tiers);
        setAiTierPrompts(prompts);
        setGeneratedForProvider(providerContext?.name ?? null);
        setGeneratedForProviderId(providerId);
        setIsGenerating(false);
        return true;
      } catch (err) {
        // AbortError is expected when we cancel — don't show error
        if (err instanceof DOMException && err.name === 'AbortError') {
          return false;
        }
        console.error('[useTierGeneration] Error:', err);
        setError('Something went wrong. Please try again.');
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
