// src/data/scenes/worlds.ts
// ============================================================================
// SCENE STARTER WORLDS v1.0.0
// ============================================================================
// Metadata for the 22 world headings in the Scene Blueprint accordion.
// 5 free worlds (25 scenes) + 17 pro worlds (175 scenes).
//
// Authority: prompt-builder-evolution-plan-v2.md §6.3, §6.4
// ============================================================================

import type { WorldMeta } from '@/types/scene-starters';

// ============================================================================
// FREE WORLDS (5 headings, 25 scenes total — 5 each)
// ============================================================================

export const FREE_WORLDS: WorldMeta[] = [
  {
    slug: 'portraits-and-people',
    label: 'Portraits & People',
    emoji: '👤',
    expectedCount: 5,
    tier: 'free',
    order: 1,
  },
  {
    slug: 'landscapes-and-worlds',
    label: 'Landscapes & Worlds',
    emoji: '🌍',
    expectedCount: 5,
    tier: 'free',
    order: 2,
  },
  {
    slug: 'mood-and-atmosphere',
    label: 'Mood & Atmosphere',
    emoji: '🌫️',
    expectedCount: 5,
    tier: 'free',
    order: 3,
  },
  {
    slug: 'style-forward',
    label: 'Style-Forward',
    emoji: '🎨',
    expectedCount: 5,
    tier: 'free',
    order: 4,
  },
  {
    slug: 'trending-seasonal',
    label: 'Trending / Seasonal',
    emoji: '🔥',
    expectedCount: 5,
    tier: 'free',
    order: 5,
  },
];

// ============================================================================
// PRO WORLDS (18 headings, 175 scenes total — variable count each)
// ============================================================================

export const PRO_WORLDS: WorldMeta[] = [
  {
    slug: 'cinematic',
    label: 'Cinematic',
    emoji: '🎬',
    expectedCount: 12,
    tier: 'pro',
    order: 1,
  },
  {
    slug: 'fantasy-and-mythology',
    label: 'Fantasy & Mythology',
    emoji: '⚔️',
    expectedCount: 12,
    tier: 'pro',
    order: 2,
  },
  {
    slug: 'sci-fi-and-future',
    label: 'Sci-Fi & Future',
    emoji: '🚀',
    expectedCount: 12,
    tier: 'pro',
    order: 3,
  },
  {
    slug: 'historical-eras',
    label: 'Historical Eras',
    emoji: '🏛️',
    expectedCount: 12,
    tier: 'pro',
    order: 4,
  },
  {
    slug: 'urban-and-street',
    label: 'Urban & Street',
    emoji: '🏙️',
    expectedCount: 12,
    tier: 'pro',
    order: 5,
  },
  {
    slug: 'nature-and-elements',
    label: 'Nature & Elements',
    emoji: '🌋',
    expectedCount: 10,
    tier: 'pro',
    order: 6,
  },
  {
    slug: 'architecture-and-interiors',
    label: 'Architecture & Interiors',
    emoji: '🏗️',
    expectedCount: 10,
    tier: 'pro',
    order: 7,
  },
  {
    slug: 'portraiture-and-character',
    label: 'Portraiture & Character',
    emoji: '🎭',
    expectedCount: 12,
    tier: 'pro',
    order: 8,
  },
  {
    slug: 'dark-and-horror',
    label: 'Dark & Horror',
    emoji: '🦇',
    expectedCount: 8,
    tier: 'pro',
    order: 9,
  },
  {
    slug: 'whimsical-and-surreal',
    label: 'Whimsical & Surreal',
    emoji: '🎪',
    expectedCount: 10,
    tier: 'pro',
    order: 10,
  },
  {
    slug: 'cultural-and-ceremonial',
    label: 'Cultural & Ceremonial',
    emoji: '🪔',
    expectedCount: 10,
    tier: 'pro',
    order: 11,
  },
  {
    slug: 'abstract-and-experimental',
    label: 'Abstract & Experimental',
    emoji: '🔮',
    expectedCount: 8,
    tier: 'pro',
    order: 12,
  },
  {
    slug: 'food-and-still-life',
    label: 'Food & Still Life',
    emoji: '🍷',
    expectedCount: 8,
    tier: 'pro',
    order: 13,
  },
  {
    slug: 'animals-and-creatures',
    label: 'Animals & Creatures',
    emoji: '🐉',
    expectedCount: 8,
    tier: 'pro',
    order: 14,
  },
  {
    slug: 'commodity-inspired',
    label: 'Commodity-Inspired',
    emoji: '⛏️',
    expectedCount: 10,
    tier: 'pro',
    order: 15,
  },
  {
    slug: 'weather-driven',
    label: 'Weather-Driven',
    emoji: '⛈️',
    expectedCount: 8,
    tier: 'pro',
    order: 16,
  },
  {
    slug: 'seasonal',
    label: 'Seasonal',
    emoji: '🍂',
    expectedCount: 8,
    tier: 'pro',
    order: 17,
  },
  {
    slug: 'micro-and-macro',
    label: 'Micro & Macro',
    emoji: '🔬',
    expectedCount: 5,
    tier: 'pro',
    order: 18,
  },
];

// ============================================================================
// COMBINED + HELPERS
// ============================================================================

/** All 22 worlds in display order (free first, then pro) */
export const ALL_WORLDS: WorldMeta[] = [...FREE_WORLDS, ...PRO_WORLDS];

/** Quick lookup: slug → WorldMeta */
export const WORLD_BY_SLUG = new Map<string, WorldMeta>(
  ALL_WORLDS.map((w) => [w.slug, w]),
);

/** Total expected scene count across all worlds */
export const EXPECTED_SCENE_COUNT = ALL_WORLDS.reduce(
  (sum, w) => sum + w.expectedCount,
  0,
);

/** Total expected free scene count */
export const EXPECTED_FREE_COUNT = FREE_WORLDS.reduce(
  (sum, w) => sum + w.expectedCount,
  0,
);

/** Total expected pro scene count */
export const EXPECTED_PRO_COUNT = PRO_WORLDS.reduce(
  (sum, w) => sum + w.expectedCount,
  0,
);
