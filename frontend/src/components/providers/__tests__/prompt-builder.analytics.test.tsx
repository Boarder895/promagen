// src/components/providers/__tests__/prompt-builder.analytics.test.tsx
// ============================================================================
// PROMPT BUILDER ANALYTICS — Mount-time telemetry verification
// ============================================================================
// Verifies that mounting PromptBuilder fires the analytics event.
//
// MOCKING STRATEGY:
// PromptBuilder imports ~10 hooks. Three of them (useLearnedWeights,
// usePlatformLearning, useABTest) fire fetch() on mount — composed inside
// useLearningData. We mock useLearningData to return idle-state defaults,
// which prevents all three from executing. No other hooks require mocking
// because Clerk is stubbed via moduleNameMapper and all remaining hooks
// use localStorage or pure computation only.
// ============================================================================

import React from 'react';
import { render, act } from '@testing-library/react';

import PromptBuilder from '../prompt-builder';
import type { Provider } from '@/types/provider';
import { trackPromptBuilderOpen } from '@/lib/analytics/providers';

// ── Silence analytics module (test target — we spy on this) ─────────────────
jest.mock('@/lib/analytics/providers', () => ({
  trackPromptBuilderOpen: jest.fn(),
  trackPromptCopy: jest.fn(),
}));

// ── Silence telemetry client (fires fetch on copy, not mount, but prevent) ──
jest.mock('@/lib/telemetry/prompt-telemetry-client', () => ({
  sendPromptTelemetry: jest.fn(),
}));

// ── Kill all 3 fetch-triggering hooks (useABTest, useLearnedWeights,
//    usePlatformLearning) by mocking their composition facade ─────────────────
jest.mock('@/hooks/use-learning-data', () => ({
  useLearningData: () => ({
    // Tier-level (Phases 5–7.4)
    coOccurrenceLookup: new Map(),
    scoringWeights: null,
    blendRatio: [0.7, 0.3],
    antiPatternLookup: new Map(),
    collisionLookup: new Map(),
    weakTermLookup: new Map(),
    redundancyLookup: new Map(),
    comboLookup: new Map(),
    // Platform-level (Phase 7.5)
    platformTermQualityLookup: new Map(),
    platformCoOccurrenceLookup: new Map(),
    platformLastUpdatedAt: null,
    platformDataAge: null,
    // A/B testing (Phase 7.6)
    activeTestId: null,
    activeTestName: null,
    abVariant: null,
    abVariantWeights: null,
    abHash: null,
    abIsLoading: false,
    // Shared
    isLoading: false,
    error: null,
  }),
}));

// ── Silence analytics event tracker ─────────────────────────────────────────
jest.mock('@/lib/analytics/events', () => ({
  trackEvent: jest.fn(),
}));

// ============================================================================
// TEST DATA
// ============================================================================

const SAMPLE_PROVIDER: Provider = {
  id: 'midjourney',
  name: 'Midjourney',
  website: 'https://example.com/midjourney',
  url: 'https://example.com/midjourney',
  affiliateUrl: null,
  requiresDisclosure: false,
  score: 92,
  trend: 'up',
  tags: ['images'],
};

// ============================================================================
// TESTS
// ============================================================================

describe('PromptBuilder analytics', () => {
  it('emits prompt_builder_open when mounted', async () => {
    await act(async () => {
      render(<PromptBuilder provider={SAMPLE_PROVIDER} />);
    });

    expect(trackPromptBuilderOpen).toHaveBeenCalledTimes(1);
    expect(trackPromptBuilderOpen).toHaveBeenCalledWith({
      providerId: 'midjourney',
      location: 'providers_page',
    });
  });
});
