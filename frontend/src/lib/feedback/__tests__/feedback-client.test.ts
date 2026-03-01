/**
 * @file src/lib/feedback/__tests__/feedback-client.test.ts
 *
 * Phase 7.10c — Unit tests for feedback-client.ts
 *
 * Tests sessionStorage helpers, dismissal cooldown, and sendFeedback()
 * fire-and-forget POST. Mocks fetch and sessionStorage to keep tests
 * fast and deterministic.
 *
 * 18 tests across 5 groups.
 *
 * Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 7.10c
 * Version: 1.0.0
 * Created: 2026-03-01
 */

import {
  storeFeedbackPending,
  readFeedbackPending,
  clearFeedbackPending,
  recordDismissal,
  isDismissedRecently,
  sendFeedback,
} from '@/lib/feedback/feedback-client';
import type {
  FeedbackPendingData,
  FeedbackUserContext,
} from '@/lib/feedback/feedback-client';

// ============================================================================
// MOCK: sessionStorage
// ============================================================================

const store: Record<string, string> = {};

const mockSessionStorage = {
  getItem: jest.fn((key: string) => store[key] ?? null),
  setItem: jest.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: jest.fn((key: string) => {
    delete store[key];
  }),
  clear: jest.fn(() => {
    Object.keys(store).forEach((k) => delete store[k]);
  }),
  get length() {
    return Object.keys(store).length;
  },
  key: jest.fn((_i: number) => null),
};

Object.defineProperty(globalThis, 'sessionStorage', {
  value: mockSessionStorage,
  writable: true,
});

// ============================================================================
// MOCK: fetch
// ============================================================================

const mockFetch = jest.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

// ============================================================================
// MOCK: computeFeedbackCredibilityDetailed
// ============================================================================

jest.mock('@/types/feedback', () => ({
  ...jest.requireActual('@/types/feedback'),
  computeFeedbackCredibilityDetailed: jest.fn(() => ({
    credibility: 1.0,
    factors: { tier: 1.0, age: 1.0, frequency: 1.0, speed: 1.0 },
    rawProduct: 1.0,
  })),
}));

// ============================================================================
// HELPERS
// ============================================================================

function makePending(overrides?: Partial<FeedbackPendingData>): FeedbackPendingData {
  return {
    eventId: 'evt_test_123',
    platform: 'midjourney',
    tier: 2,
    copiedAt: Date.now() - 5_000, // 5 seconds ago
    ...overrides,
  };
}

function makeOkResponse(): Response {
  return {
    ok: true,
    status: 201,
    json: async () => ({ ok: true, id: 'fb_abc' }),
    text: async () => '',
  } as unknown as Response;
}

function makeErrorResponse(status = 500): Response {
  return {
    ok: false,
    status,
    json: async () => ({ error: 'fail' }),
    text: async () => 'Internal Server Error',
  } as unknown as Response;
}

// ============================================================================
// SETUP / TEARDOWN
// ============================================================================

beforeEach(() => {
  jest.clearAllMocks();
  mockSessionStorage.clear();
  mockFetch.mockResolvedValue(makeOkResponse());
});

// ============================================================================
// TESTS
// ============================================================================

