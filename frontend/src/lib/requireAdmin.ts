import type { NextRequest } from "next/server";

/** Constant-time compare to limit timing leaks. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function getExpectedKey(): string {
  return (
    process.env.ADMIN_KEY ||
    process.env.ADMIN_TOKEN ||
    process.env.X_ADMIN_KEY ||
    ""
  );
}

/** Extract admin key from header, bearer token, or cookie. */
function extractAdminKey(req: NextRequest): string | null {
  const hdr = req.headers.get("x-admin-key");
  if (hdr) return hdr.trim();

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice("Bearer ".length).trim();

  const cookie =
    req.cookies.get("x-admin-key")?.value ||
    req.cookies.get("admin_key")?.value ||
    null;

  return cookie ? cookie.trim() : null;
}

/** Same-origin check (Origin/Referer must match current host). */
export function checkSameOrigin(req: NextRequest): boolean {
  const host = req.headers.get("host");
  if (!host) return false;

  const http = `http://${host}`;
  const https = `https://${host}`;

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  const okOrigin = !origin || origin === http || origin === https;
  const okReferer = !referer || referer.startsWith(http) || referer.startsWith(https);

  return okOrigin && okReferer;
}

/** Very small IPv4 allow-list: ADMIN_IP_ALLOWLIST=127.0.0.1,10.0.0.0/8 */
function ipAllowed(ip: string | null): boolean {
  const list = (process.env.ADMIN_IP_ALLOWLIST || "").trim();
  if (!list) return true; // no list => allow any
  if (!ip) return false;

  const entries = list.split(",").map((s) => s.trim()).filter(Boolean);
  for (const e of entries) {
    if (e.includes("/")) {
      const [base, bitsStr] = e.split("/");
      const bits = Number(bitsStr);
      if (!base || !Number.isFinite(bits)) continue;
      const ipN = ipv4ToInt(ip);
      const baseN = ipv4ToInt(base);
      if (ipN === null || baseN === null) continue;
      const mask = bits === 0 ? 0 : ~((1 << (32 - bits)) - 1) >>> 0;
      if ((ipN & mask) === (baseN & mask)) return true;
    } else {
      if (ip === e) return true;
    }
  }
  return false;
}

function ipv4ToInt(x: string): number | null {
  const m = x.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  const p = m.slice(1).map((v) => Number(v));
  if (p.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return null;
  return ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0;
}

function clientIp(req: NextRequest): string | null {
  const xfwd = req.headers.get("x-forwarded-for");
  if (xfwd) return xfwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
}

export type AdminCheckResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/**
 * Unified admin check:
 *  - same-origin (unless ADMIN_ALLOW_CROSS_ORIGIN=1)
 *  - IP allow-list (ADMIN_IP_ALLOWLIST)
 *  - token in x-admin-key / Bearer / cookie equals ADMIN_KEY
 */
export async function requireAdmin(req: NextRequest): Promise<AdminCheckResult> {
  const allowCross = process.env.ADMIN_ALLOW_CROSS_ORIGIN === "1";
  if (!allowCross && !checkSameOrigin(req)) {
    return { ok: false, status: 403, error: "forbidden: cross-origin" };
  }

  const ip = clientIp(req);
  if (!ipAllowed(ip)) {
    return { ok: false, status: 403, error: "forbidden: ip" };
  }

  const expected = getExpectedKey();
  if (!expected) {
    return { ok: false, status: 500, error: "server-misconfig: ADMIN_KEY" };
  }

  const provided = extractAdminKey(req);
  if (!provided || !safeEqual(provided, expected)) {
    return { ok: false, status: 403, error: "forbidden: admin-key" };
  }

  return { ok: true };
}

/** Small wrapper to guard route handlers. */
export function withAdminGuard<
  H extends (req: NextRequest) => Promise<Response> | Response
>(handler: H) {
  return async (req: NextRequest) => {
    const check = await requireAdmin(req);
    if (!check.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: check.error }),
        { status: check.status, headers: { "content-type": "application/json" } }
      );
    }
    return handler(req);
  };
}
