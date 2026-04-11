// src/lib/call-3-transforms/transform-types.ts
// ============================================================================
// Shared types for the deterministic transform catalogue.
// Extracted to avoid circular imports between index.ts and individual
// transform files.
// ============================================================================

/**
 * The output of a single deterministic transform.
 * Every transform function returns this shape.
 */
export interface TransformOutput {
  /** The (possibly modified) text */
  readonly text: string;
  /** Human-readable change descriptions (empty if no changes) */
  readonly changes: readonly string[];
}
