// src/data/scenes/index.ts
// ============================================================================
// SCENES DATA — Barrel Export
// ============================================================================
// Single import point for all scene-related data and metadata.
//
// Usage:
//   import { sceneData, ALL_WORLDS, WORLD_BY_SLUG } from '@/data/scenes';
// ============================================================================

import sceneStartersJson from './scene-starters.json';
import type { SceneStartersFile, SceneEntry } from '@/types/scene-starters';

export {
  FREE_WORLDS,
  PRO_WORLDS,
  ALL_WORLDS,
  WORLD_BY_SLUG,
  EXPECTED_SCENE_COUNT,
  EXPECTED_FREE_COUNT,
  EXPECTED_PRO_COUNT,
} from './worlds';

export type { WorldMeta } from '@/types/scene-starters';

/** The full scene starters dataset */
export const sceneData = sceneStartersJson as SceneStartersFile;

/** All scenes (convenience accessor) */
export const allScenes: SceneEntry[] = sceneData.scenes;

/** Free scenes only */
export const freeScenes: SceneEntry[] = sceneData.scenes.filter(
  (s) => s.tier === 'free',
);

/** Pro scenes only */
export const proScenes: SceneEntry[] = sceneData.scenes.filter(
  (s) => s.tier === 'pro',
);

/** Look up a scene by ID */
export function getSceneById(id: string): SceneEntry | undefined {
  return sceneData.scenes.find((s) => s.id === id);
}

/** Get all scenes for a specific world */
export function getScenesByWorld(worldSlug: string): SceneEntry[] {
  return sceneData.scenes.filter((s) => s.world === worldSlug);
}
