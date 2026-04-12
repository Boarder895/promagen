// src/lib/call-3-harness/mechanical-scorer.ts
// ============================================================================
// PHASE 10 — Call 3 Mechanical Scorer
// ============================================================================
// Architecture: call-3-quality-architecture-v0.2.0.md §10
// Build plan:   call-3-quality-build-plan-v1.md §14
//
// Deterministic, per-platform mechanical quality checks for Call 3 output.
// Mirrors the Call 2 harness mechanical-scorer pattern but checks
// Call 3-specific concerns: anchor preservation, transform accuracy,
// character ceiling compliance, negative prompt quality.
//
// Pure functions. No API calls. No side effects.
// ============================================================================

import type {
  Call3RuleDefinition,
  Call3RuleContext,
  Call3RuleResult,
  Call3MechanicalResult,
  Call3Cluster,
} from './types';
import { ALL_CALL3_CLUSTERS } from './types';

// ============================================================================
// RULES — Each rule is a named, testable check
// ============================================================================

/**
 * R01: Output must not be empty.
 */
const R01_OUTPUT_NOT_EMPTY: Call3RuleDefinition = {
  id: 'R01_OUTPUT_NOT_EMPTY',
  cluster: 'quality_degradation',
  description: 'Optimised prompt must not be empty',
  severity: 'critical',
  check(ctx) {
    const passed = ctx.optimisedPrompt.trim().length > 0;
    return {
      passed,
      details: passed ? undefined : 'Optimised prompt is empty',
    };
  },
};

/**
 * R02: Output must not exceed character ceiling.
 */
const R02_CEILING_COMPLIANCE: Call3RuleDefinition = {
  id: 'R02_CEILING_COMPLIANCE',
  cluster: 'ceiling_breach',
  description: 'Output must not exceed platform character ceiling',
  severity: 'critical',
  check(ctx) {
    const len = ctx.optimisedPrompt.length;
    const passed = len <= ctx.charCeiling;
    return {
      passed,
      details: passed ? undefined : `Output ${len} chars exceeds ceiling ${ctx.charCeiling}`,
    };
  },
};

/**
 * R03: Output must not be significantly shorter than input (>50% loss).
 */
const R03_NO_CATASTROPHIC_SHORTENING: Call3RuleDefinition = {
  id: 'R03_NO_CATASTROPHIC_SHORTENING',
  cluster: 'quality_degradation',
  description: 'Output should not lose more than 50% of input length',
  severity: 'important',
  check(ctx) {
    const inputLen = ctx.assembledPrompt.length;
    const outputLen = ctx.optimisedPrompt.length;
    if (inputLen === 0) return { passed: true };
    const ratio = outputLen / inputLen;
    const passed = ratio >= 0.5;
    return {
      passed,
      details: passed ? undefined : `Output is ${Math.round(ratio * 100)}% of input (${outputLen}/${inputLen} chars)`,
    };
  },
};

/**
 * R04: Subject phrase must survive (if detectable in input).
 */
const R04_SUBJECT_SURVIVAL: Call3RuleDefinition = {
  id: 'R04_SUBJECT_SURVIVAL',
  cluster: 'anchor_loss',
  description: 'Primary subject phrase from input must appear in output',
  severity: 'critical',
  check(ctx) {
    // Simple subject detection: first noun phrase after article
    const subjectMatch = ctx.assembledPrompt.match(
      /(?:^|,\s*)(?:a|an|the|one)\s+([^,.:;!?]{3,40}?)(?:\s+(?:stands?|sits?|walks?|holds?|grips?|leans?|pauses?|watches?|gazes?|waits?)\b|,|\.|$)/i,
    );
    if (!subjectMatch) return { passed: true, details: 'No clear subject phrase detected' };

    const subject = subjectMatch[1]!.trim().toLowerCase();
    // Check for significant subject words (3+ chars) in output
    const subjectWords = subject.split(/\s+/).filter((w) => w.length >= 3);
    const outputLower = ctx.optimisedPrompt.toLowerCase();
    const survivingWords = subjectWords.filter((w) => outputLower.includes(w));
    const survivalRate = subjectWords.length > 0
      ? survivingWords.length / subjectWords.length
      : 1;

    const passed = survivalRate >= 0.6;
    return {
      passed,
      details: passed
        ? undefined
        : `Subject "${subject}" survival: ${survivingWords.length}/${subjectWords.length} words (${Math.round(survivalRate * 100)}%)`,
    };
  },
};

