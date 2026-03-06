// src/lib/likes/database.ts
// ============================================================================
// LIKES DATABASE — Schema + Queries
// ============================================================================
// Tables: prompt_likes, prompt_showcase_entries
// Pattern: Same as learning/database.ts — lazy table creation via ensureLikeTables()
//
// Authority: docs/authority/homepage.md §7.3
// Existing features preserved: Yes (additive module)
// ============================================================================

import 'server-only';

import { db, hasDatabaseConfigured } from '@/lib/db';

// ============================================================================
// TABLE CREATION
// ============================================================================

let tablesEnsured = false;

async function ensureShowcaseEntriesTable(): Promise<void> {
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS prompt_showcase_entries (
      id            TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      city          TEXT NOT NULL,
      country_code  TEXT NOT NULL,
      venue         TEXT NOT NULL,
      mood          TEXT NOT NULL,
      tier          TEXT NOT NULL,
      platform_id   TEXT,
      prompt_text   TEXT NOT NULL,
      description   TEXT NOT NULL DEFAULT '',
      score         INTEGER NOT NULL DEFAULT 0,
      source        TEXT NOT NULL DEFAULT 'weather',
      like_count    INTEGER NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_showcase_entries_created
      ON prompt_showcase_entries (created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_showcase_entries_likes_today
      ON prompt_showcase_entries (like_count DESC, created_at)
  `;
}

async function ensurePromptLikesTable(): Promise<void> {
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS prompt_likes (
      id            TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      prompt_id     TEXT NOT NULL,
      session_id    TEXT NOT NULL,
      user_id       TEXT,
      country_code  TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_likes_session_prompt
      ON prompt_likes (session_id, prompt_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_prompt_likes_prompt_id
      ON prompt_likes (prompt_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_prompt_likes_created
      ON prompt_likes (created_at)
  `;
}

/**
 * Create both like-related tables if they don't exist.
 * Safe to call repeatedly — uses IF NOT EXISTS + in-memory flag.
 */
export async function ensureLikeTables(): Promise<void> {
  if (tablesEnsured) return;
  if (!hasDatabaseConfigured()) return;

  await ensureShowcaseEntriesTable();
  await ensurePromptLikesTable();

  // Add prompts_json column (categoryMap as JSON) — safe if already exists
  try {
    const sql = db();
    await sql`ALTER TABLE prompt_showcase_entries ADD COLUMN IF NOT EXISTS prompts_json TEXT`;
    await sql`ALTER TABLE prompt_showcase_entries ADD COLUMN IF NOT EXISTS weather_json TEXT`;
  } catch {
    // Column may already exist or ALTER not supported — safe to continue
  }

  tablesEnsured = true;
}

// ============================================================================
// LIKE OPERATIONS
// ============================================================================

export interface LikeResult {
  success: boolean;
  likeCount: number;
  alreadyLiked: boolean;
}

/**
 * Insert a like. Returns new count + whether it was a duplicate.
 * Uses ON CONFLICT to be idempotent.
 */
export async function insertLike(
  promptId: string,
  sessionId: string,
  userId: string | null,
  countryCode: string | null,
): Promise<LikeResult> {
  const sql = db();

  // Attempt insert — ON CONFLICT means the session already liked this prompt
  const inserted = await sql`
    INSERT INTO prompt_likes (prompt_id, session_id, user_id, country_code)
    VALUES (${promptId}, ${sessionId}, ${userId}, ${countryCode})
    ON CONFLICT (session_id, prompt_id) DO NOTHING
    RETURNING id
  `;

  const wasInserted = inserted.length > 0;

  if (wasInserted) {
    // Increment denormalised like_count on showcase entry (if exists)
    await sql`
      UPDATE prompt_showcase_entries
      SET like_count = like_count + 1
      WHERE id = ${promptId}
    `.catch(() => {
      // Entry might not exist yet (POTM prompts are ephemeral)
      // That's fine — like_count is a nice-to-have, not critical
    });
  }

  // Get current count
  const countResult = await sql`
    SELECT COUNT(*)::int AS count FROM prompt_likes WHERE prompt_id = ${promptId}
  `;
  const likeCount = countResult[0]?.count ?? 0;

  return {
    success: true,
    likeCount,
    alreadyLiked: !wasInserted,
  };
}

/**
 * Remove a like. Returns new count.
 */
export async function removeLike(
  promptId: string,
  sessionId: string,
): Promise<LikeResult> {
  const sql = db();

  const deleted = await sql`
    DELETE FROM prompt_likes
    WHERE session_id = ${sessionId} AND prompt_id = ${promptId}
    RETURNING id
  `;

  const wasDeleted = deleted.length > 0;

  if (wasDeleted) {
    await sql`
      UPDATE prompt_showcase_entries
      SET like_count = GREATEST(0, like_count - 1)
      WHERE id = ${promptId}
    `.catch(() => {
      // Entry might not exist — safe to ignore
    });
  }

  const countResult = await sql`
    SELECT COUNT(*)::int AS count FROM prompt_likes WHERE prompt_id = ${promptId}
  `;
  const likeCount = countResult[0]?.count ?? 0;

  return {
    success: true,
    likeCount,
    alreadyLiked: false,
  };
}

/**
 * Check which prompt IDs this session has already liked.
 * Returns a Set of liked prompt IDs.
 */
export async function getLikedStatus(
  sessionId: string,
  promptIds: string[],
): Promise<Map<string, { liked: boolean; count: number }>> {
  const sql = db();
  const result = new Map<string, { liked: boolean; count: number }>();

  if (promptIds.length === 0) return result;

  // Get likes by this session
  const sessionLikes = await sql`
    SELECT prompt_id FROM prompt_likes
    WHERE session_id = ${sessionId} AND prompt_id = ANY(${promptIds})
  `;
  const likedSet = new Set(sessionLikes.map((r) => r.prompt_id as string));

  // Get counts for all requested IDs
  const counts = await sql`
    SELECT prompt_id, COUNT(*)::int AS count
    FROM prompt_likes
    WHERE prompt_id = ANY(${promptIds})
    GROUP BY prompt_id
  `;
  const countMap = new Map(counts.map((r) => [r.prompt_id as string, r.count as number]));

  for (const id of promptIds) {
    result.set(id, {
      liked: likedSet.has(id),
      count: countMap.get(id) ?? 0,
    });
  }

  return result;
}
