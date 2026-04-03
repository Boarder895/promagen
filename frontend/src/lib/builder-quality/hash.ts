// src/lib/builder-quality/hash.ts
// ============================================================================
// BUILDER QUALITY INTELLIGENCE — Hash Helpers
// ============================================================================
// Pure MD5 hash functions for builder versioning and snapshot fingerprinting.
// No server-only dependency — safe to import from scripts and app code.
//
// v1.0.0 (3 Apr 2026): Initial implementation.
//
// Authority: docs/authority/builder-quality-intelligence.md v2.5.0 §7
// Existing features preserved: Yes (new file, no modifications).
// ============================================================================

import { createHash } from 'node:crypto';

/**
 * MD5 hash of arbitrary string content.
 * Used for snapshot hashes and content fingerprinting.
 */
export function md5(content: string): string {
  return createHash('md5').update(content, 'utf8').digest('hex');
}

/**
 * MD5 hash of a file's content (read from disk).
 * Used for builder_version — hashing the builder .ts file content.
 */
export function md5File(fileContent: string): string {
  return md5(fileContent);
}

/**
 * Generate a unique run ID: bqr-{timestamp}-{random}
 */
export function generateRunId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `bqr-${ts}-${rand}`;
}
