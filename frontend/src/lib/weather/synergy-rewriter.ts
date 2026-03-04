// src/lib/weather/synergy-rewriter.ts
// ============================================================================
// SYNERGY-AWARE PROMPT REWRITER — Extra 6 (Unified Brain)
// ============================================================================
//
// v1.0.0 (Mar 2026) — Wires the synergy matrix INTO the assembly pipeline
// so that conflicting category combinations are automatically resolved and
// reinforcing combinations are amplified with bridging phrases.
//
// CONFLICT RESOLUTION (synergy score < -0.3):
//   "golden hour" (lighting) + "midnight" (atmosphere) → physics impossibility
//   Rewriter replaces "golden hour" → "amber artificial light" — preserves
//   warm colour intent while resolving the time-of-day contradiction.
//
// REINFORCEMENT BRIDGING (synergy score > 0.5):
//   "moonlight" (lighting) + "contemplative" (atmosphere) → strong synergy
//   Rewriter injects a bridging phrase: "cool moonlight casting a contemplative
//   stillness across the scene" — explicitly connecting the categories.
//
// This runs as a PRE-PROCESS step before assemblePrompt(). It takes
// PromptSelections as input and returns modified PromptSelections + any
// bridging phrases injected as customValues on the relevant categories.
//
// Existing features preserved: Yes — purely additive. assemblePrompt() API
// unchanged. Callers opt in by calling rewriteWithSynergy() before assembly.
// ============================================================================

import type { PromptCategory } from '@/types/prompt-builder';
import type { PromptSelections } from '@/types/prompt-builder';
import { analyseSynergy, type SynergyMatch } from './category-synergy';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result of synergy-aware rewriting.
 */
export interface SynergyRewriteResult {
  /** Modified selections with conflicts resolved */
  selections: PromptSelections;
  /** Bridging phrases added for strong reinforcements */
  bridgingPhrases: BridgingPhrase[];
  /** Conflict resolutions applied */
  resolutions: ConflictResolution[];
  /** Whether any modifications were made */
  modified: boolean;
}

/**
 * A bridging phrase that connects two synergistic categories.
 */
export interface BridgingPhrase {
  /** The two categories being bridged */
  categories: [PromptCategory, PromptCategory];
  /** The bridging phrase text */
  phrase: string;
  /** Which category it's injected into (the one with more room) */
  targetCategory: PromptCategory;
  /** The synergy strength that triggered it */
  strength: number;
}

/**
 * Record of a conflict resolution.
 */
export interface ConflictResolution {
  /** The category whose term was replaced */
  category: PromptCategory;
  /** Original conflicting term */
  originalTerm: string;
  /** Replacement term that resolves the conflict */
  replacementTerm: string;
  /** The synergy rule that triggered the resolution */
  reason: string;
  /** The conflicting term in the other category (preserved) */
  conflictsWith: string;
}

// ============================================================================
// CONFLICT RESOLUTION MAP
// ============================================================================

/**
 * Curated replacement map for known conflicts.
 * Key: the conflicting term (lowercase).
 * Value: replacement that preserves the visual INTENT while fixing the physics.
 *
 * Structure: Record<conflicting_term, Record<conflict_context, replacement>>
 * The context is the term in the OTHER category that causes the conflict.
 *
 * Design principle: preserve the colour/mood intent, change the source.
 *   "golden hour" intent = warm amber light
 *   "midnight" context = it's dark outside
 *   Resolution: "amber artificial light" = warm amber light from artificial source at night
 */
