// src/lib/call-3-transforms/clause-front.ts
// ============================================================================
// T_CLAUSE_FRONT — Midjourney clause front-loading
// ============================================================================
// Architecture: call-3-quality-architecture-v0.2.0.md §4.2
// Build plan:   call-3-quality-build-plan-v1.md §9.2
//
// Ensures the subject clause appears first in Midjourney's multi-clause
// :: weight structure. Midjourney processes words 1–5 with highest
// influence (frontLoadImportance: 0.9), so the subject clause must
// lead the prompt.
//
// Only active on Midjourney. Pure function. No GPT cost.
// ============================================================================

import type { AnchorManifest } from '@/lib/optimise-prompts/preflight';
import type { PlatformDNA } from '@/data/platform-dna/types';
import type { TransformOutput } from './transform-types';

// ============================================================================
// CLAUSE PARSING
// ============================================================================

interface MjClauseInfo {
  /** Clause text (before ::weight) */
  readonly text: string;
  /** Weight value (or null if final clause before params) */
  readonly weight: number | null;
  /** The original raw clause string including ::weight */
  readonly raw: string;
}

/**
 * Parse a Midjourney prompt into clauses separated by :: weights.
 * Stops at -- parameters.
 */
function parseClauses(prompt: string): {
  clauses: MjClauseInfo[];
  params: string;
} {
  // Split off --params
  const paramMatch = prompt.match(/\s+(--\w+.*)$/);
  const paramStr = paramMatch ? paramMatch[1]!.trim() : '';
  const body = paramMatch ? prompt.slice(0, paramMatch.index) : prompt;

  // Split by :: (keeping the weight)
  const parts = body.split(/(::[\d.]*)/);
  const clauses: MjClauseInfo[] = [];

  for (let i = 0; i < parts.length; i += 2) {
    const text = (parts[i] ?? '').trim();
    if (text.length === 0) continue;

    const weightStr = parts[i + 1] ?? '';
    const weightMatch = weightStr.match(/^::(\d+\.?\d*)$/);
    const weight = weightMatch ? parseFloat(weightMatch[1]!) : null;

    clauses.push({
      text,
      weight,
      raw: weightStr ? `${text}${weightStr}` : text,
    });
  }

  return { clauses, params: paramStr };
}

/**
 * Detect which clause is most likely the subject clause.
 * Heuristics:
 *   - Contains the anchor's subjectPhrase
 *   - Has the highest weight
 *   - Is the shortest "noun-heavy" clause
 */
function findSubjectClauseIndex(
  clauses: MjClauseInfo[],
  anchors: AnchorManifest,
): number {
  // If we have a subject phrase from anchors, look for it
  if (anchors.subjectPhrase) {
    const subjectLower = anchors.subjectPhrase.toLowerCase();
    for (let i = 0; i < clauses.length; i++) {
      if (clauses[i]!.text.toLowerCase().includes(subjectLower)) {
        return i;
      }
    }
  }

  // Fall back to highest-weighted clause
  let bestIdx = 0;
  let bestWeight = -1;

  for (let i = 0; i < clauses.length; i++) {
    const w = clauses[i]!.weight ?? 1;
    if (w > bestWeight) {
      bestWeight = w;
      bestIdx = i;
    }
  }

  return bestIdx;
}

// ============================================================================
// TRANSFORM
// ============================================================================

/**
 * T_CLAUSE_FRONT — Move subject clause to first position in MJ prompt.
 *
 * Algorithm:
 *   1. Parse prompt into ::weighted clauses + --params
 *   2. Identify the subject clause (via anchor manifest or weight)
 *   3. If subject is already first → pass through
 *   4. Move subject clause to position 0, shift others down
 *   5. Reassemble with original weights preserved
 *
 * Returns unchanged text if:
 * - Subject clause is already first
 * - Only one clause present
 * - No :: clause structure detected
 */
export function clauseFront(
  text: string,
  anchors: AnchorManifest,
  _dna: PlatformDNA,
): TransformOutput {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { text: trimmed, changes: [] };
  }

  // Guard: must have :: clause structure
  if (!trimmed.includes('::')) {
    return { text: trimmed, changes: [] };
  }

  const { clauses, params } = parseClauses(trimmed);

  if (clauses.length <= 1) {
    return { text: trimmed, changes: [] };
  }

  // ── Find subject clause ────────────────────────────────────────────
  const subjectIdx = findSubjectClauseIndex(clauses, anchors);

  // Already first
  if (subjectIdx === 0) {
    return { text: trimmed, changes: [] };
  }

  // ── Reorder: move subject to front ─────────────────────────────────
  const reordered = [
    clauses[subjectIdx]!,
    ...clauses.slice(0, subjectIdx),
    ...clauses.slice(subjectIdx + 1),
  ];

  // ── Reassemble ─────────────────────────────────────────────────────
  const reassembled = reordered
    .map((c) => c.raw)
    .join(' ');

  const result = params
    ? `${reassembled} ${params}`
    : reassembled;

  return {
    text: result.trim(),
    changes: [
      `Clause front: moved subject clause "${clauses[subjectIdx]!.text.slice(0, 40)}${clauses[subjectIdx]!.text.length > 40 ? '...' : ''}" to position 0`,
    ],
  };
}
