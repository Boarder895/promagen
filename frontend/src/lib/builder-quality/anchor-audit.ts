// src/lib/builder-quality/anchor-audit.ts
// ============================================================================
// BUILDER QUALITY INTELLIGENCE — Client-Side Anchor Audit Engine
// ============================================================================
// Independently classifies each expected anchor as exact/approximate/dropped
// by scanning the optimised prompt text. Used by the batch runner to validate
// GPT's anchor audit and catch classification errors.
//
// Implements the strict §3.2 Approximate Anchor Matching Policy with all 5
// sub-rules (A–E). When in doubt, classify as `dropped` — false negatives
// (missed problems) are worse than false positives for a regression tool.
//
// v1.0.0 (3 Apr 2026): Initial implementation.
//
// Authority: docs/authority/builder-quality-intelligence.md v2.5.0 §3.2
// Existing features preserved: Yes (new file, no modifications).
// ============================================================================

import type { AnchorSpec, AnchorAuditEntry } from '@/data/scoring/types';

// =============================================================================
// KNOWN SYNONYMS — Recognised visual synonyms that count as approximate
// =============================================================================

const VISUAL_SYNONYMS: Record<string, string[]> = {
  crimson: ['deep red', 'dark red', 'blood red'],
  scarlet: ['bright red', 'vivid red'],
  amber: ['warm orange', 'golden orange'],
  azure: ['bright blue', 'sky blue'],
  ivory: ['off-white', 'cream'],
  ebony: ['jet black', 'deep black'],
  running: ['runs', 'ran', 'sprinting', 'dashing'],
  falling: ['fallen', 'falls', 'drifting', 'dropping'],
  weaving: ['weaves', 'winding', 'threading'],
  walking: ['walks', 'strolling', 'striding'],
  laughing: ['laugh', 'laughs', 'giggling', 'chuckling'],
};

// =============================================================================
// PROPER NOUN INDICATORS — Sub-rule D: exact-or-dropped, no approximate
// =============================================================================

/** Patterns that suggest a term is a proper noun, brand, or titled reference */
const PROPER_NOUN_PATTERNS = [
  /^[A-Z][a-z]+ [A-Z]/,                    // "Kodak Vision", "Blade Runner"
  /^\d{4}$/,                                 // Year: "1974"
  /\d+[A-Z]/,                               // Model number: "500T", "35BL"
  /^[A-Z]{2,}/,                             // Acronyms: "DALL-E"
];

/** Known proper nouns/brands from the test scenes */
const KNOWN_PROPER_NOUNS = new Set([
  'kodak vision3 500t',
  'arriflex 35bl',
  'blade runner 2049',
  'ghost in the shell',
  'syd mead',
  'french new wave',
]);

function isProperNoun(term: string): boolean {
  if (KNOWN_PROPER_NOUNS.has(term.toLowerCase())) return true;
  return PROPER_NOUN_PATTERNS.some((p) => p.test(term));
}

// =============================================================================
// NEGATIVE ANCHOR DETECTION — Sub-rule C
// =============================================================================

function isNegativeAnchor(term: string): boolean {
  return /^no\s+/i.test(term.trim());
}

// =============================================================================
// CORE MATCHING
// =============================================================================

