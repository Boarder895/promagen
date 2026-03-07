// src/lib/showcase/database.ts
// ============================================================================
// SHOWCASE DATABASE — Table creation for prompt_showcase_entries
// ============================================================================
//
// Creates the prompt_showcase_entries table used by Community Pulse and
// Prompt of the Moment auto-logger. Extracted from the retired
// likes/database.ts (7 March 2026) — only the showcase table, not
// the orphaned prompt_likes table.
//
// Existing features preserved: Yes.
// ============================================================================

import { db, hasDatabaseConfigured } from '@/lib/db';

let tablesEnsured = false;

/**
 * Create prompt_showcase_entries table if not exists.
 * Idempotent — safe to call on every request. Caches after first success.
 */
export async function ensureShowcaseTables(): Promise<void> {
  if (tablesEnsured || !hasDatabaseConfigured()) return;

  try {
    await db()`
      CREATE TABLE IF NOT EXISTS prompt_showcase_entries (
        id            TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        city          TEXT NOT NULL,
        country_code  TEXT NOT NULL,
        venue         TEXT NOT NULL,
        mood          TEXT NOT NULL,
        tier          TEXT NOT NULL,
        platform_id   TEXT,
        prompt_text   TEXT NOT NULL,
        description   TEXT NOT NULL,
        score         INTEGER NOT NULL DEFAULT 0,
        source        TEXT NOT NULL DEFAULT 'weather',
        like_count    INTEGER NOT NULL DEFAULT 0,
        prompts_json  TEXT,
        weather_json  TEXT,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await db()`
      CREATE INDEX IF NOT EXISTS idx_showcase_entries_created
      ON prompt_showcase_entries (created_at DESC)
    `;

    await db()`
      CREATE INDEX IF NOT EXISTS idx_showcase_entries_likes_today
      ON prompt_showcase_entries (like_count DESC, created_at)
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `;

    tablesEnsured = true;
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[ShowcaseDB] Table creation failed:', err);
    }
  }
}
