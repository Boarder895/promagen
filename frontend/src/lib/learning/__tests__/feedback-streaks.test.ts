/**
 * @file src/lib/learning/__tests__/feedback-streaks.test.ts
 *
 * Phase 7.10f — Unit tests for feedback-streaks.ts
 *
 * Tests detectStreak() pure function, computeStreakBoost(), and
 * FeedbackStreakTracker class with mocked sessionStorage.
 *
 * 30 tests across 4 groups.
 *
 * Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 7.10f
 * Version: 1.0.0
 * Created: 2026-03-01
 */

import {
  detectStreak,
  computeStreakBoost,
  FeedbackStreakTracker,
} from '@/lib/learning/feedback-streaks';
import type { StreakSignal } from '@/lib/learning/feedback-streaks';
import type { FeedbackRating } from '@/types/feedback';
import { LEARNING_CONSTANTS } from '@/lib/learning/constants';

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
// HELPERS
// ============================================================================

const c = LEARNING_CONSTANTS;

/** Build a rating array from shorthand: 'p' = positive, 'n' = negative, 'u' = neutral */
function ratings(pattern: string): FeedbackRating[] {
  return pattern.split('').map((ch) => {
    if (ch === 'p') return 'positive';
    if (ch === 'n') return 'negative';
    return 'neutral';
  });
}

// ============================================================================
// SETUP / TEARDOWN
// ============================================================================

beforeEach(() => {
  jest.clearAllMocks();
  mockSessionStorage.clear();
});

// ============================================================================
// detectStreak — pure function
// ============================================================================

describe('detectStreak', () => {
  it('returns null for empty history', () => {
    expect(detectStreak([], 'midjourney')).toBeNull();
  });

  it('returns null for history shorter than threshold', () => {
    expect(detectStreak(ratings('pp'), 'midjourney')).toBeNull();
  });

  // --- Hot streak ---
  it('detects hot streak with exactly 3 consecutive positive', () => {
    const result = detectStreak(ratings('ppp'), 'midjourney');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('hot');
    expect(result!.length).toBe(3);
    expect(result!.platform).toBe('midjourney');
  });

  it('detects hot streak with 5 consecutive positive', () => {
    const result = detectStreak(ratings('nppppp'), 'dalle');
    expect(result!.type).toBe('hot');
    expect(result!.length).toBe(5);
  });

  it('hot streak broken by a negative in the middle → shorter streak', () => {
    const result = detectStreak(ratings('pppnppp'), 'midjourney');
    expect(result!.type).toBe('hot');
    expect(result!.length).toBe(3);
  });

  it('hot streak broken by neutral → only counts after neutral', () => {
    const result = detectStreak(ratings('pppupp'), 'midjourney');
    // Last 2 are positive — below threshold
    expect(result).toBeNull();
  });

  // --- Cold streak ---
  it('detects cold streak with 3 consecutive negative', () => {
    const result = detectStreak(ratings('nnn'), 'stability');
    expect(result!.type).toBe('cold');
    expect(result!.length).toBe(3);
  });

  it('detects cold streak with 4 consecutive negative after positives', () => {
    const result = detectStreak(ratings('ppnnnn'), 'stability');
    expect(result!.type).toBe('cold');
    expect(result!.length).toBe(4);
  });

  // --- Oscillating ---
  it('detects oscillating pattern with 4 alternating ratings', () => {
    const result = detectStreak(ratings('pnpn'), 'midjourney');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('oscillating');
    expect(result!.length).toBe(4);
  });

  it('detects oscillating starting with negative', () => {
    const result = detectStreak(ratings('npnpnp'), 'dalle');
    expect(result!.type).toBe('oscillating');
    expect(result!.length).toBe(6);
  });

  it('neutral breaks oscillating pattern', () => {
    const result = detectStreak(ratings('pnupn'), 'midjourney');
    // After neutral: 'p','n' — only 2 alternating, below threshold
    expect(result).toBeNull();
  });

  // --- Priority: hot > cold > oscillating ---
  it('hot streak takes priority when both hot and oscillating qualify', () => {
    // pnpnppp → last 3 are positive = hot streak
    const result = detectStreak(ratings('pnpnppp'), 'midjourney');
    expect(result!.type).toBe('hot');
  });

  // --- Edge cases ---
  it('all neutral → no streak', () => {
    expect(detectStreak(ratings('uuuuu'), 'midjourney')).toBeNull();
  });

  it('mixed without pattern → no streak', () => {
    expect(detectStreak(ratings('pnup'), 'midjourney')).toBeNull();
  });
});

// ============================================================================
// computeStreakBoost
// ============================================================================

describe('computeStreakBoost', () => {
  it('hot streak returns boost multiplier (1.15)', () => {
    const streak: StreakSignal = {
      type: 'hot',
      length: 3,
      platform: 'midjourney',
      detectedAt: Date.now(),
    };
    expect(computeStreakBoost(streak)).toBe(c.FEEDBACK_STREAK_HOT_BOOST);
  });

  it('cold streak returns penalty multiplier (0.85)', () => {
    const streak: StreakSignal = {
      type: 'cold',
      length: 3,
      platform: 'midjourney',
      detectedAt: Date.now(),
    };
    expect(computeStreakBoost(streak)).toBe(c.FEEDBACK_STREAK_COLD_PENALTY);
  });

  it('oscillating returns neutral (1.0)', () => {
    const streak: StreakSignal = {
      type: 'oscillating',
      length: 4,
      platform: 'midjourney',
      detectedAt: Date.now(),
    };
    expect(computeStreakBoost(streak)).toBe(1.0);
  });
});

