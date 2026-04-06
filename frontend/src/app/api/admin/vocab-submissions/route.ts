// src/app/api/admin/vocab-submissions/route.ts
// ============================================================================
// ADMIN — Vocabulary Crowdsourcing API (Phase 7.7)
// ============================================================================
//
// POST  /api/admin/vocab-submissions          — Capture custom term (public)
// GET   /api/admin/vocab-submissions?secret=… — Fetch queue (auth-gated)
// PATCH /api/admin/vocab-submissions?secret=… — Review actions (auth-gated)
//
// Storage: Postgres via learned_weights table (key = 'vocab-submissions').
// Same pattern as scene-candidates — Vercel-compatible, no file I/O.
//
// POST is public and fire-and-forget (called by the client hook when a user
// types a custom term and presses Enter). No auth needed — the payload is
// anonymous and the auto-filter + dedup guards prevent abuse.
//
// GET/PATCH are auth-gated by PROMAGEN_CRON_SECRET (entered in the admin UI).
//
// PATCH supports four actions:
//   reject       — Mark specific terms for exclusion
//   undo-reject  — Flip rejected terms back to pending
//   accept-batch — Accept ALL pending terms (the one-click workflow)
//   rescue       — Move false positives from auto-filtered to pending
//
// Accept-batch returns the accepted terms organized by category so the
// admin UI can show what was added and provide a downloadable export
// for committing updated vocab JSONs to the repo.
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 7.7
//
// Version: 1.0.0
// Created: 2026-02-27
//
// Existing features preserved: Yes.
// ============================================================================

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { env, requireCronSecret } from '@/lib/env';
import {
  ensureAllTables,
  getLearnedWeights,
  upsertLearnedWeights,
} from '@/lib/learning/database';

import type {
  VocabSubmissionsFile,
  VocabSubmission,
  VocabSubmissionPayload,
  VocabPatchPayload,
  VocabAcceptBatchResponse,
  FilteredSubmission,
  GrowthDataPoint,
  SubmissionStatus,
  ConfidenceLevel,
} from '@/types/vocab-submission';
import { calculateConfidence } from '@/types/vocab-submission';

import { checkAutoFilter, normaliseTerm } from '@/lib/vocabulary/vocab-auto-filter';
import {
  suggestCategories,
  termExistsInCategory,
  invalidateVocabCache,
} from '@/lib/vocabulary/category-suggester';

import type { PromptCategory } from '@/types/prompt-builder';
import { CATEGORY_ORDER } from '@/types/prompt-builder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Database key for the vocab submissions blob */
const DB_KEY = 'vocab-submissions';

/** Maximum session IDs stored per submission (prevent unbounded growth) */
const MAX_SESSION_IDS = 50;

/** Maximum daily growth data points (rolling year) */
const MAX_GROWTH_POINTS = 365;

/** No-cache headers for admin responses */
const NO_STORE_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Promagen-Safe-Mode': env.safeMode.enabled ? '1' : '0',
};

// ============================================================================
// HELPERS
// ============================================================================

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

function requireAuth(req: NextRequest): void {
  const expected = requireCronSecret();
  const url = new URL(req.url);
  const authorization = req.headers.get('authorization') ?? '';
  const bearerSecret = authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice('bearer '.length).trim()
    : '';

  const provided = (
    bearerSecret ||
    req.headers.get('x-promagen-cron') ||
    req.headers.get('x-cron-secret') ||
    req.headers.get('x-promagen-cron-secret') ||
    url.searchParams.get('secret') ||
    ''
  ).trim();

  if (!provided || !constantTimeEquals(provided, expected)) {
    throw new Error('Unauthorized');
  }
}

/** Generate a v4-style UUID (server-side) */
function uuid(): string {
  return crypto.randomUUID();
}

/** Get today's date as YYYY-MM-DD */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Get current ISO timestamp */
function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Load the vocab submissions blob from the database.
 * Returns a fresh empty structure if nothing stored yet.
 */
