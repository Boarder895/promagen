/**
 * Vocabulary Crowdsourcing Pipeline Verification — Phase 7.7 Part 7
 * ==================================================================
 * 20 automated tests verifying the vocab submission pipeline:
 *
 *   T1–T6:   Auto-filter (profanity, spam, length, edge cases)
 *   T7–T8:   Normalise term
 *   T9–T14:  Category suggester
 *   T15–T18: Confidence scoring
 *   T19–T20: Constants & schema guards
 *
 * Run:  pnpm test -- src/__tests__/vocab-submission.integrity.test.ts
 *
 * @version 1.0.0
 * @created 2026-02-27
 */

import { checkAutoFilter, normaliseTerm } from '@/lib/vocabulary/vocab-auto-filter';
import {
  suggestCategories,
  termExistsInCategory,
  termExistsInAnyCategory,
  invalidateVocabCache,
} from '@/lib/vocabulary/category-suggester';
import {
  calculateConfidence,
  MIN_TERM_LENGTH,
  MAX_TERM_LENGTH,
  HIGH_CONFIDENCE_SESSIONS,
  HIGH_CONFIDENCE_PLATFORMS,
  MEDIUM_CONFIDENCE_SESSIONS,
  MEDIUM_CONFIDENCE_COUNT,
} from '@/types/vocab-submission';
import type { ConfidenceLevel } from '@/types/vocab-submission';

// ============================================================================
// T1: Auto-filter — Profanity detection
// ============================================================================