// ============================================================================
// FeedbackStreakTracker — class
// ============================================================================

describe('FeedbackStreakTracker', () => {
  it('starts with empty state', () => {
    const tracker = new FeedbackStreakTracker();
    expect(tracker.getPlatforms()).toEqual([]);
    expect(tracker.currentStreak('midjourney')).toBeNull();
  });

  it('records ratings and detects hot streak', () => {
    const tracker = new FeedbackStreakTracker();
    tracker.record('midjourney', 'positive', 'evt_1');
    tracker.record('midjourney', 'positive', 'evt_2');
    const result = tracker.record('midjourney', 'positive', 'evt_3');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('hot');
    expect(result!.length).toBe(3);
  });

  it('tracks platforms independently', () => {
    const tracker = new FeedbackStreakTracker();
    tracker.record('midjourney', 'positive', 'evt_1');
    tracker.record('midjourney', 'positive', 'evt_2');
    tracker.record('dalle', 'negative', 'evt_3');
    tracker.record('dalle', 'negative', 'evt_4');
    tracker.record('dalle', 'negative', 'evt_5');

    expect(tracker.currentStreak('midjourney')).toBeNull(); // only 2
    const dalleStreak = tracker.currentStreak('dalle');
    expect(dalleStreak!.type).toBe('cold');
  });

  it('returns full history for a platform', () => {
    const tracker = new FeedbackStreakTracker();
    tracker.record('midjourney', 'positive', 'evt_1');
    tracker.record('midjourney', 'negative', 'evt_2');
    const history = tracker.getHistory('midjourney');
    expect(history).toHaveLength(2);
    expect(history[0]!.rating).toBe('positive');
    expect(history[1]!.rating).toBe('negative');
  });

  it('returns empty array for unknown platform', () => {
    const tracker = new FeedbackStreakTracker();
    expect(tracker.getHistory('unknown')).toEqual([]);
  });

  it('persists state to sessionStorage', () => {
    const tracker = new FeedbackStreakTracker();
    tracker.record('midjourney', 'positive', 'evt_1');

    expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
      'promagen_feedback_streaks',
      expect.any(String),
    );

    const stored = JSON.parse(store['promagen_feedback_streaks']!);
    expect(stored.platforms.midjourney).toHaveLength(1);
  });

  it('restores state from sessionStorage on construction', () => {
    // Pre-seed sessionStorage
    const preState = {
      platforms: {
        midjourney: [
          { rating: 'positive', eventId: 'evt_1', timestamp: 1000 },
          { rating: 'positive', eventId: 'evt_2', timestamp: 2000 },
        ],
      },
    };
    store['promagen_feedback_streaks'] = JSON.stringify(preState);

    const tracker = new FeedbackStreakTracker();
    const result = tracker.record('midjourney', 'positive', 'evt_3');
    expect(result!.type).toBe('hot');
    expect(result!.length).toBe(3);
  });

  it('caps history at MAX_HISTORY per platform', () => {
    const tracker = new FeedbackStreakTracker();
    const max = c.FEEDBACK_STREAK_MAX_HISTORY;

    for (let i = 0; i < max + 5; i++) {
      tracker.record('midjourney', 'positive', `evt_${i}`);
    }

    expect(tracker.getHistory('midjourney')).toHaveLength(max);
  });

  it('clear() resets all state', () => {
    const tracker = new FeedbackStreakTracker();
    tracker.record('midjourney', 'positive', 'evt_1');
    tracker.clear();
    expect(tracker.getPlatforms()).toEqual([]);
    expect(tracker.getHistory('midjourney')).toEqual([]);
  });
});

// ============================================================================
// LEARNING_CONSTANTS — streak constants integrity
// ============================================================================

describe('LEARNING_CONSTANTS — streak constants', () => {
  it('streak threshold is positive integer >= 2', () => {
    expect(c.FEEDBACK_STREAK_THRESHOLD).toBeGreaterThanOrEqual(2);
    expect(Number.isInteger(c.FEEDBACK_STREAK_THRESHOLD)).toBe(true);
  });

  it('oscillating threshold >= streak threshold', () => {
    expect(c.FEEDBACK_OSCILLATING_THRESHOLD).toBeGreaterThanOrEqual(
      c.FEEDBACK_STREAK_THRESHOLD,
    );
  });

  it('hot boost > 1.0 and cold penalty < 1.0', () => {
    expect(c.FEEDBACK_STREAK_HOT_BOOST).toBeGreaterThan(1.0);
    expect(c.FEEDBACK_STREAK_COLD_PENALTY).toBeLessThan(1.0);
    expect(c.FEEDBACK_STREAK_COLD_PENALTY).toBeGreaterThan(0);
  });

  it('max history is positive integer', () => {
    expect(c.FEEDBACK_STREAK_MAX_HISTORY).toBeGreaterThan(0);
    expect(Number.isInteger(c.FEEDBACK_STREAK_MAX_HISTORY)).toBe(true);
  });
});
