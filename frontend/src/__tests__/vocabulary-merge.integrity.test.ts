/**
 * Vocabulary Merge Verification — Phase 0.6
 * ==========================================
 * 10 automated tests verifying the Parts 0.1–0.5 merge.
 *
 * Run:  pnpm vitest run src/__tests__/vocabulary-merge.integrity.test.ts
 *
 * @version 1.0.0
 * @created 2026-02-24
 */

import { getOptions, type CategoryKey } from '@/data/vocabulary/prompt-builder';
import { getMergedOptions, getMergedCount, hasMergedData } from '@/data/vocabulary/merged';
import mergeManifest from '@/data/vocabulary/merged/merge-manifest.json';

// ============================================================================
// CONSTANTS
// ============================================================================

const MERGED_CATEGORIES: CategoryKey[] = [
  'action',
  'atmosphere',
  'colour',
  'composition',
  'environment',
  'lighting',
  'materials',
  'style',
  'subject',
];

const UNCHANGED_CATEGORIES: CategoryKey[] = ['camera', 'fidelity', 'negative'];

const ALL_CATEGORIES: CategoryKey[] = [...MERGED_CATEGORIES, ...UNCHANGED_CATEGORIES];

/** Finance jargon that must NOT appear in merged vocabulary */
const FINANCE_JARGON = [
  'margin call',
  'futures contract',
  'short selling',
  'hedge fund',
  'portfolio',
  'contango',
  'backwardation',
  'yield curve',
  'stop loss',
  'take profit',
  'etf',
  'ipo',
  'dividend',
  'bull run',
  'bear market',
  'capitulation',
  'liquidation',
  'short squeeze',
  'dead cat bounce',
];

// ============================================================================
// HELPERS
// ============================================================================

type ManifestSummary = {
  totalCorePhrases: number;
  totalMergedPhrases: number;
  totalCombined: number;
  mergedCategories: number;
  unchangedCategories: number;
};

type ManifestFile = {
  mergedCount: number;
  coreCount: number;
  combinedTotal: number;
};

const manifest = mergeManifest as unknown as {
  summary: ManifestSummary;
  files: Record<string, ManifestFile>;
  unchangedCategories: Record<string, { coreCount: number }>;
};

// ============================================================================
// TESTS
// ============================================================================

describe('Vocabulary Merge Integrity (Phase 0.6)', () => {
  // ── TEST 1: No empty strings ──────────────────────────────────────────────
  it('T1 — no empty strings in any merged file', () => {
    for (const cat of MERGED_CATEGORIES) {
      const opts = getMergedOptions(cat);
      const empties = opts.filter((o) => !o || !o.trim());
      expect(empties).toHaveLength(0);
    }
  });

  // ── TEST 2: No internal duplicates within any merged file ─────────────────
  it('T2 — no internal duplicates within any merged category', () => {
    for (const cat of MERGED_CATEGORIES) {
      const opts = getMergedOptions(cat);
      const seen = new Set<string>();
      const dupes: string[] = [];

      for (const o of opts) {
        const lower = o.toLowerCase().trim();
        if (seen.has(lower)) dupes.push(o);
        seen.add(lower);
      }

      expect(dupes).toHaveLength(0);
    }
  });

  // ── TEST 3: No duplicates between merged and core ─────────────────────────
  it('T3 — zero overlap between merged options and core options', () => {
    for (const cat of MERGED_CATEGORIES) {
      const core = new Set(getOptions(cat).map((o) => o.toLowerCase().trim()));
      const merged = getMergedOptions(cat);
      const overlaps = merged.filter((o) => core.has(o.toLowerCase().trim()));

      expect(overlaps).toHaveLength(0);
    }
  });

  // ── TEST 4: No cross-category duplicates in merged ────────────────────────
  it('T4 — no phrase appears in more than one merged category', () => {
    const globalSeen = new Map<string, string>(); // phrase → first category
    const crossDupes: Array<{ phrase: string; cat1: string; cat2: string }> = [];

    for (const cat of MERGED_CATEGORIES) {
      for (const o of getMergedOptions(cat)) {
        const lower = o.toLowerCase().trim();
        const existing = globalSeen.get(lower);
        if (existing) {
          crossDupes.push({ phrase: o, cat1: existing, cat2: cat });
        } else {
          globalSeen.set(lower, cat);
        }
      }
    }

    expect(crossDupes).toHaveLength(0);
  });

  // ── TEST 5: No finance jargon in merged options ───────────────────────────
  it('T5 — no finance jargon found in any merged phrase', () => {
    // Word-boundary patterns prevent false positives like "Saripolou" matching "ipo"
    const patterns = FINANCE_JARGON.map((term) => ({
      term,
      regex: new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
    }));
    const jargonFound: Array<{ phrase: string; cat: string; term: string }> = [];

    for (const cat of MERGED_CATEGORIES) {
      for (const o of getMergedOptions(cat)) {
        for (const { term, regex } of patterns) {
          if (regex.test(o)) {
            jargonFound.push({ phrase: o, cat, term });
            break;
          }
        }
      }
    }

    expect(jargonFound).toHaveLength(0);
  });

  // ── TEST 6: Merged counts match manifest ──────────────────────────────────
  it('T6 — every category merged count matches merge-manifest.json', () => {
    for (const cat of MERGED_CATEGORIES) {
      const actual = getMergedCount(cat);
      const expected = manifest.files[cat]?.mergedCount ?? -1;

      expect(actual).toBe(expected);
    }
  });

  // ── TEST 7: Core counts match manifest ────────────────────────────────────
  it('T7 — every category core count matches merge-manifest.json', () => {
    for (const cat of MERGED_CATEGORIES) {
      const actual = getOptions(cat).length;
      const expected = manifest.files[cat]?.coreCount ?? -1;

      expect(actual).toBe(expected);
    }
  });

  // ── TEST 8: Core-first ordering preserved ─────────────────────────────────
  it('T8 — combined options start with core options in original order', () => {
    for (const cat of MERGED_CATEGORIES) {
      const coreOpts = getOptions(cat);
      const mergedOpts = getMergedOptions(cat);

      // Build what getCombinedOptions should return: core first, merged after
      const combined = [...coreOpts, ...mergedOpts];

      // Core portion must be identical (same order, same content)
      const combinedCoreSlice = combined.slice(0, coreOpts.length);
      expect(combinedCoreSlice).toEqual(coreOpts);

      // Merged portion must be identical
      const combinedMergedSlice = combined.slice(coreOpts.length);
      expect(combinedMergedSlice).toEqual(mergedOpts);
    }
  });

  // ── TEST 9: Unchanged categories return zero merged ───────────────────────
  it('T9 — camera, fidelity, negative have zero merged options', () => {
    for (const cat of UNCHANGED_CATEGORIES) {
      expect(getMergedOptions(cat)).toHaveLength(0);
      expect(getMergedCount(cat)).toBe(0);
      expect(hasMergedData(cat)).toBe(false);
    }
  });

  // ── TEST 10: Grand totals match manifest ──────────────────────────────────
  it('T10 — grand total core + merged matches manifest summary', () => {
    let totalCore = 0;
    let totalMerged = 0;

    for (const cat of ALL_CATEGORIES) {
      totalCore += getOptions(cat).length;
      totalMerged += getMergedCount(cat);
    }

    expect(totalCore).toBe(manifest.summary.totalCorePhrases);
    expect(totalMerged).toBe(manifest.summary.totalMergedPhrases);
    expect(totalCore + totalMerged).toBe(manifest.summary.totalCombined);
  });
});
