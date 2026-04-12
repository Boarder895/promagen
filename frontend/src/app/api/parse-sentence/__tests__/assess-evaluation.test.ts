// src/app/api/parse-sentence/assess-evaluation.test.ts
// ============================================================================
// ASSESS MODE EVALUATION HARNESS — 10-Description Test Suite
// ============================================================================
// Phase A success criterion: "Assess mode categorisation tested on 10 diverse
// descriptions" with "matchedPhrases exactly match user's text."
//
// This file provides:
// 1. The canonical 10 test descriptions with expected coverage assertions
// 2. Schema validation proving the Zod contract accepts correct shapes
// 3. Schema validation proving the Zod contract rejects incorrect shapes
// 4. buildCoverageSeed() unit tests
// 5. Exact substring verification utility
//
// For live GPT testing, run: pnpm exec tsx scripts/assess-eval-live.ts
// For CI (no GPT): pnpm run test:api
//
// Authority: call-1-build-plan.md §5, prompt-lab-api-architecture-v1.1.md §5.1
// ============================================================================

import { z } from 'zod';
import { buildCoverageSeed } from '@/types/category-assessment';
import type { CoverageAssessment, CoverageSeed } from '@/types/category-assessment';

// ============================================================================
// SCHEMAS (mirrored from route — kept in sync manually)
// ============================================================================

const CategoryCoverageSchema = z.object({
  covered: z.boolean(),
  matchedPhrases: z.array(z.string().max(200)).max(20),
});

const CoverageMapSchema = z.object({
  subject: CategoryCoverageSchema,
  action: CategoryCoverageSchema,
  style: CategoryCoverageSchema,
  environment: CategoryCoverageSchema,
  composition: CategoryCoverageSchema,
  camera: CategoryCoverageSchema,
  lighting: CategoryCoverageSchema,
  colour: CategoryCoverageSchema,
  atmosphere: CategoryCoverageSchema,
  materials: CategoryCoverageSchema,
  fidelity: CategoryCoverageSchema,
  negative: CategoryCoverageSchema,
});

const VALID_CATEGORIES = [
  'subject', 'action', 'style', 'environment', 'composition', 'camera',
  'lighting', 'colour', 'atmosphere', 'materials', 'fidelity', 'negative',
] as const;

const AssessResponseSchema = z.object({
  coverage: CoverageMapSchema,
  coveredCount: z.number().int().min(0).max(12),
  totalCategories: z.literal(12),
  allSatisfied: z.boolean(),
}).refine(
  (data) => {
    const actualCount = VALID_CATEGORIES.filter(
      (cat) => data.coverage[cat].covered
    ).length;
    return data.coveredCount === actualCount;
  },
  { message: 'coveredCount does not match actual covered categories' }
).refine(
  (data) => {
    return data.allSatisfied === (data.coveredCount === 12);
  },
  { message: 'allSatisfied does not match coveredCount' }
);

// ============================================================================
// 10 CANONICAL TEST DESCRIPTIONS
// ============================================================================
// Each description defines:
//   input           — the user's text
//   mustCover       — categories that MUST be detected
//   mustNotCover    — categories that MUST NOT be detected (over-inference guard)
//   minCovered      — minimum coveredCount
//   maxCovered      — maximum coveredCount (catches over-detection)
//   substringCheck  — specific phrases that must appear verbatim as matchedPhrases
//
// Edge cases targeted:
//   1. Sparse input (2–3 categories)
//   2. Implied mood vs explicit atmosphere
//   3. Compound lighting phrase
//   4. Time-of-day as environment not lighting
//   5. Style ambiguity (cyberpunk as subject vs art style)
//   6. Rich input (8+ categories)
//   7. CLIP token handling
//   8. Negative prompt detection
//   9. Camera/composition boundary
//  10. Materials vs inferred textures
// ============================================================================