async function loadSubmissions(): Promise<VocabSubmissionsFile> {
  const result = await getLearnedWeights<VocabSubmissionsFile>(DB_KEY);

  if (!result) {
    return {
      version: '1.0.0',
      lastBatchAt: null,
      submissions: [],
      filtered: [],
      stats: { totalReceived: 0, pending: 0, accepted: 0, rejected: 0, autoFiltered: 0 },
      dailyGrowth: [],
    };
  }

  return result.data;
}

/**
 * Persist the vocab submissions blob to the database.
 */
async function saveSubmissions(data: VocabSubmissionsFile): Promise<void> {
  await upsertLearnedWeights(DB_KEY, data);
}

/**
 * Increment or create today's growth data point.
 * Caps the array at MAX_GROWTH_POINTS entries.
 */
function updateDailyGrowth(
  growth: GrowthDataPoint[],
  field: keyof Omit<GrowthDataPoint, 'date'>,
  count: number = 1,
): GrowthDataPoint[] {
  const today = todayISO();
  const existing = growth.find((g) => g.date === today);

  if (existing) {
    existing[field] += count;
  } else {
    const point: GrowthDataPoint = {
      date: today,
      submitted: 0,
      accepted: 0,
      rejected: 0,
      autoFiltered: 0,
    };
    point[field] += count;
    growth.push(point);
  }

  // Cap at rolling year
  if (growth.length > MAX_GROWTH_POINTS) {
    growth.splice(0, growth.length - MAX_GROWTH_POINTS);
  }

  return growth;
}

// ============================================================================
// POST — Capture Custom Term (public, fire-and-forget)
// ============================================================================

