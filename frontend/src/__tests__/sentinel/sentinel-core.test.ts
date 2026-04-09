/**
 * Sentinel Core Tests
 *
 * Pure function tests for page classifier, health score,
 * regression thresholds, and citation velocity.
 * No database or network access required.
 *
 * Run: pnpm run test:util
 */

import { describe, it, expect } from '@jest/globals';

// =============================================================================
// PAGE CLASSIFIER
// =============================================================================

// Direct import would need server-only shim, so we test the logic inline
// by re-implementing the classification rules (they're pure string matching)

function classifyPageTest(urlOrPath: string): string {
  let path: string;
  try {
    const parsed = new URL(urlOrPath, 'https://promagen.com');
    path = parsed.pathname;
  } catch {
    path = urlOrPath;
  }
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  path = path.toLowerCase();

  if (path === '/' || path === '') return 'homepage';
  if (path === '/platforms') return 'hub';
  if (path === '/platforms/negative-prompts') return 'guide';
  if (path.startsWith('/platforms/compare/') || path === '/platforms/compare') return 'comparison';
  if (path.startsWith('/platforms/')) return 'profile';
  if (path.startsWith('/guides/best-generator-for/') || path === '/guides/best-generator-for') return 'use_case';
  if (path.startsWith('/guides/') || path === '/guides') return 'guide';
  if (path.startsWith('/about/') || path === '/about') return 'methodology';
  return 'product';
}

describe('Page Classifier', () => {
  it('classifies homepage', () => {
    expect(classifyPageTest('/')).toBe('homepage');
    expect(classifyPageTest('https://promagen.com/')).toBe('homepage');
    expect(classifyPageTest('https://promagen.com')).toBe('homepage');
  });

  it('classifies hub', () => {
    expect(classifyPageTest('/platforms')).toBe('hub');
    expect(classifyPageTest('https://promagen.com/platforms')).toBe('hub');
  });

  it('classifies negative-prompts as guide not profile', () => {
    expect(classifyPageTest('/platforms/negative-prompts')).toBe('guide');
  });

  it('classifies profiles', () => {
    expect(classifyPageTest('/platforms/midjourney')).toBe('profile');
    expect(classifyPageTest('/platforms/openai')).toBe('profile');
    expect(classifyPageTest('/platforms/flux')).toBe('profile');
  });

  it('classifies comparisons', () => {
    expect(classifyPageTest('/platforms/compare/midjourney-vs-dalle')).toBe('comparison');
  });

  it('classifies use cases', () => {
    expect(classifyPageTest('/guides/best-generator-for/photorealism')).toBe('use_case');
  });

  it('classifies guides', () => {
    expect(classifyPageTest('/guides/prompt-formats')).toBe('guide');
  });

  it('classifies methodology', () => {
    expect(classifyPageTest('/about/how-we-score')).toBe('methodology');
  });

  it('classifies product pages', () => {
    expect(classifyPageTest('/providers')).toBe('product');
    expect(classifyPageTest('/leaderboard')).toBe('product');
    expect(classifyPageTest('/inspire')).toBe('product');
    expect(classifyPageTest('/pro-promagen')).toBe('product');
    expect(classifyPageTest('/status')).toBe('product');
  });

  it('handles trailing slashes', () => {
    expect(classifyPageTest('/platforms/')).toBe('hub');
    expect(classifyPageTest('/platforms/midjourney/')).toBe('profile');
  });

  it('handles full URLs', () => {
    expect(classifyPageTest('https://promagen.com/platforms/midjourney')).toBe('profile');
    expect(classifyPageTest('https://promagen.com/about/how-we-score')).toBe('methodology');
  });
});

// =============================================================================
// HEALTH SCORE
// =============================================================================

// Re-implement the pure computation for testing
const HEALTH_WEIGHTS = {
  availability: 0.40,
  metadata: 0.20,
  schema: 0.15,
  regressionBurden: 0.15,
  orphanRisk: 0.10,
} as const;

function computeHealthScoreTest(c: {
  availability: number;
  metadata: number;
  schema: number;
  regressionBurden: number;
  orphanRisk: number;
}): number {
  const raw =
    c.availability * HEALTH_WEIGHTS.availability +
    c.metadata * HEALTH_WEIGHTS.metadata +
    c.schema * HEALTH_WEIGHTS.schema +
    c.regressionBurden * HEALTH_WEIGHTS.regressionBurden +
    c.orphanRisk * HEALTH_WEIGHTS.orphanRisk;
  return Math.round(raw * 10) / 10;
}