interface TestDescription {
  id: string;
  input: string;
  mustCover: string[];
  mustNotCover: string[];
  minCovered: number;
  maxCovered: number;
  substringCheck: Array<{ category: string; phrase: string }>;
}

const TEST_DESCRIPTIONS: TestDescription[] = [
  {
    id: '01-sparse',
    input: 'A cat on a sofa',
    mustCover: ['subject', 'environment'],
    mustNotCover: ['lighting', 'atmosphere', 'colour', 'materials', 'style', 'fidelity', 'camera', 'composition'],
    minCovered: 2,
    maxCovered: 3,
    substringCheck: [{ category: 'subject', phrase: 'cat' }],
  },
  {
    id: '02-implied-mood',
    input: 'A dog running in a park',
    mustCover: ['subject', 'action', 'environment'],
    mustNotCover: ['atmosphere', 'lighting', 'colour', 'materials'],
    minCovered: 3,
    maxCovered: 3,
    substringCheck: [
      { category: 'subject', phrase: 'dog' },
      { category: 'action', phrase: 'running' },
      { category: 'environment', phrase: 'park' },
    ],
  },
  {
    id: '03-compound-lighting',
    input: 'Portrait of a woman in golden hour light with soft rim lighting and lens flare',
    mustCover: ['subject', 'lighting'],
    mustNotCover: ['negative'],
    minCovered: 2,
    maxCovered: 5,
    substringCheck: [
      { category: 'lighting', phrase: 'golden hour light' },
      { category: 'lighting', phrase: 'soft rim lighting' },
    ],
  },
  {
    id: '04-sunset-is-environment',
    input: 'A samurai at sunset',
    mustCover: ['subject', 'environment'],
    mustNotCover: ['lighting', 'colour', 'atmosphere'],
    minCovered: 2,
    maxCovered: 2,
    substringCheck: [
      { category: 'subject', phrase: 'samurai' },
      { category: 'environment', phrase: 'sunset' },
    ],
  },
  {
    id: '05-cyberpunk-not-style',
    input: 'A cyberpunk courier on a motorcycle speeding through rain',
    mustCover: ['subject', 'action'],
    mustNotCover: ['style', 'materials'],
    minCovered: 2,
    maxCovered: 5,
    substringCheck: [{ category: 'subject', phrase: 'cyberpunk courier' }],
  },
  {
    id: '06-rich-input',
    input: 'Cinematic photorealistic elderly samurai standing beneath cherry blossoms in an ancient Japanese garden, golden hour, shallow depth of field, shot on 85mm lens, warm amber tones, morning mist, 8K',
    mustCover: ['subject', 'action', 'style', 'environment', 'lighting', 'composition', 'camera', 'colour', 'atmosphere', 'fidelity'],
    mustNotCover: ['negative'],
    minCovered: 10,
    maxCovered: 11,
    substringCheck: [
      { category: 'style', phrase: 'Cinematic photorealistic' },
      { category: 'camera', phrase: '85mm lens' },
      { category: 'fidelity', phrase: '8K' },
    ],
  },
  {
    id: '07-clip-tokens',
    input: '(sunset:1.2), (mountain:0.8), cinematic style, --ar 16:9',
    mustCover: ['subject', 'style'],
    mustNotCover: ['negative'],
    minCovered: 2,
    maxCovered: 5,
    substringCheck: [],
  },
  {
    id: '08-negative-detection',
    input: 'A beautiful landscape, no people, no text, without watermarks',
    mustCover: ['subject', 'negative'],
    mustNotCover: [],
    minCovered: 2,
    maxCovered: 4,
    substringCheck: [{ category: 'negative', phrase: 'no people' }],
  },
  {
    id: '09-camera-vs-composition',
    input: 'Wide shot from a low angle, 35mm lens, rule of thirds, deep depth of field',
    mustCover: ['composition', 'camera'],
    mustNotCover: ['subject', 'negative'],
    minCovered: 2,
    maxCovered: 3,
    substringCheck: [
      { category: 'camera', phrase: '35mm lens' },
      { category: 'composition', phrase: 'rule of thirds' },
    ],
  },
  {
    id: '10-materials-explicit',
    input: 'A weathered wooden boat on wet gravel beside crumbling stone walls',
    mustCover: ['subject', 'materials'],
    mustNotCover: ['lighting', 'style', 'fidelity', 'negative'],
    minCovered: 2,
    maxCovered: 4,
    substringCheck: [
      { category: 'materials', phrase: 'wet gravel' },
    ],
  },
];

