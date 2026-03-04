// src/lib/weather/category-synergy.ts
// ============================================================================
// CATEGORY SYNERGY MATRIX — Extra 3 (Unified Brain)
// ============================================================================
//
// v1.0.0 (Mar 2026) — Detects when category combinations reinforce or
// conflict with each other, producing a synergy score and actionable signals.
//
// WHY THIS MATTERS:
//   "moonlight" (lighting) + "nocturnal" (atmosphere) = synergy ✨
//   "golden hour" (lighting) + "midnight" (atmosphere) = conflict ⚠️
//
// The synergy score feeds into:
//   - Assembler: boost CLIP weights for reinforcing pairs
//   - UI: highlight synergistic combos with subtle glow
//   - Admin: track which combos users love/hate
//   - Prompt DNA: synergy score enriches fingerprint quality tracking
//
// Existing features preserved: Yes — purely additive, no existing code changed.
// ============================================================================

import type { PromptCategory } from '@/types/prompt-builder';

// ============================================================================
// SYNERGY DEFINITIONS
// ============================================================================

/**
 * A synergy rule defines a relationship between two categories.
 * When both categories contain matching terms, the rule fires.
 *
 * strength:
 *   +1.0 = strong reinforcement (both terms amplify the scene)
 *   +0.5 = mild reinforcement
 *   -0.5 = mild conflict (contradictory signals)
 *   -1.0 = strong conflict (physics impossibility)
 */
export interface SynergyRule {
  /** First category */
  catA: PromptCategory;
  /** Second category */
  catB: PromptCategory;
  /** Keywords in category A that trigger this rule */
  termsA: string[];
  /** Keywords in category B that trigger this rule */
  termsB: string[];
  /** Synergy strength: positive = reinforcement, negative = conflict */
  strength: number;
  /** Human-readable explanation for UI/admin */
  reason: string;
}

/**
 * Result of analysing a single synergy rule match.
 */
export interface SynergyMatch {
  rule: SynergyRule;
  /** The actual term matched in category A */
  matchedTermA: string;
  /** The actual term matched in category B */
  matchedTermB: string;
}

/**
 * Full synergy analysis result for a WeatherCategoryMap.
 */
export interface SynergyReport {
  /** Overall synergy score: sum of all matched rule strengths, clamped to [-1, 1] */
  score: number;
  /** All reinforcing matches (positive strength) */
  reinforcements: SynergyMatch[];
  /** All conflicting matches (negative strength) */
  conflicts: SynergyMatch[];
  /** Total rules evaluated */
  rulesEvaluated: number;
  /** Percentage of categories that participate in at least one synergy */
  synergyParticipation: number;
}

// ============================================================================
// SYNERGY RULE DATABASE
// ============================================================================

/**
 * Curated synergy rules.
 * Each rule defines a relationship between terms in two categories.
 * Keywords are matched case-insensitively as substring searches.
 */