const CONFLICT_RESOLUTIONS: Array<{
  /** Term to find (lowercase substring match) */
  term: string;
  /** Category the term lives in */
  category: PromptCategory;
  /** Context terms in the conflicting category (any match triggers) */
  conflictContext: string[];
  /** Category the context terms live in */
  contextCategory: PromptCategory;
  /** Replacement term */
  replacement: string;
}> = [
  // ── Lighting × Atmosphere: Time-of-day contradictions ───────────────

  // Golden hour is solar → can't exist at midnight
  {
    term: 'golden hour',
    category: 'lighting',
    conflictContext: ['midnight', 'deep night', 'dark night', '3am', '2am'],
    contextCategory: 'atmosphere',
    replacement: 'warm amber artificial light',
  },
  {
    term: 'sunset',
    category: 'lighting',
    conflictContext: ['midnight', 'deep night', 'dark night'],
    contextCategory: 'atmosphere',
    replacement: 'warm sodium vapour street light',
  },
  {
    term: 'sunrise',
    category: 'lighting',
    conflictContext: ['midnight', 'deep night', 'dark night'],
    contextCategory: 'atmosphere',
    replacement: 'cool pre-dawn artificial light',
  },

  // Bright sun can't co-exist with fog (visibility < 1000m by definition)
  {
    term: 'harsh midday',
    category: 'lighting',
    conflictContext: ['fog', 'foggy', 'thick fog'],
    contextCategory: 'atmosphere',
    replacement: 'diffused overhead glow through fog',
  },
  {
    term: 'bright sun',
    category: 'lighting',
    conflictContext: ['fog', 'foggy', 'mist', 'misty'],
    contextCategory: 'atmosphere',
    replacement: 'softened sun diffused through haze',
  },
  {
    term: 'overhead sun',
    category: 'lighting',
    conflictContext: ['fog', 'foggy', 'mist'],
    contextCategory: 'atmosphere',
    replacement: 'overhead glow diffused through atmospheric moisture',
  },

  // ── Atmosphere × Environment: Climate contradictions ────────────────

  // Desert + waterfront = physics contradiction
  {
    term: 'desert',
    category: 'atmosphere',
    conflictContext: ['waterfront', 'harbour', 'canal', 'lake'],
    contextCategory: 'environment',
    replacement: 'dry warm air',
  },
  {
    term: 'arid',
    category: 'atmosphere',
    conflictContext: ['waterfront', 'harbour', 'canal'],
    contextCategory: 'environment',
    replacement: 'warm dry breeze',
  },

  // ── Materials × Atmosphere: Surface contradictions ──────────────────

  // Wet surfaces + desert = physics impossibility
  {
    term: 'wet',
    category: 'materials',
    conflictContext: ['dry', 'desert', 'arid', 'dusty'],
    contextCategory: 'atmosphere',
    replacement: 'weathered',
  },
  {
    term: 'rain-slicked',
    category: 'materials',
    conflictContext: ['dry', 'desert', 'arid'],
    contextCategory: 'atmosphere',
    replacement: 'sun-bleached',
  },
  {
    term: 'damp',
    category: 'materials',
    conflictContext: ['dry', 'desert', 'arid'],
    contextCategory: 'atmosphere',
    replacement: 'dusty',
  },
  {
    term: 'frost',
    category: 'materials',
    conflictContext: ['tropical', 'humid', 'monsoon', 'heat'],
    contextCategory: 'atmosphere',
    replacement: 'condensation-beaded',
  },

  // ── Lighting × Colour: Temperature contradictions ──────────────────

  // Warm light + cool palette or vice versa
  {
    term: 'golden hour',
    category: 'lighting',
    conflictContext: ['cool tones', 'muted tones', 'blue'],
    contextCategory: 'colour',
    replacement: 'diffused warm-to-cool transitional light',
  },

  // ── Action × Atmosphere: Motion contradictions ─────────────────────

  // Violent wind + serene atmosphere
  {
    term: 'gale',
    category: 'action',
    conflictContext: ['serene', 'peaceful', 'stillness', 'calm'],
    contextCategory: 'atmosphere',
    replacement: 'intermittent gusts',
  },
  {
    term: 'howling',
    category: 'action',
    conflictContext: ['serene', 'peaceful', 'stillness'],
    contextCategory: 'atmosphere',
    replacement: 'distant wind sounds',
  },

  // ── Style × Fidelity: Rendering contradictions ─────────────────────

  // Cartoon + photorealistic quality tags
  {
    term: 'illustration',
    category: 'style',
    conflictContext: ['8k', 'ray tracing'],
    contextCategory: 'fidelity',
    replacement: 'detailed illustration',
  },
  {
    term: 'cartoon',
    category: 'style',
    conflictContext: ['highly detailed', '8k', 'ray tracing'],
    contextCategory: 'fidelity',
    replacement: 'detailed stylised art',
  },
];