/** Normalise text for comparison: lowercase, collapse whitespace, strip punctuation */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[''""]/g, "'")
    .replace(/[^\w\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Check if the normalised prompt contains an exact match for the term */
function hasExactMatch(normPrompt: string, normTerm: string): boolean {
  // Word-boundary match (handles terms at start/end of string)
  const escaped = normTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(?:^|\\W)${escaped}(?:$|\\W)`, 'i');
  return pattern.test(normPrompt);
}

/** Check for morphological variants (simple stem matching) */
function hasMorphologicalMatch(normPrompt: string, normTerm: string): boolean {
  // Check known synonyms
  const synonyms = VISUAL_SYNONYMS[normTerm];
  if (synonyms) {
    return synonyms.some((syn) => hasExactMatch(normPrompt, syn));
  }

  // Check if term is a synonym of something
  for (const [canonical, syns] of Object.entries(VISUAL_SYNONYMS)) {
    if (syns.includes(normTerm) && hasExactMatch(normPrompt, canonical)) {
      return true;
    }
  }

  // Simple -ing/-ed/-s suffix matching
  const stems = [
    normTerm.replace(/ing$/, ''),
    normTerm.replace(/ing$/, 'e'),
    normTerm.replace(/ed$/, ''),
    normTerm.replace(/ed$/, 'e'),
    normTerm.replace(/s$/, ''),
    normTerm + 'ing',
    normTerm + 'ed',
    normTerm + 's',
  ].filter((s) => s !== normTerm && s.length > 2);

  return stems.some((stem) => hasExactMatch(normPrompt, stem));
}

/** Check for reordered phrase match (all content words present nearby) */
function hasReorderedMatch(normPrompt: string, normTerm: string): boolean {
  const words = normTerm.split(' ').filter((w) => w.length > 2);
  if (words.length < 2) return false;

  // All content words must be present
  const allPresent = words.every((w) => normPrompt.includes(w));
  if (!allPresent) return false;

  // Check proximity: words should appear within a 50-char window
  const firstIdx = normPrompt.indexOf(words[0]!);
  const lastIdx = normPrompt.lastIndexOf(words[words.length - 1]!);
  if (firstIdx === -1 || lastIdx === -1) return false;

  return Math.abs(lastIdx - firstIdx) < 50 + normTerm.length;
}

// =============================================================================
// SUB-RULE CHECKS
// =============================================================================

/**
 * Sub-rule A: Visually distinctive modifier loss.
 * If the dropped modifier is the visually distinctive part, classify as dropped.
 * Example: "ornate black armor" → "black armor" = dropped (ornate is distinctive)
 */
function checkSubRuleA(normPrompt: string, normTerm: string): 'approximate' | 'dropped' | null {
  const words = normTerm.split(' ');
  if (words.length < 2) return null;

  // Check if we have a partial match (some words present, some missing)
  const present = words.filter((w) => w.length > 2 && normPrompt.includes(w));
  const missing = words.filter((w) => w.length > 2 && !normPrompt.includes(w));

  if (present.length === 0 || missing.length === 0) return null;

  // Distinctive modifiers: adjectives that change visual output significantly
  const distinctiveModifiers = [
    'ornate', 'matte', 'tactical', 'faded', 'vintage', 'weathered',
    'glowing', 'crimson', 'ancient', 'pristine', 'flickering', 'rusted',
    'startled', 'lone', 'solitary', 'shattered', 'crumbling',
  ];

  const lostDistinctive = missing.some((w) =>
    distinctiveModifiers.includes(w) || /^[a-z]+-[a-z]+$/.test(w),  // hyphenated = usually distinctive
  );

  return lostDistinctive ? 'dropped' : 'approximate';
}

/**
 * Sub-rule B: Distinctive-token loss in multi-word anchors.
 * If the specific identifier token is lost, the whole anchor is dropped.
 * Example: "French New Wave" → "French art film" = dropped
 */
function checkSubRuleB(normPrompt: string, normTerm: string): 'dropped' | null {
  const words = normTerm.split(' ').filter((w) => w.length > 2);
  if (words.length < 2) return null;

  // The last content word(s) are usually the distinctive identifier
  const identifierWords = words.slice(-Math.ceil(words.length / 2));
  const identifierPresent = identifierWords.every((w) => normPrompt.includes(w));

  if (!identifierPresent) return 'dropped';
  return null;
}

/**
 * Sub-rule C: Negative anchors are stricter.
 * Only counts as approximate when absence is stated unambiguously.
 * Example: "no smoke" → "smokeless" = approximate. "no smoke" → "clear" = dropped.
 */
function checkNegativeAnchor(
  normPrompt: string,
  normTerm: string,
): 'exact' | 'approximate' | 'dropped' {
  // Exact: the full negative phrase is present
  if (hasExactMatch(normPrompt, normTerm)) return 'exact';

  // Extract the noun from "no X"
  const noun = normTerm.replace(/^no\s+/i, '').trim();

  // Check for explicit absence language
  const explicitAbsencePatterns = [
    `without ${noun}`,
    `${noun}less`,
    `${noun}-less`,
    `${noun}-free`,
    `no ${noun}`,
    `absent ${noun}`,
    `exclude ${noun}`,
    `excluding ${noun}`,
  ];

  const hasExplicitAbsence = explicitAbsencePatterns.some((p) =>
    normPrompt.includes(p),
  );

  if (hasExplicitAbsence) return 'approximate';

  // Implicit absence (e.g. "empty scene" for "no people") = dropped per §3.2 Sub-rule C
  return 'dropped';
}

// =============================================================================
// MAIN AUDIT FUNCTION
// =============================================================================

/**
 * Audit all expected anchors against the optimised prompt text.
 * Returns a classification for each anchor following §3.2 strictly.
 *
 * @param optimisedPrompt - The Call 3 output to audit
 * @param expectedAnchors - The anchors to look for (from test scene definition)
 * @returns One AnchorAuditEntry per expected anchor
 */
export function auditAnchors(
  optimisedPrompt: string,
  expectedAnchors: AnchorSpec[],
): AnchorAuditEntry[] {
  const normPrompt = normalise(optimisedPrompt);

  return expectedAnchors.map((anchor) => {
    const normTerm = normalise(anchor.term);

    // ── Sub-rule C: Negative anchors have their own path ──────────
    if (isNegativeAnchor(anchor.term)) {
      const status = checkNegativeAnchor(normPrompt, normTerm);
      return {
        anchor: anchor.term,
        severity: anchor.severity,
        status,
        ...(status !== 'exact' && {
          note: status === 'approximate'
            ? `Negative expressed with alternative phrasing`
            : `Negative anchor not explicitly stated — implicit absence does not count (Sub-rule C)`,
        }),
      };
    }

    // ── Sub-rule D: Proper nouns — exact-or-dropped ──────────────
    if (isProperNoun(anchor.term)) {
      const isExact = hasExactMatch(normPrompt, normTerm);
      return {
        anchor: anchor.term,
        severity: anchor.severity,
        status: isExact ? 'exact' : 'dropped',
        ...(!isExact && {
          note: `Proper noun/branded reference — no approximate middle ground (Sub-rule D)`,
        }),
      };
    }

    // ── Exact match ──────────────────────────────────────────────
    if (hasExactMatch(normPrompt, normTerm)) {
      return {
        anchor: anchor.term,
        severity: anchor.severity,
        status: 'exact' as const,
      };
    }

    // ── Reordered phrase match ───────────────────────────────────
    if (hasReorderedMatch(normPrompt, normTerm)) {
      // Check Sub-rule A: was a distinctive modifier lost in the reorder?
      const subA = checkSubRuleA(normPrompt, normTerm);
      if (subA === 'dropped') {
        return {
          anchor: anchor.term,
          severity: anchor.severity,
          status: 'dropped',
          note: `Visually distinctive modifier lost (Sub-rule A)`,
        };
      }
      return {
        anchor: anchor.term,
        severity: anchor.severity,
        status: 'approximate',
        note: `Reordered but all content words preserved`,
      };
    }

    // ── Morphological / synonym match ────────────────────────────
    if (hasMorphologicalMatch(normPrompt, normTerm)) {
      return {
        anchor: anchor.term,
        severity: anchor.severity,
        status: 'approximate',
        note: `Morphological variant or recognised synonym`,
      };
    }

    // ── Sub-rule E: Compound anchors — partial match check ──────
    // Check if some words are present but distinctive modifiers are lost
    const words = normTerm.split(' ').filter((w) => w.length > 2);
    if (words.length >= 2) {
      const present = words.filter((w) => normPrompt.includes(w));
      if (present.length > 0 && present.length < words.length) {
        // Sub-rule B check
        const subB = checkSubRuleB(normPrompt, normTerm);
        if (subB === 'dropped') {
          return {
            anchor: anchor.term,
            severity: anchor.severity,
            status: 'dropped',
            note: `Distinctive identifier token lost (Sub-rule B)`,
          };
        }

        // Sub-rule A check
        const subA = checkSubRuleA(normPrompt, normTerm);
        if (subA === 'dropped') {
          return {
            anchor: anchor.term,
            severity: anchor.severity,
            status: 'dropped',
            note: `Visually distinctive modifier lost from compound anchor (Sub-rule E)`,
          };
        }

        // Partial match with non-distinctive loss = approximate
        return {
          anchor: anchor.term,
          severity: anchor.severity,
          status: 'approximate',
          note: `Partial match: ${present.join(', ')} present; ${words.filter((w) => !normPrompt.includes(w)).join(', ')} missing`,
        };
      }
    }

    // ── No match at all ──────────────────────────────────────────
    return {
      anchor: anchor.term,
      severity: anchor.severity,
      status: 'dropped',
      note: `Anchor not found in any form`,
    };
  });
}

// =============================================================================
// SUMMARY HELPERS
// =============================================================================

/** Count anchors by status */
export function countByStatus(
  audit: AnchorAuditEntry[],
): { exact: number; approximate: number; dropped: number } {
  return {
    exact: audit.filter((a) => a.status === 'exact').length,
    approximate: audit.filter((a) => a.status === 'approximate').length,
    dropped: audit.filter((a) => a.status === 'dropped').length,
  };
}

/** Count critical anchors that were dropped */
export function countCriticalDropped(audit: AnchorAuditEntry[]): number {
  return audit.filter(
    (a) => a.severity === 'critical' && a.status === 'dropped',
  ).length;
}

/** Preserved = exact + approximate */
export function countPreserved(audit: AnchorAuditEntry[]): number {
  return audit.filter(
    (a) => a.status === 'exact' || a.status === 'approximate',
  ).length;
}
