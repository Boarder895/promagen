// src/lib/call-3-transforms/scene-premise.ts
// ============================================================================
// T_SCENE_PREMISE — First-sentence scene premise enforcement
// ============================================================================
// Architecture: call-3-quality-architecture-v0.2.0.md §4.2
// Build plan:   call-3-quality-build-plan-v1.md §9.2
//
// Ensures the first sentence of a prose-style prompt establishes the
// scene premise: who/what + where + doing what. T5 and proprietary
// NL platforms benefit from a strong opening sentence that gives the
// diffusion model a clear scene anchor.
//
// Unlike T_SUBJECT_FRONT (which moves an existing subject to the front),
// T_SCENE_PREMISE validates that the first sentence is structurally
// complete. If the first sentence is just atmosphere ("A dark and moody
// scene") without a subject or setting, the transform flags it but does
// NOT rewrite — rewriting is a GPT transform (T_PROSE_RESTRUCTURE).
//
// Active on T5, llm_semantic, and some proprietary platforms.
// Pure function. No GPT cost. No content invented.
// ============================================================================

import type { AnchorManifest } from '@/lib/optimise-prompts/preflight';
import type { PlatformDNA } from '@/data/platform-dna/types';
import type { TransformOutput } from './transform-types';

// ============================================================================
// SCENE PREMISE ANALYSIS
// ============================================================================

/**
 * Weak opener patterns: first sentences that set mood but not scene.
 * These are NOT rewritten — they produce a diagnostic change message
 * so the user can see the gap. Rewriting is T_PROSE_RESTRUCTURE's job.
 */
const WEAK_OPENER_PATTERNS: readonly RegExp[] = [
  // "A dark and moody scene" — no subject or setting
  /^(?:a|an|the)\s+(?:dark|moody|ethereal|dreamlike|surreal|abstract|mysterious|dramatic)\s+(?:and\s+\w+\s+)?(?:scene|image|picture|composition|artwork)\b/i,
  // "In the style of..." — style-first, no scene
  /^in\s+the\s+style\s+of\b/i,
  // "A photo of..." or "An image of..." — meta-description
  /^(?:a|an)\s+(?:photo|photograph|image|picture|painting|illustration|render|rendering)\s+of\b/i,
  // Just adjectives: "Dark, moody, atmospheric."
  /^(?:\w+,\s*){2,}\w+\.?$/i,
];

/**
 * Strong scene elements: subject nouns, setting nouns, action verbs.
 */
const SUBJECT_INDICATORS = /\b(?:man|woman|person|figure|child|girl|boy|warrior|knight|wizard|keeper|sailor|traveler|creature|dragon|wolf|fox|cat|dog|horse|bird|tree|building|tower|castle|lighthouse|ship|boat|car)\b/i;
const SETTING_INDICATORS = /\b(?:on|in|at|near|beside|above|below|along|across|through|within)\s+(?:a|an|the)\s+\w+/i;
const ACTION_INDICATORS = /\b(?:stands?|sits?|walks?|runs?|holds?|watches?|gazes?|leans?|grips?|pauses?|waits?|crouches?|faces?|turns?|floats?|drifts?|burns?|glows?|rises?|hangs?|falls?|flies?|climbs?|reaches?|carries?|wears?)\b/i;

/**
 * Score the first sentence for scene premise completeness.
 * Returns 0.0–1.0 where 1.0 = perfect scene premise.
 */
function scoreScenePremise(firstSentence: string): {
  score: number;
  hasSubject: boolean;
  hasSetting: boolean;
  hasAction: boolean;
  isWeakOpener: boolean;
} {
  const hasSubject = SUBJECT_INDICATORS.test(firstSentence);
  const hasSetting = SETTING_INDICATORS.test(firstSentence);
  const hasAction = ACTION_INDICATORS.test(firstSentence);
  const isWeakOpener = WEAK_OPENER_PATTERNS.some((p) => p.test(firstSentence.trim()));

  let score = 0;
  if (hasSubject) score += 0.4;
  if (hasSetting) score += 0.3;
  if (hasAction) score += 0.2;
  if (!isWeakOpener) score += 0.1;

  return { score, hasSubject, hasSetting, hasAction, isWeakOpener };
}

// ============================================================================
// TRANSFORM
// ============================================================================

/**
 * T_SCENE_PREMISE — Validate first-sentence scene premise.
 *
 * Algorithm:
 *   1. Extract first sentence
 *   2. Score for subject + setting + action presence
 *   3. If score is high (≥0.7), pass — scene is anchored
 *   4. If score is low, report diagnostic but do NOT rewrite
 *   5. If the opener is a known weak pattern, flag it specifically
 *
 * This transform is diagnostic-first: it tells the user (and the
 * pipeline) what's missing, but doesn't invent content. The GPT
 * transform T_PROSE_RESTRUCTURE handles actual rewrites.
 *
 * Returns unchanged text always (diagnostic only, no modifications).
 */
export function scenePremise(
  text: string,
  _anchors: AnchorManifest,
  _dna: PlatformDNA,
): TransformOutput {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { text: trimmed, changes: [] };
  }

  // ── Extract first sentence ─────────────────────────────────────────
  // Match up to the first period followed by space+uppercase, or end
  const sentenceEnd = trimmed.search(/\.\s+[A-Z]/);
  const firstSentence = sentenceEnd > 0
    ? trimmed.slice(0, sentenceEnd + 1)
    : trimmed;

  // ── Score ───────────────────────────────────────────────────────────
  const premise = scoreScenePremise(firstSentence);
  const changes: string[] = [];

  if (premise.score >= 0.7) {
    // Strong premise — no action needed
    return { text: trimmed, changes: [] };
  }

  // ── Build diagnostic ───────────────────────────────────────────────
  const missing: string[] = [];
  if (!premise.hasSubject) missing.push('subject');
  if (!premise.hasSetting) missing.push('setting');
  if (!premise.hasAction) missing.push('action');

  if (premise.isWeakOpener) {
    changes.push(
      `Scene premise: weak opener detected — first sentence sets mood but not scene (missing: ${missing.join(', ')})`,
    );
  } else if (missing.length > 0) {
    changes.push(
      `Scene premise: first sentence missing ${missing.join(' and ')} — scene anchor could be stronger`,
    );
  }

  // Text is NOT modified — diagnostics only
  return {
    text: trimmed,
    changes,
  };
}
