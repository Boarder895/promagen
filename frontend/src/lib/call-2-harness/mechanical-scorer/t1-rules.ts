// src/lib/call-2-harness/mechanical-scorer/t1-rules.ts
// ============================================================================
// T1 (CLIP-Based) Mechanical Rules
// ============================================================================
// Deterministic rules extracted from buildSystemPrompt() in
// src/app/api/generate-tier-prompts/route.ts (Call 2 v4.5).
//
// Subjective rules (interaction merging quality, scale-modifier richness,
// literal-language adherence) are deferred to the judged scorer in Phase F.
//
// Cluster mapping per architecture §10.1 (cluster-schema-v1).
// ============================================================================

import type { RuleDefinition } from './types';

// ── Shared regex patterns ──────────────────────────────────────────────────

const PAREN_WEIGHT_RE = /\(([^):]+):(\d+\.\d+)\)/g;
const DOUBLE_COLON_WEIGHT_RE = /(?:^|,)\s*([^,:()]+?)::(\d+\.\d+)/g;
const ANY_WEIGHT_NUMBER_RE = /[01]\.\d{2,}/g;

const QUALITY_PREFIX_TERMS = [
  'masterpiece',
  'best quality',
  'highly detailed',
  'high quality',
  'ultra detailed',
] as const;

const QUALITY_SUFFIX_TERMS = [
  'sharp focus',
  '8k',
  'intricate',
  'detailed textures',
  'high resolution',
] as const;

const ISOLATED_COLOURS = new Set([
  'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink',
  'cyan', 'magenta', 'violet', 'crimson', 'azure', 'teal',
  'brown', 'black', 'white', 'grey', 'gray', 'gold', 'silver',
  'amber', 'turquoise', 'indigo', 'maroon', 'beige',
]);

// ── Helpers ────────────────────────────────────────────────────────────────

interface WeightHit {
  readonly phrase: string;
  readonly weight: number;
  readonly position: number;
}

/**
 * Extract every weighted phrase from a T1 string, preserving textual order
 * across both parenthetical (term:1.3) and double-colon term::1.3 syntaxes.
 */
