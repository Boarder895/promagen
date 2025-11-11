// frontend/src/app/api/track-click/route.ts
/* 
  Stage-1 telemetry endpoint (console-backed).
  Merges previous "track" and "track-click" behaviour into one small, anonymous POST.
  --------------------------------------------------------------------------------
  Rules (aligned to your Code Standard):
  • No PII. Reject payloads that look like names, emails, phone numbers, addresses, etc.
  • Tiny, typed payload. Only primitives and flat objects are allowed in `props`.
  • Event fan-in: accept generic events and affiliate clicks via `event` + `props`.
  • Sampling allowed. Non-sampled requests still 204 quickly (cheap on server).
  • Clear, human English errors. 0 secrets. Predictable, lowercase path.
  • Stage-2 swap: replace console with KV/DB/analytics sink behind the TODO.
*/

import { NextResponse } from "next/server";

export const runtime = "nodejs";              // Node (console available)
export const dynamic = "force-dynamic";       // Never cache
export const preferredRegion = "auto";        // Host picks closest

// --- Types --------------------------------------------------------------------

type Primitive = string | number | boolean | null;

type TrackPayload = {
  event: string;                   // e.g., "affiliate_click", "page_view", "button_tap"
  ts?: string;                     // ISO timestamp from client; optional
  props?: Record<string, Primitive>;
};

type TrackOk = { ok: true };
type TrackErr = { ok: false; error: string };

// --- Tunables -----------------------------------------------------------------

const MAX_BODY_BYTES = 3_000;      // ~3KB cap to keep it tiny
const SAMPLE_RATE = 0.2;           // 20% sampled logging is fine at Stage-1
const ALLOWED_EVENTS = new Set<string>([
  "affiliate_click",
  "page_view",
  "ui_click",
  "ui_impression",
  "custom"
]);

// Extra validation for specific events
function validateAffiliateProps(props: Record<string, Primitive> | undefined): string | null {
  if (!props || typeof props.providerId !== "string" || props.providerId.trim().length === 0) {
    return "affiliate_click requires props.providerId (non-empty string).";
  }
  return null;
}

// --- Helpers ------------------------------------------------------------------

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype;
}

function isPrimitive(v: unknown): v is Primitive {
  const t = typeof v;
  return v === null || t === "string" || t === "number" || t === "boolean";
}

// Keep only primitives; drop nested objects/arrays and long strings
function sanitiseProps(input: unknown): Record<string, Primitive> | undefined {
  if (!isPlainObject(input)) return undefined;
  const out: Record<string, Primitive> = {};
  for (const [k, v] of Object.entries(input)) {
    if (typeof k !== "string" || k.length > 64) continue;
    if (!isPrimitive(v)) continue;
    if (typeof v === "string" && v.length > 256) continue;
    out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

// Extremely conservative PII sniffing (best-effort; errs on the side of blocking)
function containsPII(payload: TrackPayload): string | null {
  const textPool: string[] = [];
  if (typeof payload.event === "string") textPool.push(payload.event);
  if (payload.ts && typeof payload.ts === "string") textPool.push(payload.ts);

  if (payload.props) {
    for (const [k, v] of Object.entries(payload.props)) {
      if (typeof k === "string") textPool.push(k);
      if (typeof v === "string") textPool.push(v);
    }
  }

  const joined = textPool.join(" ").toLowerCase();

  // Very basic patterns: e-mail, phone-ish, address/identity hints, names
  const email = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
  const phone = /\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3}[-.\s]?\d{3,4}\b/;
  const forbiddenKeys = /\b(name|email|e-mail|phone|mobile|address|postcode|zip|ssn|ni|passport|dob|birthday)\b/;

  if (email.test(joined)) return "Looks like an email address was included.";
  if (phone.test(joined)) return "Looks like a phone number was included.";
  if (forbiddenKeys.test(joined)) return "Forbidden personal fields were included.";
  return null;
}

function pickSample(): boolean {
  // Pseudo-random sampling; don’t depend on client input
  return Math.random() < SAMPLE_RATE;
}

function bad(status: number, message: string) {
  const body: TrackErr = { ok: false, error: message };
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function good(status = 204) {
  // 204 for success with no body (cheap); tests can assert the status.
  return new NextResponse(null, {
    status,
    headers: {
      "cache-control": "no-store"
    }
  });
}

// --- Handlers -----------------------------------------------------------------

export async function POST(req: Request) {
  // 1) Size gate
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength && contentLength > MAX_BODY_BYTES) {
    return bad(413, "Payload too large.");
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return bad(400, "Body must be valid JSON.");
  }

  // 2) Shape gate
  if (!isPlainObject(json)) {
    return bad(400, "Payload must be an object.");
  }

  const payload: TrackPayload = {
    event: typeof json.event === "string" ? json.event.trim() : "",
    ts: typeof json.ts === "string" ? json.ts : undefined,
    props: sanitiseProps(json.props)
  };

  if (!payload.event) {
    return bad(400, "Missing required field: event.");
  }

  // Allow custom events, but keep a small allow-list for common ones
  if (!ALLOWED_EVENTS.has(payload.event) && !payload.event.startsWith("custom:")) {
    // Normalise to "custom:xyz" if caller sent a free-form event
    payload.event = `custom:${payload.event}`;
  }

  // 3) Event-specific validation
  if (payload.event === "affiliate_click") {
    const err = validateAffiliateProps(payload.props);
    if (err) return bad(400, err);
  }

  // 4) PII guard
  const pii = containsPII(payload);
  if (pii) {
    return bad(400, `Personal data not allowed. ${pii}`);
  }

  // 5) Sampling + log
  if (pickSample()) {
    // Do NOT log request headers/IPs. Keep it anonymous.
    // Replace this block with your KV/DB/analytics sink at Stage-2.
    // eslint-disable-next-line no-console
    console.log("[telemetry]", {
      event: payload.event,
      ts: payload.ts ?? new Date().toISOString(),
      props: payload.props ?? {}
    });
  }

  // 6) Done
  return good(204);
}

export function GET() {
  // No listing; keep surface area tiny.
  return bad(405, "Method not allowed. Use POST.");
}

export function PUT() {
  return bad(405, "Method not allowed. Use POST.");
}

export function PATCH() {
  return bad(405, "Method not allowed. Use POST.");
}

export function DELETE() {
  return bad(405, "Method not allowed. Use POST.");
}

export function OPTIONS() {
  // Same-origin by default; minimal CORS preflight support if needed later.
  return new NextResponse(null, {
    status: 204,
    headers: {
      "cache-control": "no-store",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "access-control-max-age": "600"
    }
  });
}
