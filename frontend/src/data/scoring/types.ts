// src/data/scoring/types.ts
// ============================================================================
// BUILDER QUALITY INTELLIGENCE — Type Definitions
// ============================================================================
// Authority: docs/authority/builder-quality-intelligence.md v2.5.0 §3.1
// ============================================================================

/** A single expected anchor with severity weighting */
export interface AnchorSpec {
  /** The anchor term to look for in optimised output */
  term: string;
  /** How much losing this anchor matters */
  severity: 'critical' | 'important' | 'optional';
}

/** A test scene used for builder quality regression testing */
export interface TestScene {
  /** Unique scene identifier (e.g. "scene-01-minimal") */
  id: string;
  /** Human-readable name */
  name: string;
  /** The raw human input text — what a user would type */
  humanText: string;
  /** Expected anchors that Call 3 should preserve, with severity */
  expectedAnchors: AnchorSpec[];
  /** What this scene is specifically designed to stress-test */
  stressTarget: string;
  /** Which prompt builder categories this scene covers */
  categoriesExpected: string[];
  /** Whether this scene is a holdout (never used during tuning) */
  holdout: boolean;
}

/**
 * Result of auditing a single anchor in optimised output.
 * Matching follows the strict §3.2 policy — when in doubt, `dropped`.
 */
export interface AnchorAuditEntry {
  /** The anchor term being audited */
  anchor: string;
  /** Severity from the test scene definition */
  severity: 'critical' | 'important' | 'optional';
  /** Three-level classification per §3.2 matching policy */
  status: 'exact' | 'approximate' | 'dropped';
  /** Optional note explaining the classification (especially for approximate/dropped) */
  note?: string;
}

/** Frozen Call 2 snapshot for builder-mode regression testing */
export interface FrozenSnapshot {
  /** Scene ID this snapshot was generated for */
  sceneId: string;
  /** Tier (1–4) this snapshot was generated for */
  tier: 1 | 2 | 3 | 4;
  /** Call 2 system prompt version at time of generation */
  call2Version: string;
  /** The frozen assembled prompt text */
  assembledPrompt: string;
  /** MD5 hash of assembledPrompt content */
  snapshotHash: string;
  /** ISO timestamp of snapshot creation */
  createdAt: string;
}
