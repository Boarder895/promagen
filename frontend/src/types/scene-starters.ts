// src/types/scene-starters.ts
// ============================================================================
// SCENE STARTERS TYPE DEFINITIONS v1.0.0
// ============================================================================
// TypeScript types for the Scene Starters feature (Phase 2).
// Mirrors scene-starters.schema.json exactly.
//
// Authority: prompt-builder-evolution-plan-v2.md §6, §14.1
// Schema:    src/data/scenes/scene-starters.schema.json
// ============================================================================

import type { PromptCategory } from './prompt-builder';

// ============================================================================
// PREFILLABLE CATEGORIES
// ============================================================================

/**
 * Categories that a scene can pre-fill.
 * Excludes 'negative' — scenes never pre-fill negative prompts.
 */
export type PrefillableCategory = Exclude<PromptCategory, 'negative'>;

/**
 * The 11 categories a scene can pre-fill, in canonical order.
 * Matches CATEGORY_ORDER minus 'negative'.
 */
export const PREFILLABLE_CATEGORIES: PrefillableCategory[] = [
  'subject',
  'action',
  'style',
  'environment',
  'composition',
  'camera',
  'lighting',
  'colour',
  'atmosphere',
  'materials',
  'fidelity',
];

// ============================================================================
// WORLD DEFINITIONS
// ============================================================================

/**
 * Kebab-case world identifier.
 * First 5 are free worlds (25 scenes), remaining 17 are pro worlds (175 scenes).
 */
export type WorldSlug =
  // ── Free Worlds (5) ──
  | 'portraits-and-people'
  | 'landscapes-and-worlds'
  | 'mood-and-atmosphere'
  | 'style-forward'
  | 'trending-seasonal'
  // ── Pro Worlds (17) ──
  | 'cinematic'
  | 'fantasy-and-mythology'
  | 'sci-fi-and-future'
  | 'historical-eras'
  | 'urban-and-street'
  | 'nature-and-elements'
  | 'architecture-and-interiors'
  | 'portraiture-and-character'
  | 'dark-and-horror'
  | 'whimsical-and-surreal'
  | 'cultural-and-ceremonial'
  | 'abstract-and-experimental'
  | 'food-and-still-life'
  | 'animals-and-creatures'
  | 'commodity-inspired'
  | 'weather-driven'
  | 'seasonal'
  | 'micro-and-macro';

/** All free world slugs */
export const FREE_WORLD_SLUGS: WorldSlug[] = [
  'portraits-and-people',
  'landscapes-and-worlds',
  'mood-and-atmosphere',
  'style-forward',
  'trending-seasonal',
];

/** All pro world slugs */
export const PRO_WORLD_SLUGS: WorldSlug[] = [
  'cinematic',
  'fantasy-and-mythology',
  'sci-fi-and-future',
  'historical-eras',
  'urban-and-street',
  'nature-and-elements',
  'architecture-and-interiors',
  'portraiture-and-character',
  'dark-and-horror',
  'whimsical-and-surreal',
  'cultural-and-ceremonial',
  'abstract-and-experimental',
  'food-and-still-life',
  'animals-and-creatures',
  'commodity-inspired',
  'weather-driven',
  'seasonal',
  'micro-and-macro',
];

// ============================================================================
// TIER GUIDANCE
// ============================================================================

/**
 * Tier 1 (CLIP) — Weighted keywords with emphasis.
 * Platforms: Stable Diffusion, Leonardo, Flux, NightCafe, etc.
 */
export interface TierGuidanceCLIP {
  /** How well this scene works on CLIP platforms (1–10) */
  affinity: number;
  /** Whether to auto-add fidelity terms (8K, masterpiece) */
  boostFidelity?: boolean;
  /** Human-readable note */
  note?: string;
}

/**
 * Tier 2 (Midjourney) — Natural flow with parameter flags.
 * Platforms: Midjourney, BlueWillow, Niji.
 */
export interface TierGuidanceMJ {
  /** How well this scene works on MJ (1–10) */
  affinity: number;
  /** Recommended MJ parameters (e.g. '--ar 21:9 --s 750 --v 6') */
  params?: string;
  /** Human-readable note */
  note?: string;
}

/**
 * Tier 3 (Natural Language) — Full descriptive sentences.
 * Platforms: DALL-E, Imagen, Adobe Firefly.
 */
export interface TierGuidanceNL {
  /** How well this scene works on NL platforms (1–10) */
  affinity: number;
  /** One-sentence narrative seed description */
  narrative?: string;
  /** Human-readable note */
  note?: string;
}