/**
 * POST /api/admin/vocab-submissions
 *
 * Body: { term, category, platformId, tier, sessionId }
 *
 * Pipeline:
 *   1. Validate payload
 *   2. Normalise term
 *   3. Auto-filter (profanity/spam/length)
 *   4. Dedup Layer 2: check existing vocabulary JSONs
 *   5. Dedup: check existing queue (increment count if found)
 *   6. Smart Category Suggestion
 *   7. Confidence scoring
 *   8. Store
 *
 * Always returns 200 (fire-and-forget from client perspective).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // --- Parse & validate body ---
    let body: VocabSubmissionPayload;
    try {
      body = (await req.json()) as VocabSubmissionPayload;
    } catch {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (
      !body.term ||
      typeof body.term !== 'string' ||
      !body.category ||
      !body.platformId ||
      !body.tier ||
      !body.sessionId
    ) {
      // Silent accept — don't leak validation details to public endpoint
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Validate category is one of the 12
    if (!CATEGORY_ORDER.includes(body.category as PromptCategory)) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // --- Normalise ---
    const term = normaliseTerm(body.term);
    const category = body.category as PromptCategory;

    if (!term) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // --- Auto-filter (profanity/spam) ---
    const filterResult = checkAutoFilter(term);

    await ensureAllTables();
    const data = await loadSubmissions();

    if (filterResult.blocked) {
      // Store in filtered queue for admin review (rescue false positives)
      const filtered: FilteredSubmission = {
        id: uuid(),
        rawTerm: body.term,
        term,
        category,
        reason: filterResult.reason!,
        matchedPattern: filterResult.matchedPattern!,
        filteredAt: nowISO(),
      };

      data.filtered.push(filtered);
      data.stats.totalReceived += 1;
      data.stats.autoFiltered += 1;
      updateDailyGrowth(data.dailyGrowth, 'autoFiltered');

      await saveSubmissions(data);
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // --- Dedup Layer 2: check existing vocab JSONs ---
    if (termExistsInCategory(term, category)) {
      // Term already exists in production vocab — silently discard
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // --- Dedup: check existing queue ---
    const existingIdx = data.submissions.findIndex(
      (s) => s.term === term && s.category === category,
    );

    if (existingIdx !== -1) {
      // Same term+category already in queue — increment count
      const existing = data.submissions[existingIdx];
      if (!existing) return NextResponse.json({ ok: true }, { status: 200 });
      existing.count += 1;

      // Track unique sessions (capped)
      if (
        !existing.sessionIds.includes(body.sessionId) &&
        existing.sessionIds.length < MAX_SESSION_IDS
      ) {
        existing.sessionIds.push(body.sessionId);
        existing.uniqueSessions = existing.sessionIds.length;
      }

      // Track platforms
      if (!existing.platformIds.includes(body.platformId)) {
        existing.platformIds.push(body.platformId);
      }

      // Recalculate confidence
      existing.confidence = calculateConfidence(
        existing.uniqueSessions,
        existing.platformIds.length,
        existing.count,
      );

      data.stats.totalReceived += 1;
      updateDailyGrowth(data.dailyGrowth, 'submitted');

      await saveSubmissions(data);
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // --- New submission ---
    const suggested = suggestCategories(term, category);

    const submission: VocabSubmission = {
      id: uuid(),
      term,
      category,
      suggestedCategories: suggested,
      platformIds: [body.platformId],
      tier: body.tier,
      count: 1,
      uniqueSessions: 1,
      sessionIds: [body.sessionId],
      confidence: calculateConfidence(1, 1, 1),
      status: 'pending',
      submittedAt: nowISO(),
      acceptedAt: null,
      rejectedAt: null,
    };

    data.submissions.push(submission);
    data.stats.totalReceived += 1;
    data.stats.pending += 1;
    updateDailyGrowth(data.dailyGrowth, 'submitted');

    await saveSubmissions(data);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    // Fire-and-forget — never fail visibly
    console.error('[Vocab Submissions] POST error:', error);
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}

// ============================================================================
// GET — Fetch Queue (auth-gated)
// ============================================================================

/**
 * GET /api/admin/vocab-submissions?secret=…
 *
 * Query params:
 *   secret — PROMAGEN_CRON_SECRET
 *   status — 'pending' | 'accepted' | 'rejected' | 'all' (default: 'all')
 *
 * Returns the queue sorted by confidence (high→medium→low) then count desc.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    requireAuth(req);
  } catch {
    return NextResponse.json(
      { error: 'Not Found' },
      { status: 404, headers: NO_STORE_HEADERS },
    );
  }

  try {
    await ensureAllTables();
    const data = await loadSubmissions();

    // Filter by status if requested
    const statusFilter = new URL(req.url).searchParams.get('status') ?? 'all';
    let submissions = data.submissions;

    if (statusFilter !== 'all') {
      submissions = submissions.filter((s) => s.status === statusFilter);
    }

    // Recalculate confidence scores (may have changed since last GET)
    for (const s of submissions) {
      s.confidence = calculateConfidence(
        s.uniqueSessions,
        s.platformIds.length,
        s.count,
      );
    }

    // Sort: confidence (high→medium→low), then count descending
    const confidenceOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    submissions.sort((a, b) => {
      const confDiff = (confidenceOrder[a.confidence] ?? 3) - (confidenceOrder[b.confidence] ?? 3);
      if (confDiff !== 0) return confDiff;
      return b.count - a.count;
    });

    // Recount stats from actual data (self-healing)
    const stats = {
      totalReceived: data.stats.totalReceived,
      pending: data.submissions.filter((s) => s.status === 'pending').length,
      accepted: data.submissions.filter((s) => s.status === 'accepted').length,
      rejected: data.submissions.filter((s) => s.status === 'rejected').length,
      autoFiltered: data.filtered.length,
    };

    return NextResponse.json(
      {
        ok: true,
        submissions,
        filtered: data.filtered,
        stats,
        dailyGrowth: data.dailyGrowth,
        lastBatchAt: data.lastBatchAt,
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error('[Vocab Submissions] GET error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch submissions' },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

// ============================================================================
// PATCH — Review Actions (auth-gated)
// ============================================================================

/**
 * PATCH /api/admin/vocab-submissions?secret=…
 *
 * Body: VocabPatchPayload (discriminated union on 'action')
 *
 * Actions:
 *   reject       — { action: 'reject', ids: string[] }
 *   undo-reject  — { action: 'undo-reject', ids: string[] }
 *   accept-batch — { action: 'accept-batch' }
 *   rescue       — { action: 'rescue', ids: string[] }
 */
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    requireAuth(req);
  } catch {
    return NextResponse.json(
      { error: 'Not Found' },
      { status: 404, headers: NO_STORE_HEADERS },
    );
  }

  try {
    let body: VocabPatchPayload;
    try {
      body = (await req.json()) as VocabPatchPayload;
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Invalid JSON body' },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    if (!body.action) {
      return NextResponse.json(
        { ok: false, error: 'Missing action' },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    await ensureAllTables();
    const data = await loadSubmissions();

    switch (body.action) {
      case 'reject':
        return handleReject(data, body.ids);

      case 'undo-reject':
        return handleUndoReject(data, body.ids);

      case 'accept-batch':
        return handleAcceptBatch(data);

      case 'rescue':
        return handleRescue(data, body.ids);

      case 'reassign-category':
        return handleReassignCategory(data, body.id, body.newCategory);

      case 'override-confidence':
        return handleOverrideConfidence(data, body.id, body.newConfidence);

      default:
        return NextResponse.json(
          { ok: false, error: `Unknown action: ${(body as { action: string }).action}` },
          { status: 400, headers: NO_STORE_HEADERS },
        );
    }
  } catch (error) {
    console.error('[Vocab Submissions] PATCH error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to process action' },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

// ============================================================================
// PATCH HANDLERS
// ============================================================================

/**
 * Mark specific submissions as rejected.
 * Admin clicked ❌ on individual rows — these get excluded from batch accept.
 */
async function handleReject(
  data: VocabSubmissionsFile,
  ids: string[],
): Promise<NextResponse> {
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'Missing or empty ids array' },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  let rejectedCount = 0;
  const now = nowISO();

  for (const id of ids) {
    const sub = data.submissions.find((s) => s.id === id);
    if (sub && sub.status === 'pending') {
      sub.status = 'rejected';
      sub.rejectedAt = now;
      data.stats.pending = Math.max(0, data.stats.pending - 1);
      data.stats.rejected += 1;
      rejectedCount += 1;
    }
  }

  updateDailyGrowth(data.dailyGrowth, 'rejected', rejectedCount);
  await saveSubmissions(data);

  return NextResponse.json(
    {
      ok: true,
      message: `Rejected ${rejectedCount} term${rejectedCount !== 1 ? 's' : ''}`,
      rejectedCount,
    },
    { headers: NO_STORE_HEADERS },
  );
}

/**
 * Undo reject — flip specific submissions back to pending.
 * Admin clicked ↩️ undo on rejected rows.
 */
async function handleUndoReject(
  data: VocabSubmissionsFile,
  ids: string[],
): Promise<NextResponse> {
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'Missing or empty ids array' },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  let undoneCount = 0;

  for (const id of ids) {
    const sub = data.submissions.find((s) => s.id === id);
    if (sub && sub.status === 'rejected') {
      sub.status = 'pending';
      sub.rejectedAt = null;
      data.stats.rejected = Math.max(0, data.stats.rejected - 1);
      data.stats.pending += 1;
      undoneCount += 1;
    }
  }

  await saveSubmissions(data);

  return NextResponse.json(
    {
      ok: true,
      message: `Restored ${undoneCount} term${undoneCount !== 1 ? 's' : ''} to pending`,
      undoneCount,
    },
    { headers: NO_STORE_HEADERS },
  );
}

/**
 * Accept ALL pending terms — the one-click batch workflow.
 *
 * For each pending submission:
 *   1. Re-verify it doesn't already exist in vocab (Layer 3 guard)
 *   2. Mark as accepted in the queue
 *   3. Collect into per-category buckets
 *
 * Returns the accepted terms organized by category. The admin UI
 * uses this to show what was added and provide a downloadable export
 * for committing to the repo.
 *
 * NOTE: On Vercel, the bundled vocab JSON files are read-only at runtime.
 * The accepted terms are stored in the database. To actually add them to
 * the dropdown vocabularies, the admin exports and commits to the repo.
 * The vocab-loader can be extended to merge DB-accepted terms at load time.
 */
async function handleAcceptBatch(
  data: VocabSubmissionsFile,
): Promise<NextResponse> {
  const pending = data.submissions.filter((s) => s.status === 'pending');

  if (pending.length === 0) {
    return NextResponse.json(
      { ok: true, message: 'No pending terms to accept', accepted: 0 },
      { headers: NO_STORE_HEADERS },
    );
  }

  const now = nowISO();
  let acceptedCount = 0;
  let skippedDuplicates = 0;
  const categoriesModified = new Set<PromptCategory>();

  // Per-category buckets of accepted terms (for export)
  const acceptedByCategory: Partial<Record<PromptCategory, string[]>> = {};

  // Invalidate vocab cache before Layer 3 checks (get fresh data)
  invalidateVocabCache();

  for (const sub of pending) {
    // Layer 3 dedup: re-check vocab right before accepting
    const alreadyExists = termExistsInCategory(sub.term, sub.category);

    if (alreadyExists) {
      // Term appeared in vocab between review and accept (race condition)
      sub.status = 'accepted' as SubmissionStatus;
      sub.acceptedAt = now;
      data.stats.pending = Math.max(0, data.stats.pending - 1);
      data.stats.accepted += 1;
      skippedDuplicates += 1;
      continue;
    }

    // Accept this term
    sub.status = 'accepted' as SubmissionStatus;
    sub.acceptedAt = now;
    data.stats.pending = Math.max(0, data.stats.pending - 1);
    data.stats.accepted += 1;
    acceptedCount += 1;

    // Add to primary category bucket
    if (!acceptedByCategory[sub.category]) {
      acceptedByCategory[sub.category] = [];
    }
    acceptedByCategory[sub.category]!.push(sub.term);
    categoriesModified.add(sub.category);

    // Add to suggested categories (smart category suggestion)
    for (const suggested of sub.suggestedCategories) {
      if (suggested === sub.category) continue; // Already added above

      // Check this category too (Layer 3)
      if (termExistsInCategory(sub.term, suggested)) continue;

      if (!acceptedByCategory[suggested]) {
        acceptedByCategory[suggested] = [];
      }
      acceptedByCategory[suggested]!.push(sub.term);
      categoriesModified.add(suggested);
    }
  }

  data.lastBatchAt = now;
  updateDailyGrowth(data.dailyGrowth, 'accepted', acceptedCount);

  await saveSubmissions(data);

  const response: VocabAcceptBatchResponse = {
    accepted: acceptedCount,
    categoriesModified: Array.from(categoriesModified),
    skippedDuplicates,
    batchedAt: now,
  };

  return NextResponse.json(
    {
      ok: true,
      message: `Accepted ${acceptedCount} term${acceptedCount !== 1 ? 's' : ''} across ${categoriesModified.size} categor${categoriesModified.size !== 1 ? 'ies' : 'y'}${skippedDuplicates > 0 ? ` (${skippedDuplicates} skipped as duplicates)` : ''}`,
      ...response,
      acceptedByCategory,
    },
    { headers: NO_STORE_HEADERS },
  );
}

/**
 * Rescue false positives from the auto-filter.
 * Moves filtered submissions into the pending queue.
 */
async function handleRescue(
  data: VocabSubmissionsFile,
  ids: string[],
): Promise<NextResponse> {
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'Missing or empty ids array' },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  let rescuedCount = 0;

  for (const id of ids) {
    const filterIdx = data.filtered.findIndex((f) => f.id === id);
    if (filterIdx === -1) continue;

    const filtered = data.filtered[filterIdx];
    if (!filtered) continue;

    // Move from filtered to submissions as a new pending entry
    const submission: VocabSubmission = {
      id: uuid(),
      term: filtered.term,
      category: filtered.category,
      suggestedCategories: suggestCategories(filtered.term, filtered.category),
      platformIds: [],
      tier: 1, // Default — no platform context from filtered entries
      count: 1,
      uniqueSessions: 1,
      sessionIds: [],
      confidence: 'low',
      status: 'pending',
      submittedAt: filtered.filteredAt,
      acceptedAt: null,
      rejectedAt: null,
    };

    data.submissions.push(submission);
    data.filtered.splice(filterIdx, 1);
    data.stats.autoFiltered = Math.max(0, data.stats.autoFiltered - 1);
    data.stats.pending += 1;
    rescuedCount += 1;
  }

  await saveSubmissions(data);

  return NextResponse.json(
    {
      ok: true,
      message: `Rescued ${rescuedCount} term${rescuedCount !== 1 ? 's' : ''} from auto-filter`,
      rescuedCount,
    },
    { headers: NO_STORE_HEADERS },
  );
}

