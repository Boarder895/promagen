// src/lib/call-2-harness/scene-library.ts
// ============================================================================
// Call 2 Quality Harness — Scene Library Loader (Phase B)
// ============================================================================
// Typed, immutable accessor over the scene library at
// src/data/call-2-scenes/scenes.json.
//
// The JSON file is generated from the source-of-truth spreadsheet
// (call-2-harness-scenes-brief.xlsx) which Martin edits. When the spreadsheet
// changes, scenes.json must be regenerated. The runtime never reads xlsx —
// the JSON is the only artefact this module touches.
//
// Schema version: 1.0.0
//
// Phase A additions:
// - optional scene-truth metadata for richer coverage scoring
// - optional handoff and calibration fields used by scorer calibration
//
// Authority: call-2-harness-build-plan-v1.md Phase B,
//            call-2-quality-architecture-v0.3.1.md §4.3
// Existing features preserved: Yes.
// ============================================================================

import scenesData from "@/data/call-2-scenes/scenes.json";

// ── Types ──────────────────────────────────────────────────────────────────

/**
 * The five scene categories from architecture §4. `real_world` is reserved
 * for the production replay slice (Phase J — deferred until Sentinel ships).
 */
export type SceneCategory =
  | "canonical"
  | "stress"
  | "trap"
  | "human_factors"
  | "alien"
  | "real_world";

export type SceneStatus = "approved" | "drafted" | "pending" | "rejected";
export type TagProvenance =
  | "manual"
  | "generator_declared"
  | "mechanical_inferred";
export type CompressionTolerance = "low" | "medium" | "high";

/**
 * A single scene in the harness library.
 *
 * `dev_only` is set when an input exceeds production's sentence cap (1000
 * chars) — such scenes are valid for the dev endpoint but MUST NOT be sent
 * to the production /api/generate-tier-prompts route.
 */
export interface Scene {
  readonly id: string;
  readonly category: SceneCategory;
  readonly concept: string;
  readonly input: string;
  readonly tags: readonly string[];
  readonly exercises_clusters: readonly string[];
  readonly exercises_rules: readonly string[];
  readonly perturbation_seeds: readonly string[];
  readonly holdout: boolean;
  readonly status: SceneStatus;
  readonly tag_provenance: TagProvenance;
  readonly dev_only?: boolean;
  readonly dev_only_reason?: string;
  readonly expected_elements?: readonly string[];
  readonly input_class?: string;
  readonly primary_subject?: string;
  readonly critical_anchors?: readonly string[];
  readonly secondary_anchors?: readonly string[];
  readonly forbidden_positive_inventions?: readonly string[];
  readonly compression_tolerance?: CompressionTolerance;
  readonly handoff_notes?: string;
  readonly gold_review_required?: boolean;
}

export interface SceneLibraryMetadata {
  readonly schema_version: string;
  readonly generated_from: string;
  readonly generated_at: string;
  readonly count: number;
}

interface RawScenesFile {
  readonly schema_version: string;
  readonly generated_from: string;
  readonly generated_at: string;
  readonly count: number;
  readonly scenes: readonly Scene[];
}

// ── Module-scope frozen data ───────────────────────────────────────────────

const RAW = scenesData as unknown as RawScenesFile;

// Defensive: deep-freeze on first load so consumers can't mutate the library.
function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === "object") {
    Object.freeze(obj);
    for (const key of Object.keys(obj)) {
      const value = (obj as Record<string, unknown>)[key];
      if (value && typeof value === "object") {
        deepFreeze(value);
      }
    }
  }
  return obj;
}

const FROZEN_SCENES: readonly Scene[] = deepFreeze(RAW.scenes);

const METADATA: SceneLibraryMetadata = Object.freeze({
  schema_version: RAW.schema_version,
  generated_from: RAW.generated_from,
  generated_at: RAW.generated_at,
  count: RAW.count,
});

// Sanity check at module load: declared count must match actual scenes.
// This is the first thing that breaks if scenes.json is regenerated wrong.
if (FROZEN_SCENES.length !== METADATA.count) {
  throw new Error(
    `[scene-library] schema mismatch: metadata.count=${METADATA.count} but scenes.length=${FROZEN_SCENES.length}`,
  );
}

// Build an ID lookup map once. Throws on duplicate IDs (data integrity check).
const SCENES_BY_ID: ReadonlyMap<string, Scene> = (() => {
  const map = new Map<string, Scene>();
  for (const scene of FROZEN_SCENES) {
    if (map.has(scene.id)) {
      throw new Error(`[scene-library] duplicate scene id: ${scene.id}`);
    }
    map.set(scene.id, scene);
  }
  return map;
})();

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Load scenes with optional filters.
 *
 * Defaults:
 *   - includeHoldout: false (holdout scenes excluded by default)
 *   - includeDevOnly: true  (dev-only scenes included by default)
 *   - category: undefined (all categories)
 *   - status: 'approved' (only approved scenes by default)
 */
export function loadScenes(
  opts: {
    includeHoldout?: boolean;
    includeDevOnly?: boolean;
    category?: SceneCategory;
    status?: SceneStatus;
  } = {},
): readonly Scene[] {
  const {
    includeHoldout = false,
    includeDevOnly = true,
    category,
    status = "approved",
  } = opts;

  return FROZEN_SCENES.filter((scene) => {
    if (!includeHoldout && scene.holdout) return false;
    if (!includeDevOnly && scene.dev_only === true) return false;
    if (category !== undefined && scene.category !== category) return false;
    if (status !== undefined && scene.status !== status) return false;
    return true;
  });
}

/**
 * Look up a single scene by ID. Returns null if not found (does not throw).
 */
export function loadSceneById(id: string): Scene | null {
  return SCENES_BY_ID.get(id) ?? null;
}

/**
 * Get scene-library metadata (schema version, generation timestamp, total count).
 */
export function getSceneLibraryMetadata(): SceneLibraryMetadata {
  return METADATA;
}

/**
 * Get scene counts grouped by category. Always counts ALL scenes regardless
 * of holdout/status — this is a library-shape introspection helper.
 */
export function getSceneCountsByCategory(): Readonly<
  Record<SceneCategory, number>
> {
  const counts: Record<SceneCategory, number> = {
    canonical: 0,
    stress: 0,
    trap: 0,
    human_factors: 0,
    alien: 0,
    real_world: 0,
  };
  for (const scene of FROZEN_SCENES) {
    counts[scene.category] += 1;
  }
  return Object.freeze(counts);
}

/**
 * Get the list of scenes that are flagged dev_only. Useful for the harness
 * runner to warn (or refuse) when running against the production route.
 */
export function getDevOnlyScenes(): readonly Scene[] {
  return FROZEN_SCENES.filter((s) => s.dev_only === true);
}