function extractWeights(text: string): WeightHit[] {
  const hits: WeightHit[] = [];
  for (const m of text.matchAll(PAREN_WEIGHT_RE)) {
    const phrase = (m[1] ?? '').trim();
    const weight = Number.parseFloat(m[2] ?? '0');
    if (phrase.length > 0 && Number.isFinite(weight)) {
      hits.push({ phrase, weight, position: m.index ?? 0 });
    }
  }
  for (const m of text.matchAll(DOUBLE_COLON_WEIGHT_RE)) {
    const phrase = (m[1] ?? '').trim();
    const weight = Number.parseFloat(m[2] ?? '0');
    if (phrase.length > 0 && Number.isFinite(weight)) {
      hits.push({ phrase, weight, position: m.index ?? 0 });
    }
  }
  hits.sort((a, b) => a.position - b.position);
  return hits;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ── Rule definitions ───────────────────────────────────────────────────────

export const T1_RULES: readonly RuleDefinition[] = Object.freeze([
  // ── R1: weight syntax matches provider format ───────────────────────────
  {
    id: 'T1.weight_syntax_correct',
    tier: 1,
    cluster: 'syntax_leak',
    description: 'T1 weight syntax matches the active provider (parenthetical, double-colon, or no weights).',
    check(bundle, ctx) {
      const text = bundle.tier1.positive;
      const wantsDoubleColon =
        ctx.providerContext?.weightingSyntax?.includes('::') ?? false;
      const wantsNoWeights =
        ctx.providerContext !== undefined &&
        ctx.providerContext.supportsWeighting === false;

      const hasParen = /\([^):]+:\d+\.\d+\)/.test(text);
      const hasDoubleColon = /\w[^,:()]*::\d+\.\d+/.test(text);

      if (wantsNoWeights) {
        if (hasParen || hasDoubleColon) {
          return {
            passed: false,
            details: 'Provider does not support weighting but T1 contains weight syntax',
          };
        }
        return { passed: true };
      }

      if (wantsDoubleColon) {
        if (hasParen) {
          return {
            passed: false,
            details: 'Provider uses :: but T1 contains parenthetical (term:N.N) syntax',
          };
        }
        return { passed: true };
      }

      // Default: parenthetical
      if (hasDoubleColon) {
        return {
          passed: false,
          details: 'Provider uses parenthetical (term:N.N) but T1 contains :: syntax',
        };
      }
      return { passed: true };
    },
  },

  // ── R2: weight steps in 0.1 increments only ─────────────────────────────
  {
    id: 'T1.weight_steps_0_1',
    tier: 1,
    cluster: 'syntax_leak',
    description: 'Weight values must be in 0.1 increments (1.1, 1.2, 1.3, 1.4 — never 1.15 or 1.25).',
    check(bundle) {
      const text = bundle.tier1.positive;
      const offenders = [...text.matchAll(ANY_WEIGHT_NUMBER_RE)].map((m) => m[0]);
      if (offenders.length > 0) {
        return {
          passed: false,
          details: `Non-0.1 weight steps: ${offenders.slice(0, 3).join(', ')}`,
        };
      }
      return { passed: true };
    },
  },

  // ── R3: weight wraps ≤4 words ───────────────────────────────────────────
  {
    id: 'T1.weight_wrap_4_words_max',
    tier: 1,
    cluster: 'syntax_leak',
    description: 'Do not weight-wrap phrases longer than 4 words. Break them into shorter terms.',
    check(bundle) {
      const text = bundle.tier1.positive;
      const offenders: string[] = [];
      for (const hit of extractWeights(text)) {
        if (wordCount(hit.phrase) > 4) {
          offenders.push(hit.phrase);
        }
      }
      if (offenders.length > 0) {
        return {
          passed: false,
          details: `Weight wraps over 4 words: ${offenders.slice(0, 2).join(' | ')}`,
        };
      }
      return { passed: true };
    },
  },

  // ── R4: quality prefix present ──────────────────────────────────────────
  {
    id: 'T1.quality_prefix_present',
    tier: 1,
    cluster: 'syntax_leak',
    description: 'T1 should open with a quality prefix (masterpiece / best quality / highly detailed / ...).',
    check(bundle) {
      const prefix = bundle.tier1.positive.toLowerCase().slice(0, 100);
      const found = QUALITY_PREFIX_TERMS.some((t) => prefix.includes(t));
      if (!found) {
        return {
          passed: false,
          details: 'No quality prefix term in first 100 chars of T1',
        };
      }
      return { passed: true };
    },
  },

  // ── R5: quality suffix present ──────────────────────────────────────────
  {
    id: 'T1.quality_suffix_present',
    tier: 1,
    cluster: 'syntax_leak',
    description: 'T1 should close with a quality suffix (sharp focus / 8K / intricate textures / ...).',
    check(bundle) {
      const text = bundle.tier1.positive.toLowerCase();
      const suffix = text.slice(Math.max(0, text.length - 100));
      const found = QUALITY_SUFFIX_TERMS.some((t) => suffix.includes(t));
      if (!found) {
        return {
          passed: false,
          details: 'No quality suffix term in last 100 chars of T1',
        };
      }
      return { passed: true };
    },
  },

  // ── R6: comma-separated keywords (not sentences) ────────────────────────
  {
    id: 'T1.comma_separated_format',
    tier: 1,
    cluster: 'tier_drift',
    description: 'T1 must be comma-separated keywords, not prose sentences.',
    check(bundle) {
      const text = bundle.tier1.positive;
      if (!text.includes(',')) {
        return { passed: false, details: 'No commas — T1 must be a keyword list' };
      }
      // Period followed by space + capital letter = sentence-like
      if (/\.\s+[A-Z]/.test(text)) {
        return {
          passed: false,
          details: 'Contains sentence-like structure (period + capital letter)',
        };
      }
      return { passed: true };
    },
  },

  // ── R7: no trailing punctuation ─────────────────────────────────────────
  {
    id: 'T1.no_trailing_punctuation',
    tier: 1,
    cluster: 'syntax_leak',
    description: 'T1 must not end with sentence-ending punctuation (no period, no !, no ?).',
    check(bundle) {
      const text = bundle.tier1.positive.trimEnd();
      if (/[.!?]$/.test(text)) {
        return {
          passed: false,
          details: `Trailing punctuation: "${text.slice(-1)}"`,
        };
      }
      return { passed: true };
    },
  },

  // ── R8: no isolated colour weights ──────────────────────────────────────
  {
    id: 'T1.no_isolated_colour_weights',
    tier: 1,
    cluster: 'syntax_leak',
    description: 'Never weight-wrap an isolated colour word — colours must always be paired with visual context.',
    check(bundle) {
      const text = bundle.tier1.positive;
      const offenders: string[] = [];
      for (const hit of extractWeights(text)) {
        const phrase = hit.phrase.toLowerCase();
        if (ISOLATED_COLOURS.has(phrase)) {
          offenders.push(hit.phrase);
        }
      }
      if (offenders.length > 0) {
        return {
          passed: false,
          details: `Isolated colour weights: ${offenders.join(', ')}`,
        };
      }
      return { passed: true };
    },
  },

  // ── R9: subject carries highest weight ──────────────────────────────────
  {
    id: 'T1.subject_highest_weight',
    tier: 1,
    cluster: 'subject_salience_loss',
    description: 'The first weighted clause (the subject) must carry the highest weight in T1.',
    check(bundle, ctx) {
      const text = bundle.tier1.positive;
      const wantsNoWeights =
        ctx.providerContext !== undefined &&
        ctx.providerContext.supportsWeighting === false;

      const hits = extractWeights(text);

      // If the provider doesn't support weighting, this rule is N/A and passes.
      if (wantsNoWeights) return { passed: true };

      if (hits.length === 0) {
        return { passed: false, details: 'T1 has no weighted terms' };
      }

      const first = hits[0]!.weight;
      const max = Math.max(...hits.map((h) => h.weight));
      if (first < max) {
        return {
          passed: false,
          details: `First weight ${first} is below max ${max} — subject is not the highest`,
        };
      }
      return { passed: true };
    },
  },
]);
