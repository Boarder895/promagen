// src/lib/call-2-harness/mechanical-scorer/t3-rules.ts
// ============================================================================
// T3 (Natural Language) Mechanical Rules
// ============================================================================
// Deterministic rules extracted from buildSystemPrompt() in
// src/app/api/generate-tier-prompts/route.ts (Call 2 v4.5).
//
// Subjective rules (mood conversion quality, verb fidelity correctness,
// expert value-add genuineness, gender pronoun matching) are deferred to
// the judged scorer in Phase F. The mechanical scorer here checks length,
// structure, banned phrases, banned tail constructions, and the first-8-word
// echo signature.
//
// Cluster mapping per architecture §10.1 (cluster-schema-v1).
// ============================================================================

import type { RuleDefinition } from './types';

// ── Constants ──────────────────────────────────────────────────────────────

const T3_MIN_CHARS = 280;
const T3_MAX_CHARS = 420;
const T3_MIN_SENTENCES = 2;
const T3_MAX_SENTENCES = 3;

/**
 * Banned phrases verbatim from the production system prompt T3 section.
 * These are paraphrase tells — when GPT writes "the scene feels..." it's
 * giving meta-commentary instead of writing as a visual director.
 */
const T3_BANNED_PHRASES: readonly string[] = [
  'rendered as',
  'in the style of',
  'should feel like',
  'meant to look like',
  'designed to resemble',
  'intended to appear as',
  'the image should',
  'the scene feels',
  'the scene is',
  'the mood is',
  'that feels',
  'gives the scene',
];

/**
 * Banned tail constructions from production prompt:
 *   "captured" + (in|with|like|as|through)
 *   "shot with [style]"
 *   "all framed in [style]"
 *   "in cinematic [anything]" appended at end
 */
const T3_BANNED_TAIL_PATTERNS: readonly RegExp[] = [
  /\bcaptured\s+(?:in|with|like|as|through)\b/i,
  /\bshot\s+with\s+\w+/i,
  /\ball\s+framed\s+in\b/i,
  /\bin\s+cinematic\s+\w+/i,
];

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Count sentences. A sentence ends with . / ! / ? followed by either a space
 * or end-of-string. This is the same heuristic the production system prompt
 * implies (the architecture talks about "2–3 sentences").
 */
function countSentences(text: string): number {
  const matches = text.match(/[.!?](?:\s+|$)/g);
  return matches?.length ?? 0;
}

/**
 * Get the first N words of a string, lowercased and whitespace-collapsed.
 */
function firstNWords(text: string, n: number): string[] {
  return text
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, n);
}

// ── Rule definitions ───────────────────────────────────────────────────────

export const T3_RULES: readonly RuleDefinition[] = Object.freeze([
  // ── R1: char count in [280, 420] ────────────────────────────────────────
  {
    id: 'T3.char_count_in_range',
    tier: 3,
    cluster: 'tier_drift',
    description: 'T3 must be 280–420 characters. Below = sparse paraphrase. Above = bloated.',
    check(bundle) {
      const len = bundle.tier3.positive.length;
      if (len < T3_MIN_CHARS || len > T3_MAX_CHARS) {
        return {
          passed: false,
          details: `T3 length ${len}, expected [${T3_MIN_CHARS}, ${T3_MAX_CHARS}]`,
        };
      }
      return { passed: true };
    },
  },

  // ── R2: sentence count in [2, 3] ────────────────────────────────────────
  {
    id: 'T3.sentence_count_2_to_3',
    tier: 3,
    cluster: 'tier_drift',
    description: 'T3 must be 2 or 3 sentences (visual-director cadence).',
    check(bundle) {
      const count = countSentences(bundle.tier3.positive);
      if (count < T3_MIN_SENTENCES || count > T3_MAX_SENTENCES) {
        return {
          passed: false,
          details: `T3 has ${count} sentences, expected ${T3_MIN_SENTENCES}-${T3_MAX_SENTENCES}`,
        };
      }
      return { passed: true };
    },
  },

  // ── R3: no banned phrases ───────────────────────────────────────────────
  {
    id: 'T3.no_banned_phrases',
    tier: 3,
    cluster: 'paraphrase_echo_collapse',
    description: 'T3 must not contain meta-commentary phrases ("the scene feels", "rendered as", etc.).',
    check(bundle) {
      const text = bundle.tier3.positive.toLowerCase();
      const found = T3_BANNED_PHRASES.filter((p) => text.includes(p));
      if (found.length > 0) {
        return {
          passed: false,
          details: `Banned phrases: ${found.slice(0, 3).join(', ')}`,
        };
      }
      return { passed: true };
    },
  },

  // ── R4: no banned tail constructions ────────────────────────────────────
  {
    id: 'T3.no_banned_tail_constructions',
    tier: 3,
    cluster: 'paraphrase_echo_collapse',
    description: 'T3 must not end with detached style/rendering phrases ("captured in cinematic detail").',
    check(bundle) {
      const text = bundle.tier3.positive;
      // Check the last sentence specifically — banned tail = appended at end
      const sentences = text.split(/[.!?]\s*/).filter((s) => s.trim().length > 0);
      const last = sentences[sentences.length - 1] ?? '';
      for (const pat of T3_BANNED_TAIL_PATTERNS) {
        if (pat.test(last)) {
          return {
            passed: false,
            details: `Banned tail construction in final sentence: "...${last.slice(-50)}"`,
          };
        }
      }
      return { passed: true };
    },
  },

  // ── R5: first 8 words must NOT echo the user input ──────────────────────
  {
    id: 'T3.first_8_words_no_echo',
    tier: 3,
    cluster: 'paraphrase_echo_collapse',
    description: 'T3 first 8 words must not closely echo the user input — restructure, do not paraphrase.',
    check(bundle, ctx) {
      const t3Words = firstNWords(bundle.tier3.positive, 8);
      const inputWords = firstNWords(ctx.input, 8);
      const compareLen = Math.min(t3Words.length, inputWords.length);
      if (compareLen === 0) return { passed: true };

      let positionMatches = 0;
      for (let i = 0; i < compareLen; i += 1) {
        if (t3Words[i] === inputWords[i]) positionMatches += 1;
      }

      // 6 of 8 in-position matches = paraphrase failure (per system prompt rule)
      if (positionMatches >= 6) {
        return {
          passed: false,
          details: `T3 first 8 words echo input (${positionMatches}/${compareLen} positional matches): "${t3Words.join(' ')}"`,
        };
      }
      return { passed: true };
    },
  },
]);