// ============================================================================
// HELPERS
// ============================================================================

/** Verify every phrase in substringCheck appears verbatim in the input */
function verifySubstrings(input: string, checks: TestDescription['substringCheck']): string[] {
  return checks
    .filter(({ phrase }) => !input.includes(phrase))
    .map(({ category, phrase }) => `"${phrase}" (${category}) not found verbatim in input`);
}

/** Build a valid mock assessment from a test description */
function mockAssessment(desc: TestDescription): CoverageAssessment {
  const allCats = [
    'subject', 'action', 'style', 'environment', 'composition', 'camera',
    'lighting', 'colour', 'atmosphere', 'materials', 'fidelity', 'negative',
  ] as const;

  const coverage = {} as CoverageAssessment['coverage'];
  for (const cat of allCats) {
    const isCovered = desc.mustCover.includes(cat);
    const phrases = desc.substringCheck
      .filter((s) => s.category === cat)
      .map((s) => s.phrase);
    coverage[cat] = {
      covered: isCovered,
      matchedPhrases: isCovered ? (phrases.length > 0 ? phrases : [`mock-${cat}`]) : [],
    };
  }

  const coveredCount = desc.mustCover.length;
  return {
    coverage,
    coveredCount,
    totalCategories: 12,
    allSatisfied: coveredCount === 12,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('Assess mode evaluation harness', () => {
  // ── 1. Test description self-consistency ─────────────────────────────
  describe('Test description integrity', () => {
    for (const desc of TEST_DESCRIPTIONS) {
      it(`${desc.id}: substringCheck phrases exist verbatim in input`, () => {
        const failures = verifySubstrings(desc.input, desc.substringCheck);
        expect(failures).toEqual([]);
      });

      it(`${desc.id}: mustCover and mustNotCover do not overlap`, () => {
        const overlap = desc.mustCover.filter((c) => desc.mustNotCover.includes(c));
        expect(overlap).toEqual([]);
      });

      it(`${desc.id}: minCovered ≤ maxCovered`, () => {
        expect(desc.minCovered).toBeLessThanOrEqual(desc.maxCovered);
      });

      it(`${desc.id}: mustCover count within [minCovered, maxCovered]`, () => {
        expect(desc.mustCover.length).toBeGreaterThanOrEqual(desc.minCovered);
        expect(desc.mustCover.length).toBeLessThanOrEqual(desc.maxCovered);
      });
    }
  });

  // ── 2. Zod schema accepts valid shapes ──────────────────────────────
  describe('Schema validation — accepts correct shapes', () => {
    for (const desc of TEST_DESCRIPTIONS) {
      it(`${desc.id}: mock assessment passes schema validation`, () => {
        const mock = mockAssessment(desc);
        const result = AssessResponseSchema.safeParse(mock);
        expect(result.success).toBe(true);
      });
    }
  });

  // ── 3. Zod schema rejects bad shapes ────────────────────────────────
  describe('Schema validation — rejects invalid shapes', () => {
    it('rejects when coveredCount mismatches actual covered categories', () => {
      const mock = mockAssessment(TEST_DESCRIPTIONS[0]!);
      mock.coveredCount = 99;
      const result = AssessResponseSchema.safeParse(mock);
      expect(result.success).toBe(false);
    });

    it('rejects when totalCategories is not 12', () => {
      const mock = mockAssessment(TEST_DESCRIPTIONS[0]!);
      (mock as unknown as Record<string, unknown>).totalCategories = 10;
      const result = AssessResponseSchema.safeParse(mock);
      expect(result.success).toBe(false);
    });

    it('rejects when allSatisfied disagrees with coveredCount', () => {
      const mock = mockAssessment(TEST_DESCRIPTIONS[0]!);
      mock.allSatisfied = true; // only 2 covered, should be false
      const result = AssessResponseSchema.safeParse(mock);
      expect(result.success).toBe(false);
    });

    it('rejects matchedPhrase over 200 chars', () => {
      const mock = mockAssessment(TEST_DESCRIPTIONS[0]!);
      mock.coverage.subject.matchedPhrases = ['x'.repeat(201)];
      const result = AssessResponseSchema.safeParse(mock);
      expect(result.success).toBe(false);
    });
  });

  // ── 4. buildCoverageSeed() contract ─────────────────────────────────
  describe('buildCoverageSeed()', () => {
    it('returns only covered categories with non-empty phrases', () => {
      const mock = mockAssessment(TEST_DESCRIPTIONS[5]!); // rich input, 10 covered
      const seeds = buildCoverageSeed(mock);

      // Every seed should be a covered category
      for (const seed of seeds) {
        expect(mock.coverage[seed.category].covered).toBe(true);
        expect(seed.matchedPhrases.length).toBeGreaterThan(0);
      }

      // Uncovered categories should not appear
      const seedCats = seeds.map((s) => s.category);
      const uncovered = Object.entries(mock.coverage)
        .filter(([, v]) => !v.covered)
        .map(([k]) => k);
      for (const cat of uncovered) {
        expect(seedCats).not.toContain(cat);
      }
    });

    it('returns empty array for fully uncovered assessment', () => {
      const allCats = [
        'subject', 'action', 'style', 'environment', 'composition', 'camera',
        'lighting', 'colour', 'atmosphere', 'materials', 'fidelity', 'negative',
      ] as const;
      const coverage = {} as CoverageAssessment['coverage'];
      for (const cat of allCats) {
        coverage[cat] = { covered: false, matchedPhrases: [] };
      }
      const empty: CoverageAssessment = {
        coverage,
        coveredCount: 0,
        totalCategories: 12,
        allSatisfied: false,
      };
      expect(buildCoverageSeed(empty)).toEqual([]);
    });

    it('returns correct CoverageSeed shape', () => {
      const mock = mockAssessment(TEST_DESCRIPTIONS[2]!); // compound lighting
      const seeds = buildCoverageSeed(mock);
      for (const seed of seeds) {
        expect(seed).toHaveProperty('category');
        expect(seed).toHaveProperty('matchedPhrases');
        expect(typeof seed.category).toBe('string');
        expect(Array.isArray(seed.matchedPhrases)).toBe(true);
      }
    });
  });

  // ── 5. Exported test data for live evaluation ───────────────────────
  describe('Test descriptions are complete', () => {
    it('has exactly 10 test descriptions', () => {
      expect(TEST_DESCRIPTIONS).toHaveLength(10);
    });

    it('all 10 have unique IDs', () => {
      const ids = TEST_DESCRIPTIONS.map((d) => d.id);
      expect(new Set(ids).size).toBe(10);
    });

    it('covers all 3 required edge cases from build plan', () => {
      // Build plan §5: "manual sign-off on at least 3 edge cases"
      const hasImpliedMood = TEST_DESCRIPTIONS.some((d) => d.id.includes('implied-mood'));
      const hasCompoundLighting = TEST_DESCRIPTIONS.some((d) => d.id.includes('compound-lighting'));
      const hasSparse = TEST_DESCRIPTIONS.some((d) => d.id.includes('sparse'));
      expect(hasImpliedMood).toBe(true);
      expect(hasCompoundLighting).toBe(true);
      expect(hasSparse).toBe(true);
    });
  });
});

// ── Export for live evaluation script ────────────────────────────────────
export { TEST_DESCRIPTIONS };
export type { TestDescription };