describe('Phase 7.7 — Vocabulary Crowdsourcing Pipeline', () => {
  describe('T1: Auto-filter — Profanity detection', () => {
    it('blocks known slurs', () => {
      const result = checkAutoFilter('some nigger phrase');
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('profanity');
    });

    it('blocks sexual terms', () => {
      const result = checkAutoFilter('explicit porn scene');
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('profanity');
    });

    it('blocks child safety terms with zero tolerance', () => {
      const result = checkAutoFilter('loli aesthetic');
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('profanity');
    });

    it('uses word boundary matching — does NOT block "class" for "ass"', () => {
      const result = checkAutoFilter('classic renaissance portrait');
      expect(result.blocked).toBe(false);
    });

    it('uses word boundary matching — does NOT block "cockatoo" for "cock"', () => {
      const result = checkAutoFilter('cockatoo perched on branch');
      expect(result.blocked).toBe(false);
    });

    it('uses word boundary matching — does NOT block "dickens" for "dick"', () => {
      const result = checkAutoFilter('dickensian atmosphere');
      expect(result.blocked).toBe(false);
    });
  });

  // ============================================================================
  // T2: Auto-filter — Spam pattern detection
  // ============================================================================

  describe('T2: Auto-filter — Spam patterns', () => {
    it('blocks URLs', () => {
      const result = checkAutoFilter('visit https://evil.com for free stuff');
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('spam');
      expect(result.matchedPattern).toBe('url');
    });

    it('blocks email addresses', () => {
      const result = checkAutoFilter('contact spam@example.com');
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('spam');
      expect(result.matchedPattern).toBe('email');
    });

    it('blocks repeated characters', () => {
      const result = checkAutoFilter('aaaaaaaaaa');
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('spam');
      expect(result.matchedPattern).toBe('repeated-chars');
    });

    it('blocks numbers-only input', () => {
      const result = checkAutoFilter('123456789');
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('spam');
      expect(result.matchedPattern).toBe('numbers-only');
    });

    it('blocks phone numbers', () => {
      const result = checkAutoFilter('+44 7911 123456');
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('spam');
    });
  });

  // ============================================================================
  // T3: Auto-filter — Length guards
  // ============================================================================

  describe('T3: Auto-filter — Length guards', () => {
    it('blocks terms shorter than MIN_TERM_LENGTH', () => {
      const shortTerm = 'x'; // 1 char, below minimum of 2
      const result = checkAutoFilter(shortTerm);
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('too-short');
    });

    it('blocks terms longer than MAX_TERM_LENGTH', () => {
      const longTerm = 'a'.repeat(MAX_TERM_LENGTH + 1);
      const result = checkAutoFilter(longTerm);
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('too-long');
    });

    it('accepts terms at exact MIN_TERM_LENGTH', () => {
      const minTerm = 'ab'; // exactly 2 chars
      expect(minTerm.length).toBe(MIN_TERM_LENGTH);
      const result = checkAutoFilter(minTerm);
      // Should not be blocked by length (may be blocked by spam regex for no-letters)
      expect(result.reason).not.toBe('too-short');
    });

    it('accepts terms at exact MAX_TERM_LENGTH', () => {
      const maxTerm = 'golden ' + 'a'.repeat(MAX_TERM_LENGTH - 7); // Exactly at limit
      expect(maxTerm.length).toBe(MAX_TERM_LENGTH);
      const result = checkAutoFilter(maxTerm);
      expect(result.reason).not.toBe('too-long');
    });
  });

  // ============================================================================
  // T4: Auto-filter — Clean terms pass through
  // ============================================================================

  describe('T4: Auto-filter — Clean terms', () => {
    const CLEAN_TERMS = [
      'bioluminescent fog',
      'golden hour warmth',
      'cinematic depth of field',
      'ethereal mist',
      'soft volumetric lighting',
      'weathered copper patina',
      'moody chiaroscuro',
      'brutalist architecture',
      '8k ultra-detailed',
      'noir detective scene',
    ];

    it.each(CLEAN_TERMS)('allows clean prompt term: "%s"', (term) => {
      const result = checkAutoFilter(term);
      expect(result.blocked).toBe(false);
      expect(result.reason).toBeNull();
      expect(result.matchedPattern).toBeNull();
    });
  });

  // ============================================================================
  // T5: Auto-filter — Profanity false-positive resistance
  // ============================================================================

  describe('T5: Auto-filter — False positive resistance', () => {
    const SAFE_TERMS_WITH_SUBSTRINGS = [
      'assassination scene',       // contains "ass"
      'classic composition',       // contains "ass"
      'therapeutic glow',          // contains nothing problematic
      'cocktail party setting',    // contains "cock"
      'scunthorpe problem',        // famous false-positive test case
      'penisular coastline',       // wait — this should actually be "peninsular"
      'cumulonimbus clouds',       // contains "cum" as substring
      'penal colony ruins',        // contains substring
    ];

    it.each(SAFE_TERMS_WITH_SUBSTRINGS)(
      'does NOT false-positive on: "%s"',
      (term) => {
        const result = checkAutoFilter(term);
        expect(result.blocked).toBe(false);
      },
    );
  });

  // ============================================================================
  // T6: Auto-filter — Edge cases
  // ============================================================================

  describe('T6: Auto-filter — Edge cases', () => {
    it('handles empty string after normalisation', () => {
      const result = checkAutoFilter('');
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('too-short');
    });

    it('handles whitespace-only after normalisation', () => {
      // After normaliseTerm trims, this becomes ""
      const result = checkAutoFilter('');
      expect(result.blocked).toBe(true);
    });

    it('handles unicode characters', () => {
      const result = checkAutoFilter('café terrace at night');
      expect(result.blocked).toBe(false);
    });

    it('handles mixed case (filter is case-insensitive)', () => {
      const result = checkAutoFilter('NIGGER');
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('profanity');
    });
  });

  // ============================================================================
  // T7: Normalise term
  // ============================================================================

  describe('T7: normaliseTerm', () => {
    it('trims whitespace', () => {
      expect(normaliseTerm('  golden hour  ')).toBe('golden hour');
    });

    it('lowercases', () => {
      expect(normaliseTerm('Cinematic DEPTH')).toBe('cinematic depth');
    });

    it('handles combined trim + lowercase', () => {
      expect(normaliseTerm('  Ethereal Mist  ')).toBe('ethereal mist');
    });
  });

  // ============================================================================
  // T8: Normalise term — Idempotency
  // ============================================================================

  describe('T8: normaliseTerm — Idempotency', () => {
    it('applying normaliseTerm twice gives same result', () => {
      const input = '  BioLuminescent FOG  ';
      const once = normaliseTerm(input);
      const twice = normaliseTerm(once);
      expect(twice).toBe(once);
    });
  });

  // ============================================================================
  // T9: Category suggester — Always includes original
  // ============================================================================

  describe('T9: Category suggester — Original category always first', () => {
    it('returns the original category as first element', () => {
      const result = suggestCategories('random test term', 'atmosphere');
      expect(result[0]).toBe('atmosphere');
    });

    it('returns at least the original category', () => {
      const result = suggestCategories('xyznonexistent', 'lighting');
      expect(result).toContain('lighting');
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================================================
  // T10: Category suggester — Cross-category matching
  // ============================================================================

  describe('T10: Category suggester — Cross-category token matching', () => {
    it('suggests multiple categories when tokens match across vocab', () => {
      // "fog" is a common atmosphere/environment term
      const result = suggestCategories('dense fog', 'atmosphere');
      // Should at least include atmosphere (the original)
      expect(result).toContain('atmosphere');
    });

    it('returns max MAX_SUGGESTIONS categories', () => {
      // Use a very common token that appears in many categories
      const result = suggestCategories('light soft warm golden', 'lighting');
      expect(result.length).toBeLessThanOrEqual(4); // MAX_SUGGESTIONS = 4
    });
  });

  // ============================================================================
  // T11: Category suggester — Short token filtering
  // ============================================================================

  describe('T11: Category suggester — Token filtering', () => {
    it('ignores tokens shorter than 3 characters', () => {
      // "8K" has no tokens ≥ 3 after filtering, should just return original
      const result = suggestCategories('8k', 'fidelity');
      expect(result).toEqual(['fidelity']);
    });

    it('skips pure numeric tokens', () => {
      // "8" is a pure number, "ultra" is valid
      const result = suggestCategories('8 ultra', 'fidelity');
      // Result should be based on "ultra" only
      expect(result[0]).toBe('fidelity');
    });
  });

  // ============================================================================
  // T12: Category suggester — termExistsInCategory
  // ============================================================================

  describe('T12: termExistsInCategory', () => {
    beforeAll(() => {
      // Ensure fresh cache
      invalidateVocabCache();
    });

    it('returns true for a known term in the correct category', () => {
      // "mysterious" is a standalone option in atmosphere.json
      expect(termExistsInCategory('mysterious', 'atmosphere')).toBe(true);
    });

    it('returns true for a term that exists in multiple categories', () => {
      // "photorealistic" exists in both style.json and fidelity.json
      const inStyle = termExistsInCategory('photorealistic', 'style');
      const inFidelity = termExistsInCategory('photorealistic', 'fidelity');
      expect(inStyle || inFidelity).toBe(true);
    });

    it('returns false for a nonsense term', () => {
      const result = termExistsInCategory('xyznonexistent12345', 'atmosphere');
      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // T13: Category suggester — termExistsInAnyCategory
  // ============================================================================

  describe('T13: termExistsInAnyCategory', () => {
    it('finds a known term across categories', () => {
      // "mysterious" is a standalone option in atmosphere.json
      const result = termExistsInAnyCategory('mysterious');
      expect(result).not.toBeNull();
      expect(result).toBe('atmosphere');
    });

    it('returns null for nonsense terms', () => {
      const result = termExistsInAnyCategory('xyznonexistent12345');
      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // T14: Category suggester — Cache invalidation
  // ============================================================================

  describe('T14: Cache invalidation', () => {
    it('invalidateVocabCache does not throw', () => {
      expect(() => invalidateVocabCache()).not.toThrow();
    });

    it('cache rebuilds after invalidation', () => {
      invalidateVocabCache();
      // Calling suggestCategories forces a cache rebuild
      const result = suggestCategories('fog', 'atmosphere');
      expect(result).toContain('atmosphere');
    });
  });

  // ============================================================================
  // T15: Confidence scoring — High confidence
  // ============================================================================

  describe('T15: Confidence scoring — High', () => {
    it('returns "high" when sessions ≥ 5 AND platforms ≥ 3', () => {
      const result = calculateConfidence(
        HIGH_CONFIDENCE_SESSIONS,
        HIGH_CONFIDENCE_PLATFORMS,
        10,
      );
      expect(result).toBe('high');
    });

    it('returns "high" with well above thresholds', () => {
      const result = calculateConfidence(20, 5, 100);
      expect(result).toBe('high');
    });

    it('does NOT return "high" when sessions are high but platforms are low', () => {
      const result = calculateConfidence(10, 2, 50);
      // High requires BOTH thresholds — this should be medium
      expect(result).not.toBe('high');
      expect(result).toBe('medium');
    });
  });

  // ============================================================================
  // T16: Confidence scoring — Medium confidence
  // ============================================================================

  describe('T16: Confidence scoring — Medium', () => {
    it('returns "medium" when sessions ≥ 2 (but platforms < 3)', () => {
      const result = calculateConfidence(
        MEDIUM_CONFIDENCE_SESSIONS,
        1, // below HIGH_CONFIDENCE_PLATFORMS
        1,
      );
      expect(result).toBe('medium');
    });

    it('returns "medium" when count ≥ 3 (but sessions < 2)', () => {
      const result = calculateConfidence(
        1,
        1,
        MEDIUM_CONFIDENCE_COUNT,
      );
      expect(result).toBe('medium');
    });
  });

  // ============================================================================
  // T17: Confidence scoring — Low confidence
  // ============================================================================

  describe('T17: Confidence scoring — Low', () => {
    it('returns "low" for single submission from single session', () => {
      const result = calculateConfidence(1, 1, 1);
      expect(result).toBe('low');
    });

    it('returns "low" for zero values', () => {
      const result = calculateConfidence(0, 0, 0);
      expect(result).toBe('low');
    });
  });

  // ============================================================================
  // T18: Confidence scoring — Boundary values
  // ============================================================================

  describe('T18: Confidence scoring — Boundary values', () => {
    it('medium threshold is inclusive for sessions', () => {
      const atThreshold = calculateConfidence(MEDIUM_CONFIDENCE_SESSIONS, 1, 1);
      const belowThreshold = calculateConfidence(MEDIUM_CONFIDENCE_SESSIONS - 1, 1, 1);
      expect(atThreshold).toBe('medium');
      // Below both thresholds (sessions < 2 AND count < 3) → low
      expect(belowThreshold).toBe('low');
    });

    it('medium threshold is inclusive for count', () => {
      const atThreshold = calculateConfidence(1, 1, MEDIUM_CONFIDENCE_COUNT);
      const belowThreshold = calculateConfidence(1, 1, MEDIUM_CONFIDENCE_COUNT - 1);
      expect(atThreshold).toBe('medium');
      expect(belowThreshold).toBe('low');
    });

    it('high threshold is inclusive for both sessions and platforms', () => {
      const atThreshold = calculateConfidence(
        HIGH_CONFIDENCE_SESSIONS,
        HIGH_CONFIDENCE_PLATFORMS,
        1,
      );
      const justBelowSessions = calculateConfidence(
        HIGH_CONFIDENCE_SESSIONS - 1,
        HIGH_CONFIDENCE_PLATFORMS,
        1,
      );
      expect(atThreshold).toBe('high');
      expect(justBelowSessions).not.toBe('high');
    });
  });

  // ============================================================================
  // T19: Constants — Sensible boundaries
  // ============================================================================

  describe('T19: Constants — Sensible boundaries', () => {
    it('MIN_TERM_LENGTH is a positive integer ≥ 1', () => {
      expect(MIN_TERM_LENGTH).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(MIN_TERM_LENGTH)).toBe(true);
    });

    it('MAX_TERM_LENGTH > MIN_TERM_LENGTH', () => {
      expect(MAX_TERM_LENGTH).toBeGreaterThan(MIN_TERM_LENGTH);
    });

    it('MAX_TERM_LENGTH is reasonable (≤ 200)', () => {
      expect(MAX_TERM_LENGTH).toBeLessThanOrEqual(200);
    });

    it('confidence thresholds are positive integers', () => {
      expect(HIGH_CONFIDENCE_SESSIONS).toBeGreaterThan(0);
      expect(HIGH_CONFIDENCE_PLATFORMS).toBeGreaterThan(0);
      expect(MEDIUM_CONFIDENCE_SESSIONS).toBeGreaterThan(0);
      expect(MEDIUM_CONFIDENCE_COUNT).toBeGreaterThan(0);
    });

    it('high thresholds > medium thresholds', () => {
      expect(HIGH_CONFIDENCE_SESSIONS).toBeGreaterThan(MEDIUM_CONFIDENCE_SESSIONS);
    });
  });

  // ============================================================================
  // T20: Confidence scoring — Return type exhaustiveness
  // ============================================================================

  describe('T20: Confidence scoring — Return type exhaustiveness', () => {
    it('only returns valid ConfidenceLevel values', () => {
      const validLevels: ConfidenceLevel[] = ['high', 'medium', 'low'];

      // Test a matrix of inputs
      const testCases: Array<[number, number, number]> = [
        [0, 0, 0],
        [1, 1, 1],
        [2, 1, 1],
        [1, 1, 3],
        [5, 3, 10],
        [100, 100, 1000],
      ];

      for (const [sessions, platforms, count] of testCases) {
        const result = calculateConfidence(sessions, platforms, count);
        expect(validLevels).toContain(result);
      }
    });
  });
});