// ============================================================================
// REASSIGN CATEGORY (Phase 7.7 Part 7 — Bulk Category Reassignment)
// ============================================================================

/**
 * Reassign a single submission to a different primary category.
 *
 * Updates `category` and re-runs `suggestCategories` so the batch-accept
 * flow sends the term to the correct vocabulary files.
 *
 * Admin clicked a category badge → picked a different category from the popover.
 */
async function handleReassignCategory(
  data: VocabSubmissionsFile,
  id: string,
  newCategory: string,
): Promise<NextResponse> {
  if (!id || typeof id !== 'string') {
    return NextResponse.json(
      { ok: false, error: 'Missing or invalid id' },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  // Validate the new category
  if (
    !newCategory ||
    typeof newCategory !== 'string' ||
    !CATEGORY_ORDER.includes(newCategory as PromptCategory)
  ) {
    return NextResponse.json(
      { ok: false, error: `Invalid category: ${String(newCategory)}` },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const typedCategory = newCategory as PromptCategory;
  const submission = data.submissions.find((s) => s.id === id);

  if (!submission) {
    return NextResponse.json(
      { ok: false, error: `Submission not found: ${id}` },
      { status: 404, headers: NO_STORE_HEADERS },
    );
  }

  const oldCategory = submission.category;
  submission.category = typedCategory;

  // Re-run smart category suggestion with the new primary category
  submission.suggestedCategories = suggestCategories(
    submission.term,
    typedCategory,
  );

  await saveSubmissions(data);

  return NextResponse.json(
    {
      ok: true,
      message: `Reassigned "${submission.term}" from ${oldCategory} → ${typedCategory}`,
      id: submission.id,
      oldCategory,
      newCategory: typedCategory,
      suggestedCategories: submission.suggestedCategories,
    },
    { headers: NO_STORE_HEADERS },
  );
}

// ============================================================================
// OVERRIDE CONFIDENCE (Phase 7.7 — Confidence Override)
// ============================================================================

const VALID_CONFIDENCE_LEVELS: ConfidenceLevel[] = ['high', 'medium', 'low'];

/**
 * Manually override a submission's confidence level.
 *
 * Admin clicked the confidence badge → cycled to a new level.
 * This lets the admin promote genuinely useful low-confidence terms
 * or demote suspicious high-confidence ones.
 */
async function handleOverrideConfidence(
  data: VocabSubmissionsFile,
  id: string,
  newConfidence: string,
): Promise<NextResponse> {
  if (!id || typeof id !== 'string') {
    return NextResponse.json(
      { ok: false, error: 'Missing or invalid id' },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  if (
    !newConfidence ||
    typeof newConfidence !== 'string' ||
    !VALID_CONFIDENCE_LEVELS.includes(newConfidence as ConfidenceLevel)
  ) {
    return NextResponse.json(
      { ok: false, error: `Invalid confidence level: ${String(newConfidence)}` },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const typedConfidence = newConfidence as ConfidenceLevel;
  const submission = data.submissions.find((s) => s.id === id);

  if (!submission) {
    return NextResponse.json(
      { ok: false, error: `Submission not found: ${id}` },
      { status: 404, headers: NO_STORE_HEADERS },
    );
  }

  const oldConfidence = submission.confidence;
  submission.confidence = typedConfidence;

  await saveSubmissions(data);

  return NextResponse.json(
    {
      ok: true,
      message: `Confidence for "${submission.term}": ${oldConfidence} → ${typedConfidence}`,
      id: submission.id,
      oldConfidence,
      newConfidence: typedConfidence,
    },
    { headers: NO_STORE_HEADERS },
  );
}
