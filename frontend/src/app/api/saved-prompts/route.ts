// src/app/api/saved-prompts/route.ts
// ============================================================================
// SAVED PROMPTS API — List & Create (v1.0.0)
// ============================================================================
// GET  /api/saved-prompts — List all saved prompts for the authenticated user
// POST /api/saved-prompts — Create or upsert a saved prompt
//
// Security:
// - Clerk auth required (401 if not signed in)
// - Pro tier required (403 if free user)
// - Tier read from decoded session cookie (zero extra Clerk API calls)
// - Rate limiting on POST (60/min per IP)
// - Input validation + length guards in database layer
// - All DB queries scoped by userId — no cross-user access
//
// Authority: docs/authority/saved-page.md §13.2
// Existing features preserved: Yes
// ============================================================================

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSessionFromCookie } from "@/lib/stripe/clerk-session";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import {
  ensureSavedPromptsTable,
  getPromptsForUser,
  insertPrompt,
  countForUser,
  MAX_PROMPTS_PER_USER,
} from "@/lib/saved-prompts";
import type { SavedPromptInput } from "@/lib/saved-prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================================
// TABLE INIT GUARD (lazy, once per cold start)
// ============================================================================

let tableReady = false;

async function ensureTable(): Promise<void> {
  if (tableReady) return;
  await ensureSavedPromptsTable();
  tableReady = true;
}

// ============================================================================
// AUTH + TIER CHECK (shared by all handlers)
// ============================================================================

interface AuthResult {
  userId: string;
  isPaid: boolean;
}

/**
 * Extract userId and tier from the decoded session cookie.
 * Avoids route-level Clerk server API calls, which were failing in production.
 */
async function authenticate(
  request: NextRequest,
): Promise<
  { ok: true; data: AuthResult } | { ok: false; response: NextResponse }
> {
  const session = getSessionFromCookie(request);
  const userId = session?.userId ?? null;
  const tier = session?.tier ?? "free";
  const isPaid = tier === "paid";

  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unauthorized", code: "AUTH_REQUIRED" },
        { status: 401 },
      ),
    };
  }

  if (!isPaid) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            "Pro Promagen subscription required for cloud-synced prompt storage",
          code: "PRO_REQUIRED",
        },
        { status: 403 },
      ),
    };
  }

  return { ok: true, data: { userId, isPaid } };
}

// ============================================================================
// GET — List all saved prompts
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await authenticate(request);
    if (!authResult.ok) return authResult.response;
    const { userId } = authResult.data;

    await ensureTable();

    const prompts = await getPromptsForUser(userId);
    const count = prompts.length;

    return NextResponse.json({
      prompts,
      count,
      cap: MAX_PROMPTS_PER_USER,
      remaining: Math.max(0, MAX_PROMPTS_PER_USER - count),
    });
  } catch (error) {
    console.error("[saved-prompts-api] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}

// ============================================================================
// POST — Create or upsert a saved prompt
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const rl = rateLimit(request, {
      keyPrefix: "saved-prompts-write",
      windowSeconds: 60,
      max: env.isProd ? 60 : 1000,
      keyParts: ["POST"],
    });

    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: "Too many requests",
          code: "RATE_LIMITED",
          retryAfterSeconds: rl.retryAfterSeconds,
        },
        { status: 429 },
      );
    }

    const authResult = await authenticate(request);
    if (!authResult.ok) return authResult.response;
    const { userId } = authResult.data;

    await ensureTable();

    const contentType = request.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return NextResponse.json(
        {
          error: "Content-Type must be application/json",
          code: "INVALID_CONTENT_TYPE",
        },
        { status: 415 },
      );
    }

    const bodyText = await request.text();
    if (bodyText.length > 100_000) {
      return NextResponse.json(
        {
          error: "Request body too large (max 100KB)",
          code: "PAYLOAD_TOO_LARGE",
        },
        { status: 413 },
      );
    }

    let body: unknown;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body", code: "INVALID_JSON" },
        { status: 400 },
      );
    }

    if (
      typeof body !== "object" ||
      body === null ||
      !("id" in body) ||
      !("positivePrompt" in body)
    ) {
      return NextResponse.json(
        {
          error: "Missing required fields: id, positivePrompt",
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      );
    }

    const input = body as SavedPromptInput;

    const currentCount = await countForUser(userId);
    if (currentCount >= MAX_PROMPTS_PER_USER) {
      return NextResponse.json(
        {
          error: `Prompt library full (${MAX_PROMPTS_PER_USER} max). Delete some prompts to save new ones.`,
          code: "AT_CAP",
          count: currentCount,
          cap: MAX_PROMPTS_PER_USER,
        },
        { status: 409 },
      );
    }

    const result = await insertPrompt(userId, input);

    if (!result) {
      return NextResponse.json(
        { error: "Failed to save prompt", code: "INSERT_FAILED" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { prompt: result, code: "SAVED" },
      { status: 201 },
    );
  } catch (error) {
    console.error("[saved-prompts-api] POST error:", error);

    if (error instanceof Error && error.message.includes("too long")) {
      return NextResponse.json(
        { error: error.message, code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message.includes("is required")) {
      return NextResponse.json(
        { error: error.message, code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
