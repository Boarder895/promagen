// src/lib/learning/compression-overrides.ts
// ============================================================================
// COMPRESSION INTELLIGENCE — Expendable Term Override List
// ============================================================================
//
// Phase 7.9, Part 7.9c — Safety Net for High-Value Terms.
//
// A curated set of terms that should NEVER be flagged as expendable,
// regardless of what the statistical signals say. These are visually
// impactful, brand-defining, or technically important terms that users
// expect to see in their prompts.
//
// The override applies in the engine (computeExpendableTerms) — terms
// in this set are skipped before scoring, so they never enter the
// expendable list at all.
//
// To add a term: add it to the appropriate category set below.
// To remove a term: delete the line. The cron will stop protecting it
// on the next nightly run.
//
// Pure data — no I/O, no side effects.
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 7.9
//
// Version: 1.0.0
// Created: 2026-02-28
//
// Existing features preserved: Yes.
// ============================================================================

// ============================================================================
// OVERRIDE CATEGORIES
// ============================================================================

/** Resolution & fidelity terms — critical for image quality expectations */
const RESOLUTION_TERMS = new Set([
  '4K',
  '8K',
  '16K',
  'ultra HD',
  'high resolution',
  'high detail',
  'ultra-detailed',
  'hyper-detailed',
  'extremely detailed',
  'intricate detail',
  'sharp focus',
  'tack sharp',
]);

/** Cinematic & photographic terms — high-value visual style markers */
const CINEMATIC_TERMS = new Set([
  'cinematic',
  'cinematic lighting',
  'cinematic composition',
  'film grain',
  'anamorphic',
  'bokeh',
  'depth of field',
  'shallow depth of field',
  'lens flare',
  'golden hour',
  'blue hour',
  'dramatic lighting',
  'volumetric lighting',
  'volumetric fog',
  'ray tracing',
  'global illumination',
  'subsurface scattering',
]);

/** Render engine & technique terms — users expect these to be precise */
const RENDER_TERMS = new Set([
  'octane render',
  'unreal engine',
  'unreal engine 5',
  'V-Ray',
  'Arnold render',
  'photorealistic',
  'hyperrealistic',
  'photoreal',
  'studio lighting',
  'studio photography',
  'professional photography',
  'DSLR',
  'macro photography',
  'tilt-shift',
]);

/** Artistic style terms — high-impact visual direction markers */
const STYLE_TERMS = new Set([
  'oil painting',
  'watercolor',
  'watercolour',
  'digital painting',
  'concept art',
  'matte painting',
  'illustration',
  'anime',
  'manga',
  'art nouveau',
  'art deco',
  'surrealism',
  'impressionism',
  'cyberpunk',
  'steampunk',
  'retrofuturism',
  'vaporwave',
  'synthwave',
]);

/** Platform-specific quality terms — known to have outsized effect */
const PLATFORM_TERMS = new Set([
  '--v 6',
  '--ar 16:9',
  '--ar 3:2',
  '--ar 1:1',
  '--quality 2',
  '--stylize',
  'trending on artstation',
  'award winning',
  'masterpiece',
]);

// ============================================================================
// MERGED SET — Single O(1) lookup
// ============================================================================

/**
 * The complete set of terms that must never be flagged as expendable.
 *
 * All lookups are case-sensitive to match the vocabulary system.
 * Exported as a frozen Set for immutability.
 */
export const EXPENDABLE_OVERRIDES: ReadonlySet<string> = new Set([
  ...RESOLUTION_TERMS,
  ...CINEMATIC_TERMS,
  ...RENDER_TERMS,
  ...STYLE_TERMS,
  ...PLATFORM_TERMS,
]);

/**
 * Check whether a term is protected from expendability flagging.
 *
 * @param term — The vocabulary term to check
 * @returns true if the term must never be flagged as expendable
 */
export function isOverriddenTerm(term: string): boolean {
  return EXPENDABLE_OVERRIDES.has(term);
}