// ============================================================================
// REINFORCEMENT BRIDGING PHRASES
// ============================================================================

/**
 * Curated bridging phrases for strong synergies.
 * When two categories reinforce each other, a bridging phrase makes the
 * connection explicit in the prompt — better AI model coherence.
 */
const BRIDGING_TEMPLATES: Array<{
  /** Terms in category A that trigger bridging */
  termsA: string[];
  catA: PromptCategory;
  /** Terms in category B that trigger bridging */
  termsB: string[];
  catB: PromptCategory;
  /** Minimum synergy strength to trigger */
  minStrength: number;
  /** Template phrase. {A} and {B} get replaced with matched terms. */
  template: string;
  /** Which category receives the bridging phrase */
  target: PromptCategory;
}> = [
  // ── Night lighting + nocturnal atmosphere ───────────────────────────
  {
    termsA: ['moonlight', 'moon'],
    catA: 'lighting',
    termsB: ['contemplative', 'melancholic', 'mysterious'],
    catB: 'atmosphere',
    minStrength: 0.5,
    template: '{A} casting long shadows, evoking a {B} stillness',
    target: 'lighting',
  },
  {
    termsA: ['neon', 'streetlight'],
    catA: 'lighting',
    termsB: ['nocturnal', 'night', 'midnight'],
    catB: 'atmosphere',
    minStrength: 0.5,
    template: '{A} pools cutting through the {B} darkness',
    target: 'lighting',
  },

  // ── Warm light + warm palette ──────────────────────────────────────
  {
    termsA: ['golden hour', 'sunset', 'warm'],
    catA: 'lighting',
    termsB: ['warm tones', 'earth tones', 'amber'],
    catB: 'colour',
    minStrength: 0.5,
    template: '{A} bathing the scene in rich {B}',
    target: 'lighting',
  },
  {
    termsA: ['blue hour', 'twilight', 'dusk'],
    catA: 'lighting',
    termsB: ['cool tones', 'muted tones'],
    catB: 'colour',
    minStrength: 0.5,
    template: '{A} washing everything in {B}',
    target: 'lighting',
  },

  // ── Rain + waterfront ──────────────────────────────────────────────
  {
    termsA: ['rain', 'drizzle', 'wet'],
    catA: 'atmosphere',
    termsB: ['waterfront', 'harbour', 'canal', 'bridge'],
    catB: 'environment',
    minStrength: 0.5,
    template: '{A} multiplying reflections across the {B}',
    target: 'atmosphere',
  },

  // ── Wet surfaces + rain ────────────────────────────────────────────
  {
    termsA: ['wet', 'rain-slicked', 'puddle', 'reflecting'],
    catA: 'materials',
    termsB: ['rain', 'drizzle', 'humidity'],
    catB: 'atmosphere',
    minStrength: 0.5,
    template: '{A} surfaces mirroring {B}-soaked light',
    target: 'materials',
  },

  // ── Snow + open spaces ─────────────────────────────────────────────
  {
    termsA: ['snow', 'frost', 'ice'],
    catA: 'atmosphere',
    termsB: ['plaza', 'park', 'monument', 'temple'],
    catB: 'environment',
    minStrength: 0.4,
    template: '{A} blanketing the {B} in crystalline silence',
    target: 'atmosphere',
  },

  // ── Gentle wind + serene mood ──────────────────────────────────────
  {
    termsA: ['gentle', 'light breeze', 'calm'],
    catA: 'action',
    termsB: ['serene', 'peaceful', 'contemplative'],
    catB: 'atmosphere',
    minStrength: 0.4,
    template: 'a {A} stirring through the {B} air',
    target: 'action',
  },

  // ── Tropical + market ──────────────────────────────────────────────
  {
    termsA: ['tropical', 'humid', 'monsoon'],
    catA: 'atmosphere',
    termsB: ['market', 'food stall', 'night market', 'bazaar'],
    catB: 'environment',
    minStrength: 0.5,
    template: '{A} heat rising from the crowded {B}',
    target: 'atmosphere',
  },
];