describe('feedback-client', () => {
  // --------------------------------------------------------------------------
  // storeFeedbackPending / readFeedbackPending / clearFeedbackPending
  // --------------------------------------------------------------------------
  describe('pending feedback storage', () => {
    it('stores and reads pending feedback data', () => {
      const data = makePending();
      storeFeedbackPending(data);
      const result = readFeedbackPending();
      expect(result).toEqual(data);
    });

    it('returns null when nothing stored', () => {
      expect(readFeedbackPending()).toBeNull();
    });

    it('returns null for corrupted JSON', () => {
      store['promagen_feedback_pending'] = '{broken json';
      expect(readFeedbackPending()).toBeNull();
    });

    it('returns null for data missing eventId', () => {
      store['promagen_feedback_pending'] = JSON.stringify({
        platform: 'midjourney',
        tier: 2,
        copiedAt: Date.now(),
      });
      expect(readFeedbackPending()).toBeNull();
    });

    it('returns null for data missing copiedAt', () => {
      store['promagen_feedback_pending'] = JSON.stringify({
        eventId: 'evt_123',
        platform: 'midjourney',
        tier: 2,
      });
      expect(readFeedbackPending()).toBeNull();
    });

    it('clears pending feedback data', () => {
      storeFeedbackPending(makePending());
      clearFeedbackPending();
      expect(readFeedbackPending()).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // recordDismissal / isDismissedRecently
  // --------------------------------------------------------------------------
  describe('dismissal cooldown', () => {
    it('returns false when no dismissal recorded', () => {
      expect(isDismissedRecently()).toBe(false);
    });

    it('returns true immediately after dismissal', () => {
      recordDismissal();
      expect(isDismissedRecently()).toBe(true);
    });

    it('returns false after 24 hours', () => {
      // Set dismissal timestamp to 25 hours ago
      const twentyFiveHoursAgo = Date.now() - 25 * 60 * 60 * 1_000;
      store['promagen_feedback_dismissed'] = String(twentyFiveHoursAgo);
      expect(isDismissedRecently()).toBe(false);
    });

    it('returns false for corrupted timestamp', () => {
      store['promagen_feedback_dismissed'] = 'not-a-number';
      expect(isDismissedRecently()).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // sendFeedback — success cases
  // --------------------------------------------------------------------------
  describe('sendFeedback — success', () => {
    it('sends POST to /api/feedback with correct body shape', async () => {
      const pending = makePending();
      const result = await sendFeedback('positive', pending);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('/api/feedback');
      expect(opts.method).toBe('POST');
      expect(opts.headers).toEqual({ 'Content-Type': 'application/json' });

      const body = JSON.parse(opts.body as string);
      expect(body.promptEventId).toBe(pending.eventId);
      expect(body.rating).toBe('positive');
      expect(body.platform).toBe('midjourney');
      expect(body.tier).toBe(2);
      expect(body.credibilityScore).toBe(1.0);
      expect(body.credibilityFactors).toEqual({
        tier: 1.0,
        age: 1.0,
        frequency: 1.0,
        speed: 1.0,
      });
      expect(typeof body.responseTimeMs).toBe('number');
      expect(body.responseTimeMs).toBeGreaterThan(0);
    });

    it('includes userTier and accountAgeDays when provided', async () => {
      const pending = makePending();
      const ctx: FeedbackUserContext = {
        userTier: 'paid',
        accountAgeDays: 45,
        weeklyUsageCount: 12,
      };
      await sendFeedback('neutral', pending, ctx);

      const body = JSON.parse(
        (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string,
      );
      expect(body.userTier).toBe('paid');
      expect(body.accountAgeDays).toBe(45);
    });

    it('omits userTier/accountAgeDays when not provided', async () => {
      await sendFeedback('negative', makePending());

      const body = JSON.parse(
        (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string,
      );
      expect(body).not.toHaveProperty('userTier');
      expect(body).not.toHaveProperty('accountAgeDays');
    });

    it('clears pending data on success', async () => {
      storeFeedbackPending(makePending());
      expect(readFeedbackPending()).not.toBeNull();

      await sendFeedback('positive', makePending());
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(
        'promagen_feedback_pending',
      );
    });
  });

  // --------------------------------------------------------------------------
  // sendFeedback — failure cases
  // --------------------------------------------------------------------------
  describe('sendFeedback — failure', () => {
    it('returns false on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(500));
      const result = await sendFeedback('positive', makePending());
      expect(result).toBe(false);
    });

    it('returns false on network error (never throws)', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));
      const result = await sendFeedback('positive', makePending());
      expect(result).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // sessionStorage errors (incognito / blocked)
  // --------------------------------------------------------------------------
  describe('sessionStorage errors', () => {
    it('storeFeedbackPending swallows errors silently', () => {
      mockSessionStorage.setItem.mockImplementationOnce(() => {
        throw new DOMException('QuotaExceeded');
      });
      // Must not throw
      expect(() => storeFeedbackPending(makePending())).not.toThrow();
    });

    it('isDismissedRecently returns false on storage error', () => {
      mockSessionStorage.getItem.mockImplementationOnce(() => {
        throw new DOMException('SecurityError');
      });
      expect(isDismissedRecently()).toBe(false);
    });
  });
});