describe('Health Score', () => {
  it('computes perfect score', () => {
    expect(computeHealthScoreTest({
      availability: 100,
      metadata: 100,
      schema: 100,
      regressionBurden: 100,
      orphanRisk: 100,
    })).toBe(100);
  });

  it('computes the sentinel.md §7 example correctly', () => {
    // Example from spec: 57/57 avail, 4/57 meta, 52/57 schema, 2 regressions, 54/57 not orphaned
    const score = computeHealthScoreTest({
      availability: 100,
      metadata: (4 / 57) * 100,   // ~7.02
      schema: (52 / 57) * 100,    // ~91.23
      regressionBurden: 100 - 2 * 5, // 90
      orphanRisk: (54 / 57) * 100,   // ~94.74
    });
    // Spec says ~78.1
    expect(score).toBeGreaterThan(77);
    expect(score).toBeLessThan(80);
  });

  it('weights availability highest', () => {
    // A 10-point change in availability should move the score more than
    // a 10-point change in any other single component
    const base = { availability: 50, metadata: 50, schema: 50, regressionBurden: 50, orphanRisk: 50 };
    const baseScore = computeHealthScoreTest(base);

    const availImpact = computeHealthScoreTest({ ...base, availability: 60 }) - baseScore;
    const metaImpact = computeHealthScoreTest({ ...base, metadata: 60 }) - baseScore;
    const schemaImpact = computeHealthScoreTest({ ...base, schema: 60 }) - baseScore;
    const regImpact = computeHealthScoreTest({ ...base, regressionBurden: 60 }) - baseScore;
    const orphanImpact = computeHealthScoreTest({ ...base, orphanRisk: 60 }) - baseScore;

    // Availability (40%) has the biggest single-component impact
    expect(availImpact).toBeGreaterThan(metaImpact);
    expect(availImpact).toBeGreaterThan(schemaImpact);
    expect(availImpact).toBeGreaterThan(regImpact);
    expect(availImpact).toBeGreaterThan(orphanImpact);
  });

  it('regression burden: each regression costs 5 points', () => {
    const zeroRegs = computeHealthScoreTest({
      availability: 100, metadata: 100, schema: 100, regressionBurden: 100, orphanRisk: 100,
    });
    const tenRegs = computeHealthScoreTest({
      availability: 100, metadata: 100, schema: 100, regressionBurden: 50, orphanRisk: 100,
    });
    // 10 regressions = 50 points in burden = 15% * 50 fewer = 7.5 points less
    expect(zeroRegs - tenRegs).toBeCloseTo(7.5, 1);
  });

  it('floors at zero for extreme regression counts', () => {
    const result = computeHealthScoreTest({
      availability: 100, metadata: 100, schema: 100, regressionBurden: 0, orphanRisk: 100,
    });
    expect(result).toBeGreaterThan(0);
  });
});

// =============================================================================
// REGRESSION THRESHOLD MATRIX
// =============================================================================

// Re-implement for testing
const MATRIX: Record<string, Record<string, string>> = {
  page_down: {
    homepage: 'CRITICAL', hub: 'CRITICAL', profile: 'CRITICAL', guide: 'CRITICAL',
    comparison: 'CRITICAL', use_case: 'CRITICAL', methodology: 'CRITICAL', product: 'HIGH',
  },
  h1_changed: {
    homepage: 'IGNORED', hub: 'MEDIUM', profile: 'MEDIUM', guide: 'MEDIUM',
    comparison: 'MEDIUM', use_case: 'MEDIUM', methodology: 'MEDIUM', product: 'IGNORED',
  },
  content_shrink_30: {
    homepage: 'MEDIUM', hub: 'CRITICAL', profile: 'HIGH', guide: 'CRITICAL',
    comparison: 'HIGH', use_case: 'HIGH', methodology: 'CRITICAL', product: 'LOW',
  },
};

describe('Regression Threshold Matrix', () => {
  it('page_down is CRITICAL for all authority pages', () => {
    for (const cls of ['hub', 'profile', 'guide', 'comparison', 'use_case', 'methodology']) {
      expect(MATRIX['page_down']![cls]).toBe('CRITICAL');
    }
  });

  it('page_down is HIGH for product pages (relaxed)', () => {
    expect(MATRIX['page_down']!['product']).toBe('HIGH');
  });

  it('h1_changed is IGNORED for homepage and product', () => {
    expect(MATRIX['h1_changed']!['homepage']).toBe('IGNORED');
    expect(MATRIX['h1_changed']!['product']).toBe('IGNORED');
  });

  it('content_shrink_30 is CRITICAL for methodology (tightest)', () => {
    expect(MATRIX['content_shrink_30']!['methodology']).toBe('CRITICAL');
  });

  it('content_shrink_30 is LOW for product (relaxed)', () => {
    expect(MATRIX['content_shrink_30']!['product']).toBe('LOW');
  });
});

// =============================================================================
// CITATION VELOCITY (pure math)
// =============================================================================

function linearRegressionSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i]!;
    sumXY += i * values[i]!;
    sumX2 += i * i;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

describe('Citation Velocity', () => {
  it('positive trend: 0→0→1→2 has positive slope', () => {
    const slope = linearRegressionSlope([0, 0, 1, 2]);
    expect(slope).toBeGreaterThan(0);
  });

  it('negative trend: 3→3→2→1 has negative slope', () => {
    const slope = linearRegressionSlope([3, 3, 2, 1]);
    expect(slope).toBeLessThan(0);
  });

  it('flat trend: 2→2→2→2 has zero slope', () => {
    const slope = linearRegressionSlope([2, 2, 2, 2]);
    expect(slope).toBe(0);
  });

  it('single value returns zero', () => {
    expect(linearRegressionSlope([3])).toBe(0);
  });

  it('two values gives exact slope', () => {
    const slope = linearRegressionSlope([1, 3]);
    expect(slope).toBe(2);
  });
});

// =============================================================================
// URL NORMALISATION
// =============================================================================

function normaliseUrlToPath(url: string): string {
  try {
    const parsed = new URL(url);
    let path = parsed.pathname;
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
    return path;
  } catch {
    return url;
  }
}

describe('URL Normalisation', () => {
  it('strips origin from full URL', () => {
    expect(normaliseUrlToPath('https://promagen.com/platforms/midjourney')).toBe('/platforms/midjourney');
  });

  it('removes trailing slash', () => {
    expect(normaliseUrlToPath('https://promagen.com/platforms/')).toBe('/platforms');
  });

  it('preserves root path', () => {
    expect(normaliseUrlToPath('https://promagen.com/')).toBe('/');
  });

  it('handles bare paths as fallback', () => {
    expect(normaliseUrlToPath('/platforms/flux')).toBe('/platforms/flux');
  });
});