export const SYNERGY_RULES: SynergyRule[] = [
  // ── Lighting × Atmosphere — Time consistency ─────────────────────────
  {
    catA: 'lighting',
    catB: 'atmosphere',
    termsA: ['moonlight', 'moon', 'lunar', 'streetlight', 'neon'],
    termsB: ['nocturnal', 'night', 'midnight', 'dark', 'stillness'],
    strength: 0.8,
    reason: 'Night lighting reinforced by nocturnal atmosphere',
  },
  {
    catA: 'lighting',
    catB: 'atmosphere',
    termsA: ['golden hour', 'sunset', 'warm'],
    termsB: ['warm', 'golden', 'amber', 'heat shimmer'],
    strength: 0.6,
    reason: 'Warm lighting harmonises with warm atmosphere',
  },
  {
    catA: 'lighting',
    catB: 'atmosphere',
    termsA: ['golden hour', 'sunset', 'sunrise'],
    termsB: ['midnight', 'dark night', 'deep night'],
    strength: -0.9,
    reason: 'Solar lighting contradicts deep night atmosphere',
  },
  {
    catA: 'lighting',
    catB: 'atmosphere',
    termsA: ['blue hour', 'twilight', 'dusk'],
    termsB: ['contemplative', 'melancholic', 'mysterious'],
    strength: 0.7,
    reason: 'Twilight reinforced by reflective mood',
  },
  {
    catA: 'lighting',
    catB: 'atmosphere',
    termsA: ['harsh midday', 'bright sun', 'overhead sun'],
    termsB: ['fog', 'mist', 'foggy', 'misty'],
    strength: -0.7,
    reason: 'Harsh direct sun contradicts fog/mist conditions',
  },

  // ── Atmosphere × Environment — Setting coherence ────────────────────
  {
    catA: 'atmosphere',
    catB: 'environment',
    termsA: ['rain', 'drizzle', 'wet', 'rain-slicked'],
    termsB: ['waterfront', 'harbour', 'canal', 'bridge'],
    strength: 0.6,
    reason: 'Rain amplifies waterfront scenes',
  },
  {
    catA: 'atmosphere',
    catB: 'environment',
    termsA: ['snow', 'frost', 'ice', 'cold'],
    termsB: ['plaza', 'park', 'monument', 'temple'],
    strength: 0.5,
    reason: 'Snow complements open architectural spaces',
  },
  {
    catA: 'atmosphere',
    catB: 'environment',
    termsA: ['tropical', 'humid', 'monsoon'],
    termsB: ['market', 'food stall', 'night market', 'bazaar'],
    strength: 0.7,
    reason: 'Tropical humidity enhances bustling market scenes',
  },
  {
    catA: 'atmosphere',
    catB: 'environment',
    termsA: ['desert', 'dry', 'arid'],
    termsB: ['waterfront', 'harbour', 'canal', 'lake'],
    strength: -0.6,
    reason: 'Desert dryness conflicts with waterfront environment',
  },

  // ── Lighting × Colour — Temperature alignment ──────────────────────
  {
    catA: 'lighting',
    catB: 'colour',
    termsA: ['golden hour', 'sunset', 'warm', 'tungsten'],
    termsB: ['warm tones', 'earth tones', 'amber'],
    strength: 0.7,
    reason: 'Warm light pairs with warm colour palette',
  },
  {
    catA: 'lighting',
    catB: 'colour',
    termsA: ['blue hour', 'moonlight', 'overcast'],
    termsB: ['cool tones', 'muted tones'],
    strength: 0.7,
    reason: 'Cool light pairs with cool colour palette',
  },
  {
    catA: 'lighting',
    catB: 'colour',
    termsA: ['golden hour', 'sunset', 'warm'],
    termsB: ['cool tones', 'muted tones', 'blue'],
    strength: -0.5,
    reason: 'Warm light clashes with cool colour palette',
  },
  {
    catA: 'lighting',
    catB: 'colour',
    termsA: ['neon', 'led', 'fluorescent'],
    termsB: ['neon colours', 'vibrant colours', 'holographic'],
    strength: 0.6,
    reason: 'Artificial light reinforced by vibrant palette',
  },

  // ── Style × Fidelity — Quality coherence ───────────────────────────
  {
    catA: 'style',
    catB: 'fidelity',
    termsA: ['photorealistic', 'hyperrealistic'],
    termsB: ['highly detailed', 'sharp focus', '8k', 'sharp'],
    strength: 0.5,
    reason: 'Realistic style reinforced by detail-focused quality tags',
  },
  {
    catA: 'style',
    catB: 'fidelity',
    termsA: ['illustration', 'cartoon', 'pixel art', 'comic'],
    termsB: ['highly detailed', '8k', 'ray tracing'],
    strength: -0.4,
    reason: 'Stylised rendering conflicts with photorealistic quality tags',
  },

  // ── Materials × Atmosphere — Surface physics ───────────────────────
  {
    catA: 'materials',
    catB: 'atmosphere',
    termsA: ['wet', 'rain-slicked', 'damp', 'puddle', 'reflecting'],
    termsB: ['rain', 'drizzle', 'wet', 'humidity'],
    strength: 0.8,
    reason: 'Wet surfaces physically consistent with rain/humidity',
  },
  {
    catA: 'materials',
    catB: 'atmosphere',
    termsA: ['frost', 'ice', 'frozen'],
    termsB: ['cold', 'frost', 'ice crystal', 'crisp'],
    strength: 0.8,
    reason: 'Frozen surfaces physically consistent with cold atmosphere',
  },
  {
    catA: 'materials',
    catB: 'atmosphere',
    termsA: ['wet', 'rain-slicked', 'damp'],
    termsB: ['dry', 'desert', 'arid', 'dusty'],
    strength: -0.8,
    reason: 'Wet surfaces contradicts dry/desert atmosphere',
  },

  // ── Action × Atmosphere — Motion coherence ─────────────────────────
  {
    catA: 'action',
    catB: 'atmosphere',
    termsA: ['gale', 'howling', 'violent', 'gusting'],
    termsB: ['dynamic', 'dramatic', 'intense', 'storm'],
    strength: 0.6,
    reason: 'Strong wind reinforced by dramatic atmosphere',
  },
  {
    catA: 'action',
    catB: 'atmosphere',
    termsA: ['gentle', 'light breeze', 'calm'],
    termsB: ['serene', 'peaceful', 'contemplative', 'stillness'],
    strength: 0.6,
    reason: 'Gentle motion harmonises with serene atmosphere',
  },
  {
    catA: 'action',
    catB: 'atmosphere',
    termsA: ['gale', 'howling', 'violent', 'storm'],
    termsB: ['serene', 'peaceful', 'stillness', 'calm'],
    strength: -0.7,
    reason: 'Violent wind contradicts serene atmosphere',
  },
];