/**
 * Tier 4 (Plain Language) — Simple, minimal prompts.
 * Platforms: Canva, Craiyon, Artistly.
 */
export interface TierGuidancePlain {
  /** How well this scene works on plain parsers (1–10) */
  affinity: number;
  /** Simplified 3–5 essential terms */
  core?: string;
  /** Which categories to pre-fill on Tier 4 (reduced set of 3–5) */
  reducedPrefills?: PrefillableCategory[];
  /** Human-readable note */
  note?: string;
}

/**
 * Per-tier metadata. Keys are tier numbers as strings.
 * Every scene MUST have guidance for all 4 tiers.
 */
export interface TierGuidance {
  '1': TierGuidanceCLIP;
  '2': TierGuidanceMJ;
  '3': TierGuidanceNL;
  '4': TierGuidancePlain;
}

// ============================================================================
// SCENE ENTRY
// ============================================================================

/**
 * Prefills map — category → array of vocabulary terms.
 * Minimum 4 categories, maximum 11 (all except negative).
 * Every value MUST exist in core or merged vocabulary (validated in step 2.4).
 */
export type ScenePrefills = Partial<Record<PrefillableCategory, string[]>>;

/**
 * Flavour phrases — scene-specific bonus phrases for Explore Drawer (Phase 3).
 * NOT from core vocabulary — unique evocative phrases for this scene.
 */
export type FlavourPhrases = Partial<Record<PrefillableCategory, string[]>>;

/**
 * A single Scene Starter entry.
 * This is the core data unit of Phase 2.
 */
export interface SceneEntry {
  /** Unique kebab-case identifier (e.g. 'blade-runner-rain') */
  id: string;
  /** Display name shown in accordion dropdown (e.g. 'Blade Runner Rain') */
  name: string;
  /** Which world/heading this scene belongs to */
  world: WorldSlug;
  /** Emoji icon shown in dropdown (e.g. '🎬') */
  emoji: string;
  /** Short tagline shown below name in dropdown (max 120 chars) */
  description: string;
  /** 'free' = accessible to all (25 scenes), 'pro' = locked (175 scenes) */
  tier: 'free' | 'pro';
  /** Categories to pre-populate on selection. Min 4, max 11. */
  prefills: ScenePrefills;
  /** Per-tier metadata for all 4 optimizer tiers */
  tierGuidance: TierGuidance;
  /** Optional scene-specific bonus phrases for Explore Drawer */
  flavourPhrases?: FlavourPhrases;
  /** Searchable tags for filtering (3–12 per scene) */
  tags: string[];
}

// ============================================================================
// FILE STRUCTURE
// ============================================================================

/**
 * Top-level structure of scene-starters.json.
 */
export interface SceneStartersFile {
  _meta: {
    version: string;
    description: string;
    updated: string;
    counts: {
      free: number;
      pro: number;
      total: number;
      worlds: number;
    };
  };
  scenes: SceneEntry[];
}

// ============================================================================
// WORLD METADATA (for UI display)
// ============================================================================

/**
 * Metadata for a world heading in the accordion dropdown.
 * Used by SceneSelector component (step 2.5).
 */
export interface WorldMeta {
  /** Kebab-case slug matching WorldSlug */
  slug: WorldSlug;
  /** Display label (e.g. 'Portraits & People') */
  label: string;
  /** Emoji prefix for the heading */
  emoji: string;
  /** Expected scene count for this world */
  expectedCount: number;
  /** Whether this is a free or pro world */
  tier: 'free' | 'pro';
  /** Sort order within its tier group (lower = higher in list) */
  order: number;
}

// ============================================================================
// HELPER TYPE GUARDS
// ============================================================================

/** Check if a string is a valid WorldSlug */
export function isWorldSlug(value: string): value is WorldSlug {
  return [...FREE_WORLD_SLUGS, ...PRO_WORLD_SLUGS].includes(value as WorldSlug);
}

/** Check if a string is a valid PrefillableCategory */
export function isPrefillableCategory(value: string): value is PrefillableCategory {
  return PREFILLABLE_CATEGORIES.includes(value as PrefillableCategory);
}

/** Get the number of prefilled categories in a scene */
export function getPrefillCount(scene: SceneEntry): number {
  return Object.keys(scene.prefills).length;
}

/** Get the total number of prefilled values across all categories */
export function getPrefillValueCount(scene: SceneEntry): number {
  return Object.values(scene.prefills).reduce(
    (sum, values) => sum + (values?.length ?? 0),
    0,
  );
}