// ============================================================================
// TERM MATCHING HELPERS
// ============================================================================

/**
 * Find the first matching term (case-insensitive substring) in a list of values.
 */
function findMatch(terms: string[], values: string[]): string | null {
  const joined = values.join(' ').toLowerCase();
  for (const term of terms) {
    if (joined.includes(term.toLowerCase())) {
      return term;
    }
  }
  return null;
}

/**
 * Get all values for a category from selections.
 */
function getCategoryValues(
  category: PromptCategory,
  selections: PromptSelections,
): string[] {
  return selections[category]?.filter(Boolean) ?? [];
}

// ============================================================================
// CONFLICT RESOLUTION ENGINE
// ============================================================================

/**
 * Resolve conflicts by replacing terms that cause physics contradictions.
 * Preserves visual intent while fixing the impossibility.
 */
function resolveConflicts(
  selections: PromptSelections,
  conflicts: SynergyMatch[],
): { resolved: PromptSelections; resolutions: ConflictResolution[] } {
  // Deep copy selections to avoid mutating input
  const resolved: PromptSelections = {};
  for (const [key, values] of Object.entries(selections)) {
    if (values) {
      resolved[key as PromptCategory] = [...values];
    }
  }

  const resolutions: ConflictResolution[] = [];

  for (const conflict of conflicts) {
    // Only resolve strong conflicts
    if (conflict.rule.strength > -0.3) continue;

    // Try to find a resolution in our curated map
    for (const res of CONFLICT_RESOLUTIONS) {
      // Check if this resolution applies to this conflict
      if (res.category !== conflict.rule.catA && res.category !== conflict.rule.catB) continue;

      const targetCat = res.category;
      const contextCat = res.contextCategory;
      const targetValues = getCategoryValues(targetCat, resolved);
      const contextValues = getCategoryValues(contextCat, resolved);

      if (targetValues.length === 0 || contextValues.length === 0) continue;

      // Check if the conflicting term is present
      const termLower = res.term.toLowerCase();
      const termIdx = targetValues.findIndex((v) =>
        v.toLowerCase().includes(termLower),
      );
      if (termIdx === -1) continue;

      // Check if the context match is present
      const contextMatch = res.conflictContext.some((c) =>
        contextValues.some((v) => v.toLowerCase().includes(c.toLowerCase())),
      );
      if (!contextMatch) continue;

      // Apply replacement
      const original = targetValues[termIdx];
      if (original === undefined) continue;
      resolved[targetCat]![termIdx] = res.replacement;

      resolutions.push({
        category: targetCat,
        originalTerm: original,
        replacementTerm: res.replacement,
        reason: conflict.rule.reason,
        conflictsWith: conflict.matchedTermB,
      });

      // Only one resolution per conflict
      break;
    }
  }

  return { resolved, resolutions };
}

// ============================================================================
// REINFORCEMENT BRIDGING ENGINE
// ============================================================================

/**
 * Generate bridging phrases for strong reinforcements.
 * Bridging phrases explicitly connect synergistic categories with a
 * visually coherent phrase that helps AI models understand the relationship.
 */
