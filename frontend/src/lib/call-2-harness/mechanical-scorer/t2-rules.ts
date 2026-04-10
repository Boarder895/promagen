// src/lib/call-2-harness/mechanical-scorer/t2-rules.ts
// ============================================================================
// T2 (Midjourney Family) Mechanical Rules
// ============================================================================
// Deterministic rules extracted from buildSystemPrompt() in
// src/app/api/generate-tier-prompts/route.ts (Call 2 v4.5).
//
// Cluster mapping per architecture §10.1 (cluster-schema-v1).
// ============================================================================

import type { RuleDefinition } from './types';

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Find the start index of the parameter section (where --ar/--v/--s/--no
 * begins). Returns -1 if no parameter section is present.
 */
function findParamSectionStart(text: string): number {
  return text.search(/\s--(?:ar|v|s|no)\s/);
}

function getProseSection(text: string): string {
  const idx = findParamSectionStart(text);
  return idx === -1 ? text : text.slice(0, idx);
}

// ── Rule definitions ───────────────────────────────────────────────────────

export const T2_RULES: readonly RuleDefinition[] = Object.freeze([
  // ── R1: --ar present ────────────────────────────────────────────────────
  {
    id: 'T2.ar_param_present',
    tier: 2,
    cluster: 'syntax_leak',
    description: 'T2 must include --ar with an aspect ratio (e.g. --ar 16:9).',
    check(bundle) {
      if (!/--ar\s+\d+:\d+/.test(bundle.tier2.positive)) {
        return { passed: false, details: 'Missing --ar parameter' };
      }
      return { passed: true };
    },
  },

  // ── R2: --v present ─────────────────────────────────────────────────────
  {
    id: 'T2.v_param_present',
    tier: 2,
    cluster: 'syntax_leak',
    description: 'T2 must include --v with a version number (e.g. --v 7).',
    check(bundle) {
      if (!/--v\s+\d+/.test(bundle.tier2.positive)) {
        return { passed: false, details: 'Missing --v parameter' };
      }
      return { passed: true };
    },
  },

  // ── R3: --s present ─────────────────────────────────────────────────────
  {
    id: 'T2.s_param_present',
    tier: 2,
    cluster: 'syntax_leak',
    description: 'T2 must include --s with a stylize value (e.g. --s 500).',
    check(bundle) {
      if (!/--s\s+\d+/.test(bundle.tier2.positive)) {
        return { passed: false, details: 'Missing --s parameter' };
      }
      return { passed: true };
    },
  },

  // ── R4: --no present ────────────────────────────────────────────────────
  {
    id: 'T2.no_param_present',
    tier: 2,
    cluster: 'negative_handling_leak',
    description: 'T2 must include --no with negative terms (without --no, MJ treats negatives as positives).',
    check(bundle) {
      if (!/--no\s+\S/.test(bundle.tier2.positive)) {
        return { passed: false, details: 'Missing --no block' };
      }
      return { passed: true };
    },
  },

  // ── R5: --no exactly once (the rescue-dependency canary) ────────────────
  {
    id: 'T2.no_exactly_once',
    tier: 2,
    cluster: 'negative_handling_leak',
    description: 'The --no flag must appear EXACTLY ONCE in T2 — duplicate --no blocks are the canonical model bug.',
    check(bundle) {
      const matches = bundle.tier2.positive.match(/--no\s/g);
      const count = matches?.length ?? 0;
      if (count !== 1) {
        return {
          passed: false,
          details: `--no appears ${count} times, expected exactly 1`,
        };
      }
      return { passed: true };
    },
  },

  // ── R6: ≥3 weighted :: clauses ──────────────────────────────────────────
  {
    id: 'T2.weight_clauses_min_3',
    tier: 2,
    cluster: 'syntax_leak',
    description: 'T2 must contain at least 3 weighted :: clauses in the prose section.',
    check(bundle) {
      const prose = getProseSection(bundle.tier2.positive);
      const matches = prose.match(/::\d+\.\d+/g);
      const count = matches?.length ?? 0;
      if (count < 3) {
        return {
          passed: false,
          details: `${count} weighted :: clauses, expected ≥3`,
        };
      }
      return { passed: true };
    },
  },

  // ── R7: no mid-phrase weights ───────────────────────────────────────────
  {
    id: 'T2.no_mid_phrase_weights',
    tier: 2,
    cluster: 'syntax_leak',
    description: 'Place :: weights at the END of complete clauses, never mid-phrase.',
    check(bundle) {
      const prose = getProseSection(bundle.tier2.positive);
      // After ::N.N, the next non-whitespace char must be a comma or end-of-prose.
      // If there are non-comma word characters following, that's mid-phrase.
      const violations: string[] = [];
      for (const m of prose.matchAll(/::(\d+\.\d+)([^,]*)/g)) {
        const after = (m[2] ?? '').trim();
        if (after.length > 0) {
          violations.push(`::${m[1]} ${after.slice(0, 30)}`);
        }
      }
      if (violations.length > 0) {
        return {
          passed: false,
          details: `Mid-phrase weight: ${violations[0]}`,
        };
      }
      return { passed: true };
    },
  },

  // ── R8: T2 negative JSON field is empty (v4.4 root-cause fix) ───────────
  {
    id: 'T2.empty_negative_json_field',
    tier: 2,
    cluster: 'negative_handling_leak',
    description: 'T2 negative JSON field must be empty string. All negatives go inline after --no in the positive field.',
    check(bundle) {
      if (bundle.tier2.negative !== '') {
        return {
          passed: false,
          details: `T2.negative is non-empty: "${bundle.tier2.negative.slice(0, 40)}..."`,
        };
      }
      return { passed: true };
    },
  },
]);