/**
 * R05: Named colours from input must survive.
 */
const R05_COLOUR_SURVIVAL: Call3RuleDefinition = {
  id: 'R05_COLOUR_SURVIVAL',
  cluster: 'anchor_loss',
  description: 'Named colours from input must appear in output',
  severity: 'important',
  check(ctx) {
    const colourRe = /\b(?:red|blue|green|yellow|orange|purple|violet|pink|cyan|magenta|crimson|scarlet|gold|golden|silver|copper|bronze|amber|teal|turquoise|emerald|cobalt|indigo|maroon|ivory)\b/gi;
    const inputColours = [...new Set([...ctx.assembledPrompt.matchAll(colourRe)].map((m) => m[0].toLowerCase()))];

    if (inputColours.length === 0) return { passed: true };

    const outputLower = ctx.optimisedPrompt.toLowerCase();
    const missing = inputColours.filter((c) => !outputLower.includes(c));

    const passed = missing.length === 0;
    return {
      passed,
      details: passed ? undefined : `Missing colours: ${missing.join(', ')}`,
    };
  },
};

/**
 * R06: No invented visual elements (output-only nouns not in input).
 */
const R06_NO_INVENTED_CONTENT: Call3RuleDefinition = {
  id: 'R06_NO_INVENTED_CONTENT',
  cluster: 'invented_content',
  description: 'Output should not contain visual nouns not present in input',
  severity: 'important',
  check(ctx) {
    // Quick heuristic: check for common invented-content patterns
    const inventionPatterns = [
      /\bforeground\b/i,
      /\bmidground\b/i,
      /\bbackground layer\b/i,
      /\bcomposition featuring\b/i,
      /\bcaptures the essence\b/i,
      /\bevokes a sense\b/i,
      /\bbreathes life\b/i,
    ];

    const found = inventionPatterns.filter((p) => p.test(ctx.optimisedPrompt) && !p.test(ctx.assembledPrompt));

    const passed = found.length === 0;
    return {
      passed,
      details: passed ? undefined : `Invented content detected: ${found.length} pattern(s)`,
    };
  },
};

/**
 * R07: Weight syntax must match platform expectations.
 */
const R07_SYNTAX_CONSISTENCY: Call3RuleDefinition = {
  id: 'R07_SYNTAX_CONSISTENCY',
  cluster: 'syntax_violation',
  description: 'Weight syntax in output must match platform type',
  severity: 'important',
  check(ctx) {
    const hasParenWeights = /\([^()]+:\d+\.?\d*\)/.test(ctx.optimisedPrompt);
    const hasDoubleColon = /\w+::\d+\.?\d*/.test(ctx.optimisedPrompt);
    const hasCurlyBrace = /\{{2,}[^}]+\}{2,}/.test(ctx.optimisedPrompt);
    const hasMjParams = /--(?:ar|v|s|stylize|no|style|chaos|q)\b/.test(ctx.optimisedPrompt);

    // CLIP platforms should not have MJ params
    if (ctx.path === 'deterministic' && hasMjParams) {
      return { passed: false, details: 'MJ params found in non-MJ platform output' };
    }

    // Input had weights, output should too (for weight-supporting platforms)
    const inputHadWeights = /\([^()]+:\d+\.?\d*\)|::\d+\.?\d*|\{{2,}/.test(ctx.assembledPrompt);
    const outputHasWeights = hasParenWeights || hasDoubleColon || hasCurlyBrace;
    if (inputHadWeights && !outputHasWeights) {
      return { passed: false, details: 'Input had weight syntax but output lost it' };
    }

    return { passed: true };
  },
};

/**
 * R08: Negative prompt must not contradict positive.
 */
const R08_NEGATIVE_NO_CONTRADICTION: Call3RuleDefinition = {
  id: 'R08_NEGATIVE_NO_CONTRADICTION',
  cluster: 'negative_contradiction',
  description: 'Negative prompt terms should not appear in positive prompt',
  severity: 'informational',
  check(ctx) {
    if (!ctx.negative) return { passed: true };

    const negTerms = ctx.negative.replace(/^--no\s+/, '').split(',').map((t) => t.trim().toLowerCase());
    const posLower = ctx.optimisedPrompt.toLowerCase();

    const contradictions = negTerms.filter((t) => t.length > 2 && posLower.includes(t));

    const passed = contradictions.length === 0;
    return {
      passed,
      details: passed ? undefined : `Negative terms also in positive: ${contradictions.join(', ')}`,
    };
  },
};

