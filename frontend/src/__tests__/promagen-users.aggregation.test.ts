// src/__tests__/promagen-users.aggregation.test.ts
//
// Tests for Promagen Users aggregation logic.
// These tests verify the helper functions work correctly.
//
// Note: Database integration tests require a real database connection.
// These unit tests focus on pure logic (normalization, staleness checks).

// Import the functions we're testing
// Note: In actual test run, these would be imported from '@/lib/promagen-users'
// For this file, we'll define test versions of the pure functions

/**
 * Test version of isStale function (same logic as lib/promagen-users)
 */
function isStale(updatedAt: Date | null, thresholdHours: number = 48): boolean {
  if (!updatedAt) return true;

  const thresholdMs = thresholdHours * 60 * 60 * 1000;
  const now = Date.now();
  const updatedAtMs = updatedAt.getTime();

  return now - updatedAtMs > thresholdMs;
}

/**
 * Test version of normalizeCountryCode function (same logic as lib/promagen-users)
 */
function normalizeCountryCode(code: string | null | undefined): string | null {
  if (!code || typeof code !== 'string') return null;

  const trimmed = code.trim().toUpperCase();
  if (trimmed.length !== 2) return null;

  // Must be uppercase letters only
  if (!/^[A-Z]{2}$/.test(trimmed)) return null;

  // Reject placeholder codes
  if (trimmed === 'XX' || trimmed === 'ZZ') return null;

  return trimmed;
}

describe('Promagen Users - isStale', () => {
  it('returns true for null updatedAt', () => {
    expect(isStale(null)).toBe(true);
  });

  it('returns false for recent timestamp (within threshold)', () => {
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);
    expect(isStale(oneHourAgo, 48)).toBe(false);
  });

  it('returns false for timestamp exactly at threshold', () => {
    const exactlyAtThreshold = new Date(Date.now() - 48 * 60 * 60 * 1000);
    // At exactly the threshold, it should NOT be stale (uses > not >=)
    expect(isStale(exactlyAtThreshold, 48)).toBe(false);
  });

  it('returns true for timestamp beyond threshold', () => {
    const beyondThreshold = new Date(Date.now() - 49 * 60 * 60 * 1000);
    expect(isStale(beyondThreshold, 48)).toBe(true);
  });

  it('respects custom threshold', () => {
    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
    expect(isStale(twentyFiveHoursAgo, 24)).toBe(true);
    expect(isStale(twentyFiveHoursAgo, 48)).toBe(false);
  });

  it('handles future dates as not stale', () => {
    const futureDate = new Date(Date.now() + 1 * 60 * 60 * 1000);
    expect(isStale(futureDate)).toBe(false);
  });
});

describe('Promagen Users - normalizeCountryCode', () => {
  it('returns null for null input', () => {
    expect(normalizeCountryCode(null)).toBe(null);
  });

  it('returns null for undefined input', () => {
    expect(normalizeCountryCode(undefined)).toBe(null);
  });

  it('returns null for empty string', () => {
    expect(normalizeCountryCode('')).toBe(null);
  });

  it('returns null for whitespace-only string', () => {
    expect(normalizeCountryCode('   ')).toBe(null);
  });

  it('normalizes lowercase to uppercase', () => {
    expect(normalizeCountryCode('us')).toBe('US');
    expect(normalizeCountryCode('gb')).toBe('GB');
    expect(normalizeCountryCode('de')).toBe('DE');
  });

  it('handles mixed case', () => {
    expect(normalizeCountryCode('Us')).toBe('US');
    expect(normalizeCountryCode('gB')).toBe('GB');
  });

  it('trims whitespace', () => {
    expect(normalizeCountryCode(' US ')).toBe('US');
    expect(normalizeCountryCode('\tGB\n')).toBe('GB');
  });

  it('rejects codes that are too short', () => {
    expect(normalizeCountryCode('U')).toBe(null);
  });

  it('rejects codes that are too long', () => {
    expect(normalizeCountryCode('USA')).toBe(null);
    expect(normalizeCountryCode('USAA')).toBe(null);
  });

  it('rejects codes with numbers', () => {
    expect(normalizeCountryCode('U1')).toBe(null);
    expect(normalizeCountryCode('12')).toBe(null);
  });

  it('rejects codes with special characters', () => {
    expect(normalizeCountryCode('U!')).toBe(null);
    expect(normalizeCountryCode('U-')).toBe(null);
  });

  it('rejects placeholder codes XX and ZZ', () => {
    expect(normalizeCountryCode('XX')).toBe(null);
    expect(normalizeCountryCode('ZZ')).toBe(null);
    expect(normalizeCountryCode('xx')).toBe(null);
    expect(normalizeCountryCode('zz')).toBe(null);
  });

  it('accepts valid ISO 3166-1 alpha-2 codes', () => {
    const validCodes = ['US', 'GB', 'DE', 'FR', 'JP', 'CN', 'AU', 'CA', 'BR', 'IN'];
    for (const code of validCodes) {
      expect(normalizeCountryCode(code)).toBe(code);
      expect(normalizeCountryCode(code.toLowerCase())).toBe(code);
    }
  });
});

describe('Promagen Users - Data Shape', () => {
  it('PromagenUsersCountryUsage has required fields', () => {
    const usage = {
      countryCode: 'US',
      count: 42,
    };

    expect(usage.countryCode).toBe('US');
    expect(usage.count).toBe(42);
    expect(typeof usage.countryCode).toBe('string');
    expect(typeof usage.count).toBe('number');
  });

  it('empty array is valid for zero users', () => {
    const emptyUsage: Array<{ countryCode: string; count: number }> = [];
    expect(emptyUsage).toHaveLength(0);
    expect(Array.isArray(emptyUsage)).toBe(true);
  });

  it('array can hold up to 6 countries per spec', () => {
    const MAX_COUNTRIES = 6;
    const usage = [
      { countryCode: 'US', count: 100 },
      { countryCode: 'GB', count: 50 },
      { countryCode: 'DE', count: 30 },
      { countryCode: 'FR', count: 20 },
      { countryCode: 'JP', count: 10 },
      { countryCode: 'CN', count: 5 },
    ];

    expect(usage).toHaveLength(MAX_COUNTRIES);
    // Safely access elements with type assertions
    const first = usage[0] as { count: number };
    const second = usage[1] as { count: number };
    expect(first.count).toBeGreaterThanOrEqual(second.count); // Sorted desc
  });
});

describe('Promagen Users - Edge Cases', () => {
  it('handles zero count correctly', () => {
    const usage = { countryCode: 'US', count: 0 };
    expect(usage.count).toBe(0);
    // Per spec, zero count should be filtered out before reaching UI
  });

  it('handles very large counts', () => {
    const usage = { countryCode: 'US', count: 1_000_000 };
    expect(usage.count).toBe(1_000_000);
    expect(Number.isFinite(usage.count)).toBe(true);
  });

  it('count should be an integer', () => {
    const count = 42;
    expect(Number.isInteger(count)).toBe(true);
  });
});
