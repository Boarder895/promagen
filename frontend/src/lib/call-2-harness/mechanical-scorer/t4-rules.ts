// src/lib/call-2-harness/mechanical-scorer/t4-rules.ts
// ============================================================================
// T4 (Plain Language) Mechanical Rules
// ============================================================================
// Deterministic rules extracted from buildSystemPrompt() in
// src/app/api/generate-tier-prompts/route.ts (Call 2 v4.5).
//
// Subjective rules (anchor triage correctness, value-add as conversion vs
// addition, scene depth richness) are deferred to the judged scorer in
// Phase F. The mechanical scorer here checks length, sentence-length floor,
// banned openers, banned meta-language, and the first-8-word echo signature.
//
// Cluster mapping per architecture §10.1 (cluster-schema-v1).
// ============================================================================

import type { RuleDefinition } from './types';

// ── Constants ──────────────────────────────────────────────────────────────

const T4_MAX_CHARS = 325;
const T4_MIN_WORDS_PER_SENTENCE = 10;

/**
 * Banned sentence openers — production system prompt forbids T4 sentences
 * starting with "It is" or "There is" because they're the flattest possible
 * openers.
 */
const T4_BANNED_OPENERS_RE = /^(?:it\s+is|there\s+is|there\s+are|it\s+was|there\s+was)\b/i;

/**
 * Meta-language phrases banned in T4 production system prompt.
 */
const T4_META_PHRASES: readonly string[] = [
  'fill the scene',
  'in this image',
  'the composition shows',
  'the scene has',
  'the scene shows',
  'the scene captures',
  'the image shows',
  'this image',
];

// ── Helpers ────────────────────────────────────────────────────────────────

function splitSentences(text: string): string[] {
  return text.split(/[.!?]\s*/).filter((s) => s.trim().length > 0);
}

function firstNWords(text: string, n: number): string[] {
  return text
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, n);
}

// ── Rule definitions ───────────────────────────────────────────────────────

export const T4_RULES: readonly RuleDefinition[] = Object.freeze([
  // ── R1: char count ≤ 325 ────────────────────────────────────────────────
  {
    id: 'T4.char_count_under_325',
    tier: 4,
    cluster: 'tier_drift',
    description: 'T4 must be 325 characters or fewer (raised from 250 in v4.5).',
    check(bundle) {
      const len = bundle.tier4.positive.length;
      if (len > T4_MAX_CHARS) {
        return {
          passed: false,
          details: `T4 length ${len}, expected ≤${T4_MAX_CHARS}`,
        };
      }
      return { passed: true };
    },
  },

  // ── R2: every sentence ≥ 10 words ───────────────────────────────────────
  {
    id: 'T4.min_10_words_per_sentence',
    tier: 4,
    cluster: 'tier_drift',
    description: 'Every T4 sentence must contain at least 10 words (no flat short fragments).',
    check(bundle) {
      const sentences = splitSentences(bundle.tier4.positive);
      const offenders: { idx: number; words: number }[] = [];
      for (let i = 0; i < sentences.length; i += 1) {
        const words = (sentences[i] ?? '').trim().split(/\s+/).filter(Boolean).length;
        if (words < T4_MIN_WORDS_PER_SENTENCE) {
          offenders.push({ idx: i, words });
        }
      }
      if (offenders.length > 0) {
        const summary = offenders
          .map((o) => `sentence ${o.idx + 1}: ${o.words} words`)
          .join('; ');
        return { passed: false, details: summary };
      }
      return { passed: true };
    },
  },

  // ── R3: no banned openers ───────────────────────────────────────────────
  {
    id: 'T4.no_banned_openers',
    tier: 4,
    cluster: 'paraphrase_echo_collapse',
    description: 'T4 sentences must not start with "It is", "There is", or similar flat openers.',
    check(bundle) {
      const sentences = splitSentences(bundle.tier4.positive);
      for (const s of sentences) {
        if (T4_BANNED_OPENERS_RE.test(s.trim())) {
          return {
            passed: false,
            details: `Banned opener: "${s.trim().slice(0, 30)}..."`,
          };
        }
      }
      return { passed: true };
    },
  },

  // ── R4: no meta-language ────────────────────────────────────────────────
  {
    id: 'T4.no_meta_language',
    tier: 4,
    cluster: 'paraphrase_echo_collapse',
    description: 'T4 must describe the scene, not the image. No "in this image", "the scene shows", etc.',
    check(bundle) {
      const text = bundle.tier4.positive.toLowerCase();
      const found = T4_META_PHRASES.filter((p) => text.includes(p));
      if (found.length > 0) {
        return {
          passed: false,
          details: `Meta-language: ${found.slice(0, 3).join(', ')}`,
        };
      }
      return { passed: true };
    },
  },

  // ── R5: first 8 words must NOT echo the user input ──────────────────────
  {
    id: 'T4.first_8_words_no_echo',
    tier: 4,
    cluster: 'paraphrase_echo_collapse',
    description: 'T4 first 8 words must not closely echo the user input — restructure, do not paraphrase.',
    check(bundle, ctx) {
      const t4Words = firstNWords(bundle.tier4.positive, 8);
      const inputWords = firstNWords(ctx.input, 8);
      const compareLen = Math.min(t4Words.length, inputWords.length);
      if (compareLen === 0) return { passed: true };

      let positionMatches = 0;
      for (let i = 0; i < compareLen; i += 1) {
        if (t4Words[i] === inputWords[i]) positionMatches += 1;
      }

      if (positionMatches >= 6) {
        return {
          passed: false,
          details: `T4 first 8 words echo input (${positionMatches}/${compareLen} positional matches): "${t4Words.join(' ')}"`,
        };
      }
      return { passed: true };
    },
  },
]);
