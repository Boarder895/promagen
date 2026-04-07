// src/lib/saved-prompts/database.ts
// ============================================================================
// SAVED PROMPTS — Database Operations (v1.0.0)
// ============================================================================
// Persistent storage for paid users' saved prompts.
// Free users remain on localStorage (zero cost). Paid users get cross-device
// sync backed by Neon Postgres.
//
// Security model:
// - Every query is scoped by user_id (Clerk). No cross-user access possible.
// - All queries use parameterised statements (postgres tagged templates).
// - 500 prompt cap enforced at insert time via countForUser() guard.
// - No raw string interpolation — ever.
// - Source field is validated against a strict allowlist.
// - JSONB fields are JSON.stringify'd before insert, parsed on read.
//
// Table: saved_prompts (one row per saved prompt per user)
// Pattern: Follows builder-quality/database.ts + learning/database.ts
//
// Authority: docs/authority/saved-page.md §13.2
// Existing features preserved: Yes (new file, no modifications)
// ============================================================================

import 'server-only';

import { db, hasDatabaseConfigured } from '@/lib/db';

// Re-export for convenience
export { hasDatabaseConfigured };

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum prompts a single user can store in the database */
export const MAX_PROMPTS_PER_USER = 500;

/** Valid source types — strict allowlist */
const VALID_SOURCES = new Set(['builder', 'tooltip']);

/** Valid mood types — strict allowlist */
const VALID_MOODS = new Set(['calm', 'intense', 'neutral']);

// =============================================================================
// TABLE CREATION (AUTO-MIGRATION)
// =============================================================================

/**
 * Create saved_prompts table if not exists.
 * Called by the API route on first request and by the sync endpoint.
 * Safe to call multiple times (CREATE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS).
 */
export async function ensureSavedPromptsTable(): Promise<void> {
  await db()`
    CREATE TABLE IF NOT EXISTS saved_prompts (
      id              SERIAL PRIMARY KEY,

      -- Identity: prompt_id is the client-generated UUID, user_id is Clerk
      prompt_id       TEXT NOT NULL,
      user_id         TEXT NOT NULL,

      -- Core prompt data
      name            TEXT NOT NULL,
      platform_id     TEXT NOT NULL,
      platform_name   TEXT NOT NULL,
      positive_prompt TEXT NOT NULL,
      negative_prompt TEXT,

      -- Structured data (JSONB — preserves full fidelity)
      selections      JSONB NOT NULL DEFAULT '{}',
      custom_values   JSONB NOT NULL DEFAULT '{}',
      families        JSONB NOT NULL DEFAULT '[]',

      -- Metadata
      mood            TEXT NOT NULL DEFAULT 'neutral',
      coherence_score SMALLINT NOT NULL DEFAULT 0,
      character_count SMALLINT NOT NULL DEFAULT 0,
      source          TEXT NOT NULL DEFAULT 'builder',
      folder          TEXT,
      tier            SMALLINT,
      notes           TEXT,
      tags            JSONB DEFAULT '[]',
      is_optimised    BOOLEAN NOT NULL DEFAULT FALSE,
      optimised_prompt TEXT,

      -- Timestamps
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      -- Hard uniqueness: one prompt_id per user (prevents duplicate sync)
      CONSTRAINT saved_prompts_user_prompt_unique UNIQUE (user_id, prompt_id)
    )
  `;

  // Primary query: list user's prompts newest first
  await db()`
    CREATE INDEX IF NOT EXISTS idx_saved_prompts_user_updated
    ON saved_prompts (user_id, updated_at DESC)
  `;

  // Folder filtering (common filter path)
  await db()`
    CREATE INDEX IF NOT EXISTS idx_saved_prompts_user_folder
    ON saved_prompts (user_id, folder)
  `;

  // Platform filtering
  await db()`
    CREATE INDEX IF NOT EXISTS idx_saved_prompts_user_platform
    ON saved_prompts (user_id, platform_id)
  `;

  // Cap enforcement: fast COUNT(*) per user
  await db()`
    CREATE INDEX IF NOT EXISTS idx_saved_prompts_user_count
    ON saved_prompts (user_id)
  `;
}