function generateBridgingPhrases(
  selections: PromptSelections,
  reinforcements: SynergyMatch[],
): BridgingPhrase[] {
  const phrases: BridgingPhrase[] = [];
  const usedTargets = new Set<PromptCategory>();

  for (const reinforcement of reinforcements) {
    // Only bridge strong reinforcements
    if (reinforcement.rule.strength < 0.5) continue;

    for (const template of BRIDGING_TEMPLATES) {
      // Skip if target already has a bridging phrase (one per category max)
      if (usedTargets.has(template.target)) continue;

      // Check category match
      const matchesCats =
        (template.catA === reinforcement.rule.catA && template.catB === reinforcement.rule.catB) ||
        (template.catA === reinforcement.rule.catB && template.catB === reinforcement.rule.catA);
      if (!matchesCats) continue;

      // Check strength threshold
      if (reinforcement.rule.strength < template.minStrength) continue;

      // Check term match
      const valuesA = getCategoryValues(template.catA, selections);
      const valuesB = getCategoryValues(template.catB, selections);
      const matchA = findMatch(template.termsA, valuesA);
      const matchB = findMatch(template.termsB, valuesB);

      if (!matchA || !matchB) continue;

      // Build the bridging phrase
      const phrase = template.template
        .replace('{A}', matchA)
        .replace('{B}', matchB);

      phrases.push({
        categories: [template.catA, template.catB],
        phrase,
        targetCategory: template.target,
        strength: reinforcement.rule.strength,
      });

      usedTargets.add(template.target);
      break; // One bridging phrase per reinforcement
    }
  }

  return phrases;
}

// ============================================================================
// MAIN REWRITER
// ============================================================================

/**
 * Pre-process prompt selections with synergy-aware rewriting.
 *
 * Call this BEFORE `assemblePrompt()` to:
 *   1. Resolve conflicts: replace physics-impossible terms with intent-preserving alternatives
 *   2. Boost reinforcements: inject bridging phrases that connect synergistic categories
 *
 * The returned selections can be passed directly to `assemblePrompt()`.
 * Bridging phrases are injected as additional terms in the target category.
 *
 * @param selections - Original prompt selections (from dropdown + customValues)
 * @param customValues - Optional customValues map (for synergy analysis context)
 * @returns Modified selections + audit trail of changes
 *
 * @example
 * ```typescript
 * const raw = selectionsFromMap(categoryMap);
 * const rewritten = rewriteWithSynergy(raw);
 * const assembled = assemblePrompt(platformId, rewritten.selections);
 * ```
 */
export function rewriteWithSynergy(
  selections: PromptSelections,
  customValues?: Partial<Record<PromptCategory, string>>,
): SynergyRewriteResult {
  // Run synergy analysis
  const report = analyseSynergy(selections, customValues ?? {});

  // Start with unmodified selections
  let currentSelections = selections;
  const allResolutions: ConflictResolution[] = [];
  const allBridging: BridgingPhrase[] = [];

  // Step 1: Resolve conflicts (score < -0.3)
  if (report.conflicts.length > 0) {
    const { resolved, resolutions } = resolveConflicts(currentSelections, report.conflicts);
    currentSelections = resolved;
    allResolutions.push(...resolutions);
  }

  // Step 2: Generate bridging phrases for strong reinforcements (score > 0.5)
  if (report.reinforcements.length > 0) {
    const bridging = generateBridgingPhrases(currentSelections, report.reinforcements);

    // Inject bridging phrases into target categories
    for (const bp of bridging) {
      const existing = currentSelections[bp.targetCategory] ?? [];
      currentSelections = {
        ...currentSelections,
        [bp.targetCategory]: [...existing, bp.phrase],
      };
    }

    allBridging.push(...bridging);
  }

  return {
    selections: currentSelections,
    bridgingPhrases: allBridging,
    resolutions: allResolutions,
    modified: allResolutions.length > 0 || allBridging.length > 0,
  };
}