/**
 * R09: Retry should not fire if it never recovers (cost waste detection).
 */
const R09_RETRY_EFFECTIVENESS: Call3RuleDefinition = {
  id: 'R09_RETRY_EFFECTIVENESS',
  cluster: 'retry_waste',
  description: 'If retry was attempted, it should have been accepted',
  severity: 'informational',
  check(ctx) {
    if (!ctx.retryAttempted) return { passed: true, details: 'No retry attempted' };

    const passed = ctx.retryAccepted;
    return {
      passed,
      details: passed
        ? 'Retry was accepted — API cost justified'
        : 'Retry was attempted but rejected — API cost wasted',
    };
  },
};

/**
 * R10: At least one transform should have modified the text.
 */
const R10_TRANSFORM_ACTIVITY: Call3RuleDefinition = {
  id: 'R10_TRANSFORM_ACTIVITY',
  cluster: 'quality_degradation',
  description: 'At least one transform should modify the prompt (unless pass-through)',
  severity: 'informational',
  check(ctx) {
    if (ctx.path === 'pass_through') return { passed: true, details: 'Pass-through path' };

    const passed = ctx.optimisedPrompt !== ctx.assembledPrompt;
    return {
      passed,
      details: passed
        ? undefined
        : 'No transforms modified the prompt — output identical to input',
    };
  },
};

// ============================================================================
// RULE REGISTRY
// ============================================================================

/** All mechanical scorer rules. */
const ALL_RULES: readonly Call3RuleDefinition[] = Object.freeze([
  R01_OUTPUT_NOT_EMPTY,
  R02_CEILING_COMPLIANCE,
  R03_NO_CATASTROPHIC_SHORTENING,
  R04_SUBJECT_SURVIVAL,
  R05_COLOUR_SURVIVAL,
  R06_NO_INVENTED_CONTENT,
  R07_SYNTAX_CONSISTENCY,
  R08_NEGATIVE_NO_CONTRADICTION,
  R09_RETRY_EFFECTIVENESS,
  R10_TRANSFORM_ACTIVITY,
]);

// ============================================================================
// SCORER
// ============================================================================

/**
 * Run all mechanical quality checks for a Call 3 output.
 *
 * @param ctx  The rule context with assembled input, optimised output, and metadata
 * @returns    Mechanical result with per-rule results and cluster aggregation
 */
export function runMechanicalScorer(ctx: Call3RuleContext): Call3MechanicalResult {
  const results: Call3RuleResult[] = [];

  for (const rule of ALL_RULES) {
    try {
      const output = rule.check(ctx);
      results.push({
        ruleId: rule.id,
        cluster: rule.cluster,
        severity: rule.severity,
        passed: output.passed,
        details: output.details,
      });
    } catch (err) {
      // Rule threw — record as failure with error detail
      results.push({
        ruleId: rule.id,
        cluster: rule.cluster,
        severity: rule.severity,
        passed: false,
        details: `Rule threw: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  // ── Aggregate ──────────────────────────────────────────────────────
  const passCount = results.filter((r) => r.passed).length;
  const failCount = results.filter((r) => !r.passed).length;
  const criticalFailCount = results.filter((r) => !r.passed && r.severity === 'critical').length;

  // Per-cluster fail counts
  const failsByCluster = {} as Record<Call3Cluster, number>;
  for (const cluster of ALL_CALL3_CLUSTERS) {
    failsByCluster[cluster] = 0;
  }
  for (const r of results) {
    if (!r.passed) {
      failsByCluster[r.cluster]++;
    }
  }

  return {
    platformId: ctx.platformId,
    path: ctx.path,
    results,
    passCount,
    failCount,
    criticalFailCount,
    totalRules: results.length,
    failsByCluster,
  };
}

/** Get the list of all rule IDs (useful for test verification). */
export function getAllRuleIds(): readonly string[] {
  return ALL_RULES.map((r) => r.id);
}

/** Get the count of all rules. */
export function getRuleCount(): number {
  return ALL_RULES.length;
}