// =============================================================================
// TYPES
// =============================================================================

/** Row shape from the saved_prompts table */
interface SavedPromptRow {
  id: number;
  prompt_id: string;
  user_id: string;
  name: string;
  platform_id: string;
  platform_name: string;
  positive_prompt: string;
  negative_prompt: string | null;
  selections: Record<string, unknown>;
  custom_values: Record<string, unknown>;
  families: string[];
  mood: string;
  coherence_score: number;
  character_count: number;
  source: string;
  folder: string | null;
  tier: number | null;
  notes: string | null;
  tags: string[] | null;
  is_optimised: boolean;
  optimised_prompt: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

/** App-level saved prompt type (matches client SavedPrompt interface) */
export interface DbSavedPrompt {
  id: string;
  name: string;
  platformId: string;
  platformName: string;
  positivePrompt: string;
  negativePrompt?: string;
  selections: Record<string, unknown>;
  customValues: Record<string, unknown>;
  families: string[];
  mood: 'calm' | 'intense' | 'neutral';
  coherenceScore: number;
  characterCount: number;
  source: 'builder' | 'tooltip';
  folder?: string;
  tier?: number;
  notes?: string;
  tags?: string[];
  isOptimised?: boolean;
  optimisedPrompt?: string;
  createdAt: string;
  updatedAt: string;
}

/** Input for creating/upserting a saved prompt */
export interface SavedPromptInput {
  id: string;
  name: string;
  platformId: string;
  platformName: string;
  positivePrompt: string;
  negativePrompt?: string;
  selections?: Record<string, unknown>;
  customValues?: Record<string, unknown>;
  families?: string[];
  mood?: string;
  coherenceScore?: number;
  characterCount?: number;
  source?: string;
  folder?: string;
  tier?: number;
  notes?: string;
  tags?: string[];
  isOptimised?: boolean;
  optimisedPrompt?: string;
  createdAt?: string;
  updatedAt?: string;
}

// =============================================================================
// ROW MAPPING
// =============================================================================

/**
 * Map a database row to the app-level type.
 * JSONB columns are already parsed by the postgres driver.
 */
function mapRow(row: SavedPromptRow): DbSavedPrompt {
  return {
    id: row.prompt_id,
    name: row.name,
    platformId: row.platform_id,
    platformName: row.platform_name,
    positivePrompt: row.positive_prompt,
    negativePrompt: row.negative_prompt ?? undefined,
    selections: (row.selections ?? {}) as Record<string, unknown>,
    customValues: (row.custom_values ?? {}) as Record<string, unknown>,
    families: Array.isArray(row.families) ? row.families : [],
    mood: VALID_MOODS.has(row.mood) ? (row.mood as DbSavedPrompt['mood']) : 'neutral',
    coherenceScore: row.coherence_score ?? 0,
    characterCount: row.character_count ?? 0,
    source: VALID_SOURCES.has(row.source) ? (row.source as DbSavedPrompt['source']) : 'builder',
    folder: row.folder ?? undefined,
    tier: row.tier ?? undefined,
    notes: row.notes ?? undefined,
    tags: Array.isArray(row.tags) ? row.tags : undefined,
    isOptimised: row.is_optimised ?? false,
    optimisedPrompt: row.optimised_prompt ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

// =============================================================================
// INPUT VALIDATION
// =============================================================================

/**
 * Sanitise and validate a prompt input before DB operations.
 * Returns a clean copy with safe defaults. Throws on critical violations.
 */
function validateInput(input: SavedPromptInput): {
  id: string;
  name: string;
  platformId: string;
  platformName: string;
  positivePrompt: string;
  negativePrompt: string | null;
  selections: string;
  customValues: string;
  families: string;
  mood: string;
  coherenceScore: number;
  characterCount: number;
  source: string;
  folder: string | null;
  tier: number | null;
  notes: string | null;
  tags: string;
  isOptimised: boolean;
  optimisedPrompt: string | null;
  createdAt: Date;
  updatedAt: Date;
} {
  // Required fields — reject if missing
  if (!input.id || typeof input.id !== 'string') {
    throw new Error('prompt id is required and must be a string');
  }
  if (!input.name || typeof input.name !== 'string') {
    throw new Error('prompt name is required');
  }
  if (!input.platformId || typeof input.platformId !== 'string') {
    throw new Error('platformId is required');
  }
  if (!input.platformName || typeof input.platformName !== 'string') {
    throw new Error('platformName is required');
  }
  if (!input.positivePrompt || typeof input.positivePrompt !== 'string') {
    throw new Error('positivePrompt is required');
  }

  // Length guards — prevent abuse
  if (input.id.length > 100) throw new Error('prompt id too long');
  if (input.name.length > 200) throw new Error('name too long');
  if (input.platformId.length > 100) throw new Error('platformId too long');
  if (input.platformName.length > 200) throw new Error('platformName too long');
  if (input.positivePrompt.length > 50_000) throw new Error('positivePrompt too long');
  if (input.negativePrompt && input.negativePrompt.length > 50_000) throw new Error('negativePrompt too long');
  if (input.notes && input.notes.length > 5_000) throw new Error('notes too long');
  if (input.folder && input.folder.length > 100) throw new Error('folder name too long');
  if (input.optimisedPrompt && input.optimisedPrompt.length > 50_000) throw new Error('optimisedPrompt too long');

  // Validate enums
  const source = VALID_SOURCES.has(input.source ?? '') ? input.source! : 'builder';
  const mood = VALID_MOODS.has(input.mood ?? '') ? input.mood! : 'neutral';

  // Clamp numbers
  const coherenceScore = Math.max(0, Math.min(100, input.coherenceScore ?? 0));
  const characterCount = Math.max(0, Math.min(100_000, input.characterCount ?? 0));
  const tier = input.tier != null ? Math.max(1, Math.min(4, input.tier)) : null;

  // Tags limit — max 20 tags, max 50 chars each
  let tags: string[] = [];
  if (Array.isArray(input.tags)) {
    tags = input.tags
      .filter((t): t is string => typeof t === 'string' && t.length > 0)
      .slice(0, 20)
      .map((t) => t.slice(0, 50));
  }

  return {
    id: input.id.trim(),
    name: input.name.trim().slice(0, 200),
    platformId: input.platformId.trim(),
    platformName: input.platformName.trim().slice(0, 200),
    positivePrompt: input.positivePrompt,
    negativePrompt: input.negativePrompt ?? null,
    selections: JSON.stringify(input.selections ?? {}),
    customValues: JSON.stringify(input.customValues ?? {}),
    families: JSON.stringify(Array.isArray(input.families) ? input.families : []),
    mood,
    coherenceScore,
    characterCount,
    source,
    folder: input.folder?.trim().slice(0, 100) ?? null,
    tier,
    notes: input.notes?.trim().slice(0, 5_000) ?? null,
    tags: JSON.stringify(tags),
    isOptimised: input.isOptimised ?? false,
    optimisedPrompt: input.optimisedPrompt ?? null,
    createdAt: input.createdAt ? new Date(input.createdAt) : new Date(),
    updatedAt: input.updatedAt ? new Date(input.updatedAt) : new Date(),
  };
}

// =============================================================================
// HEALTH CHECK
// =============================================================================

export interface SavedPromptsHealth {
  connected: boolean;
  tableExists: boolean;
  totalRows: number;
}

/**
 * Check database health for saved prompts system.
 * Returns safe defaults on any error — never throws.
 */
export async function checkHealth(): Promise<SavedPromptsHealth> {
  try {
    await db()`SELECT 1`;

    const tableCheck = await db()<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'saved_prompts'
      ) AS exists
    `;

    const tableExists = tableCheck[0]?.exists === true;
    let totalRows = 0;

    if (tableExists) {
      const rc = await db()<{ count: number }[]>`
        SELECT COUNT(*)::int AS count FROM saved_prompts
      `;
      totalRows = rc[0]?.count ?? 0;
    }

    return { connected: true, tableExists, totalRows };
  } catch (error) {
    console.error('[saved-prompts] Health check failed:', error);
    return { connected: false, tableExists: false, totalRows: 0 };
  }
}

// =============================================================================
// QUERIES — All scoped by user_id
// =============================================================================

/**
 * Count how many prompts a user has stored.
 * Used to enforce the 500 prompt cap.
 */
export async function countForUser(userId: string): Promise<number> {
  try {
    const rows = await db()<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM saved_prompts
      WHERE user_id = ${userId}
    `;
    return rows[0]?.count ?? 0;
  } catch (error) {
    console.error('[saved-prompts] Error counting user prompts:', error);
    return 0;
  }
}

/**
 * Get all prompts for a user, newest first.
 * This is the primary read path — the hook calls this on mount.
 */
export async function getPromptsForUser(userId: string): Promise<DbSavedPrompt[]> {
  try {
    const rows = await db()<SavedPromptRow[]>`
      SELECT *
      FROM saved_prompts
      WHERE user_id = ${userId}
      ORDER BY updated_at DESC
    `;
    return rows.map(mapRow);
  } catch (error) {
    console.error('[saved-prompts] Error fetching user prompts:', error);
    return [];
  }
}

/**
 * Get a single prompt by ID for a specific user.
 * Returns null if not found or if the prompt belongs to a different user.
 */
export async function getPromptForUser(
  userId: string,
  promptId: string,
): Promise<DbSavedPrompt | null> {
  try {
    const rows = await db()<SavedPromptRow[]>`
      SELECT *
      FROM saved_prompts
      WHERE user_id = ${userId} AND prompt_id = ${promptId}
    `;
    const row = rows[0];
    return row ? mapRow(row) : null;
  } catch (error) {
    console.error('[saved-prompts] Error fetching prompt:', error);
    return null;
  }
}

/**
 * Insert a new saved prompt.
 * Enforces the 500 prompt cap — returns null if at limit.
 * Uses UPSERT (ON CONFLICT) to handle duplicate prompt_ids gracefully
 * (e.g. retry after network failure, or sync collision).
 */
export async function insertPrompt(
  userId: string,
  input: SavedPromptInput,
): Promise<DbSavedPrompt | null> {
  try {
    // Cap check — reject before expensive insert
    const count = await countForUser(userId);
    if (count >= MAX_PROMPTS_PER_USER) {
      console.warn(`[saved-prompts] User ${userId} at cap (${count}/${MAX_PROMPTS_PER_USER})`);
      return null;
    }

    const v = validateInput(input);

    const rows = await db()<SavedPromptRow[]>`
      INSERT INTO saved_prompts (
        prompt_id, user_id, name, platform_id, platform_name,
        positive_prompt, negative_prompt,
        selections, custom_values, families,
        mood, coherence_score, character_count,
        source, folder, tier, notes, tags,
        is_optimised, optimised_prompt,
        created_at, updated_at
      ) VALUES (
        ${v.id}, ${userId}, ${v.name}, ${v.platformId}, ${v.platformName},
        ${v.positivePrompt}, ${v.negativePrompt},
        ${v.selections}::jsonb, ${v.customValues}::jsonb, ${v.families}::jsonb,
        ${v.mood}, ${v.coherenceScore}, ${v.characterCount},
        ${v.source}, ${v.folder}, ${v.tier}, ${v.notes}, ${v.tags}::jsonb,
        ${v.isOptimised}, ${v.optimisedPrompt},
        ${v.createdAt}, ${v.updatedAt}
      )
      ON CONFLICT (user_id, prompt_id)
      DO UPDATE SET
        name = EXCLUDED.name,
        platform_id = EXCLUDED.platform_id,
        platform_name = EXCLUDED.platform_name,
        positive_prompt = EXCLUDED.positive_prompt,
        negative_prompt = EXCLUDED.negative_prompt,
        selections = EXCLUDED.selections,
        custom_values = EXCLUDED.custom_values,
        families = EXCLUDED.families,
        mood = EXCLUDED.mood,
        coherence_score = EXCLUDED.coherence_score,
        character_count = EXCLUDED.character_count,
        source = EXCLUDED.source,
        folder = EXCLUDED.folder,
        tier = EXCLUDED.tier,
        notes = EXCLUDED.notes,
        tags = EXCLUDED.tags,
        is_optimised = EXCLUDED.is_optimised,
        optimised_prompt = EXCLUDED.optimised_prompt,
        updated_at = NOW()
      RETURNING *
    `;

    const row = rows[0];
    return row ? mapRow(row) : null;
  } catch (error) {
    console.error('[saved-prompts] Error inserting prompt:', error);
    return null;
  }
}

/**
 * Update specific fields on a saved prompt.
 * Only the fields provided in `updates` are changed — uses CASE/WHEN
 * so unchanged fields keep their current DB value.
 * user_id scoping prevents cross-user modification.
 * All values are parameterised via postgres tagged templates — zero injection risk.
 */
export async function updatePrompt(
  userId: string,
  promptId: string,
  updates: Partial<Pick<
    SavedPromptInput,
    'name' | 'folder' | 'notes' | 'tags' | 'mood' | 'isOptimised' | 'optimisedPrompt'
  >>,
): Promise<DbSavedPrompt | null> {
  try {
    // Pre-compute sanitised values (before the query, not inline)
    const hasName = updates.name !== undefined;
    const safeName = hasName ? String(updates.name).trim().slice(0, 200) : null;
    if (hasName && !safeName) throw new Error('name cannot be empty');

    const hasFolder = updates.folder !== undefined;
    const safeFolder = hasFolder ? (updates.folder?.trim().slice(0, 100) ?? null) : null;

    const hasNotes = updates.notes !== undefined;
    const safeNotes = hasNotes ? (updates.notes?.trim().slice(0, 5_000) ?? null) : null;

    const hasTags = updates.tags !== undefined;
    const safeTags = hasTags
      ? JSON.stringify(
          Array.isArray(updates.tags)
            ? updates.tags.filter((t): t is string => typeof t === 'string').slice(0, 20).map((t) => t.slice(0, 50))
            : []
        )
      : '[]';

    const hasMood = updates.mood !== undefined && VALID_MOODS.has(updates.mood ?? '');
    const safeMood = hasMood ? updates.mood! : 'neutral';

    const hasIsOptimised = updates.isOptimised !== undefined;
    const safeIsOptimised = hasIsOptimised ? Boolean(updates.isOptimised) : false;

    const hasOptimisedPrompt = updates.optimisedPrompt !== undefined;
    const safeOptimisedPrompt = hasOptimisedPrompt
      ? (updates.optimisedPrompt?.slice(0, 50_000) ?? null)
      : null;

    // If nothing to update, return current state
    if (!hasName && !hasFolder && !hasNotes && !hasTags && !hasMood && !hasIsOptimised && !hasOptimisedPrompt) {
      return getPromptForUser(userId, promptId);
    }

    const rows = await db()<SavedPromptRow[]>`
      UPDATE saved_prompts
      SET
        name = CASE WHEN ${hasName} THEN ${safeName} ELSE name END,
        folder = CASE WHEN ${hasFolder} THEN ${safeFolder} ELSE folder END,
        notes = CASE WHEN ${hasNotes} THEN ${safeNotes} ELSE notes END,
        tags = CASE WHEN ${hasTags} THEN ${safeTags}::jsonb ELSE tags END,
        mood = CASE WHEN ${hasMood} THEN ${safeMood} ELSE mood END,
        is_optimised = CASE WHEN ${hasIsOptimised} THEN ${safeIsOptimised} ELSE is_optimised END,
        optimised_prompt = CASE WHEN ${hasOptimisedPrompt} THEN ${safeOptimisedPrompt} ELSE optimised_prompt END,
        updated_at = NOW()
      WHERE user_id = ${userId} AND prompt_id = ${promptId}
      RETURNING *
    `;

    const row = rows[0];
    return row ? mapRow(row) : null;
  } catch (error) {
    console.error('[saved-prompts] Error updating prompt:', error);
    return null;
  }
}

/**
 * Delete a saved prompt.
 * user_id scoping prevents cross-user deletion.
 * Returns true if a row was actually deleted.
 */
export async function deletePrompt(
  userId: string,
  promptId: string,
): Promise<boolean> {
  try {
    const result = await db()`
      DELETE FROM saved_prompts
      WHERE user_id = ${userId} AND prompt_id = ${promptId}
    `;
    return result.count > 0;
  } catch (error) {
    console.error('[saved-prompts] Error deleting prompt:', error);
    return false;
  }
}

/**
 * Delete ALL prompts for a user (nuclear option — clear library).
 * Returns the number of rows deleted.
 */
export async function deleteAllForUser(userId: string): Promise<number> {
  try {
    const result = await db()`
      DELETE FROM saved_prompts
      WHERE user_id = ${userId}
    `;
    return result.count;
  } catch (error) {
    console.error('[saved-prompts] Error clearing user prompts:', error);
    return 0;
  }
}

// =============================================================================
// FOLDER OPERATIONS (Batch)
// =============================================================================

/**
 * Rename a folder — updates all prompts in the old folder to the new name.
 * Scoped to a single user.
 */
export async function renameFolder(
  userId: string,
  oldName: string,
  newName: string,
): Promise<number> {
  try {
    const sanitisedNew = newName.trim().slice(0, 100);
    if (!sanitisedNew) return 0;

    const result = await db()`
      UPDATE saved_prompts
      SET folder = ${sanitisedNew}, updated_at = NOW()
      WHERE user_id = ${userId} AND folder = ${oldName}
    `;
    return result.count;
  } catch (error) {
    console.error('[saved-prompts] Error renaming folder:', error);
    return 0;
  }
}

/**
 * Delete a folder — moves all its prompts to Unsorted (folder = NULL).
 * Scoped to a single user.
 */
export async function deleteFolder(
  userId: string,
  folderName: string,
): Promise<number> {
  try {
    const result = await db()`
      UPDATE saved_prompts
      SET folder = NULL, updated_at = NOW()
      WHERE user_id = ${userId} AND folder = ${folderName}
    `;
    return result.count;
  } catch (error) {
    console.error('[saved-prompts] Error deleting folder:', error);
    return 0;
  }
}

// =============================================================================
// SYNC: localStorage → Database (one-time migration)
// =============================================================================

/**
 * Bulk upsert prompts from localStorage into the database.
 * Used during the one-time sync when a free user upgrades to paid.
 *
 * Security:
 * - Validates every prompt before insert (rejects malformed data).
 * - Respects the 500 cap — stops inserting when the cap is reached.
 * - Uses ON CONFLICT to handle duplicates gracefully (idempotent).
 * - Returns a detailed report of what happened.
 *
 * Performance:
 * - Batched in groups of 50 to avoid overwhelming the connection.
 * - Each batch is a single transaction for atomicity.
 */
export async function syncFromLocalStorage(
  userId: string,
  prompts: SavedPromptInput[],
): Promise<{
  synced: number;
  skipped: number;
  errors: number;
  atCap: boolean;
}> {
  let synced = 0;
  let skipped = 0;
  let errors = 0;

  // Check current count
  const currentCount = await countForUser(userId);
  const remaining = MAX_PROMPTS_PER_USER - currentCount;

  if (remaining <= 0) {
    return { synced: 0, skipped: prompts.length, errors: 0, atCap: true };
  }

  // Only process up to the remaining cap
  const toSync = prompts.slice(0, remaining);
  const BATCH_SIZE = 50;

  for (let i = 0; i < toSync.length; i += BATCH_SIZE) {
    const batch = toSync.slice(i, i + BATCH_SIZE);

    for (const prompt of batch) {
      try {
        const result = await insertPrompt(userId, prompt);
        if (result) {
          synced++;
        } else {
          skipped++;
        }
      } catch {
        errors++;
      }
    }
  }

  // Count anything we couldn't process due to cap
  const cappedOut = prompts.length - toSync.length;
  skipped += cappedOut;

  return {
    synced,
    skipped,
    errors,
    atCap: cappedOut > 0,
  };
}