// ============================================================================
// ANALYSIS ENGINE
// ============================================================================

/**
 * Check if any term in a list appears (case-insensitive substring) in
 * the combined text of a category's selections + customValue.
 *
 * Returns the first matching term or null.
 */
function findTermMatch(
  terms: string[],
  categoryText: string,
): string | null {
  const lower = categoryText.toLowerCase();
  for (const term of terms) {
    if (lower.includes(term.toLowerCase())) {
      return term;
    }
  }
  return null;
}

/**
 * Build the combined text for a category from selections + customValues.
 */
function getCategoryText(
  category: PromptCategory,
  selections: Partial<Record<PromptCategory, string[]>>,
  customValues: Partial<Record<PromptCategory, string>>,
): string {
  const parts: string[] = [];
  const sel = selections[category];
  if (sel) parts.push(...sel);
  const custom = customValues[category];
  if (custom) parts.push(custom);
  return parts.join(' ');
}

/**
 * Analyse a WeatherCategoryMap for category synergies and conflicts.
 *
 * Evaluates all synergy rules against the populated categories and
 * produces a report with:
 *   - Overall score (clamped [-1, 1])
 *   - Individual reinforcements (positive matches)
 *   - Individual conflicts (negative matches)
 *   - Participation rate (what % of categories are involved in synergies)
 *
 * @param selections - The category selections from WeatherCategoryMap
 * @param customValues - The category custom values from WeatherCategoryMap
 * @param rules - Optional custom rules (defaults to SYNERGY_RULES)
 * @returns SynergyReport with score, reinforcements, and conflicts
 */
export function analyseSynergy(
  selections: Partial<Record<PromptCategory, string[]>>,
  customValues: Partial<Record<PromptCategory, string>>,
  rules: SynergyRule[] = SYNERGY_RULES,
): SynergyReport {
  const reinforcements: SynergyMatch[] = [];
  const conflicts: SynergyMatch[] = [];
  const participatingCategories = new Set<PromptCategory>();

  for (const rule of rules) {
    const textA = getCategoryText(rule.catA, selections, customValues);
    const textB = getCategoryText(rule.catB, selections, customValues);

    // Skip if either category has no content
    if (!textA || !textB) continue;

    const matchA = findTermMatch(rule.termsA, textA);
    const matchB = findTermMatch(rule.termsB, textB);

    if (matchA && matchB) {
      const match: SynergyMatch = {
        rule,
        matchedTermA: matchA,
        matchedTermB: matchB,
      };

      if (rule.strength > 0) {
        reinforcements.push(match);
      } else {
        conflicts.push(match);
      }

      participatingCategories.add(rule.catA);
      participatingCategories.add(rule.catB);
    }
  }

  // Compute overall score: sum of strengths, clamped to [-1, 1]
  const allMatches = [...reinforcements, ...conflicts];
  const rawScore = allMatches.reduce((sum, m) => sum + m.rule.strength, 0);
  const maxPossible = Math.max(allMatches.length, 1);
  const normalisedScore = rawScore / maxPossible;
  const clampedScore = Math.max(-1, Math.min(1, normalisedScore));

  // Participation: how many of the 12 categories are involved
  const totalCategories = 12;
  const participation = participatingCategories.size / totalCategories;

  return {
    score: Math.round(clampedScore * 1000) / 1000, // 3 decimal places
    reinforcements,
    conflicts,
    rulesEvaluated: rules.length,
    synergyParticipation: Math.round(participation * 100) / 100,
  };
}

/**
 * Quick check: does this category map have any conflicts?
 * Useful for a simple boolean flag in the UI.
 */
export function hasConflicts(
  selections: Partial<Record<PromptCategory, string[]>>,
  customValues: Partial<Record<PromptCategory, string>>,
): boolean {
  const report = analyseSynergy(selections, customValues);
  return report.conflicts.length > 0;
}

/**
 * Get the single strongest synergy (positive or negative) for display.
 * Returns null if no synergies detected.
 */
export function getStrongestSynergy(
  selections: Partial<Record<PromptCategory, string[]>>,
  customValues: Partial<Record<PromptCategory, string>>,
): SynergyMatch | null {
  const report = analyseSynergy(selections, customValues);
  const all = [...report.reinforcements, ...report.conflicts];
  if (all.length === 0) return null;

  return all.reduce((best, current) =>
    Math.abs(current.rule.strength) > Math.abs(best.rule.strength) ? current : best,
  );
}
