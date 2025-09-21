// src/lib/requireAdmin.ts
import type { NextRequest } from 'next/server';

type AdminCheck = {
  ok: boolean;
  reason?: string;
};

/**
 * Default export – used by API routes. Throws on failure.
 * - Checks bearer token in Authorization header against env ADMIN_BEARER_TOKEN
 * - Optionally enforces an allowlist of IPs via ADMIN_IP_ALLOWLIST (comma-separated)
 */
export default async function requireAdmin(req: NextRequest): Promise<void> {
  const check = await isAdmin(req);
  if (!check.ok) {
    throw new Error(check.reason || 'unauthorized');
  }
}

/**
 * Named util in case you ever want a boolean check.
 */
export async function isAdmin(req: NextRequest): Promise<AdminCheck> {
  // 1) Bearer token
  const header = req.headers.get('authorization') || '';
  const token = header.match(/^Bearer\s+(.+)$/i)?.[1] ?? '';
  const envToken = process.env.ADMIN_BEARER_TOKEN?.trim() || '';

  if (!envToken || token !== envToken) {
    return { ok: false, reason: 'invalid token' };
  }

  // 2) Optional IP allowlist
  const allowlistRaw = process.env.ADMIN_IP_ALLOWLIST?.trim();
  if (allowlistRaw) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
      || (req as any).ip /* some runtimes */ || '127.0.0.1';

    const allowed = allowlistRaw.split(',').map(s => s.trim()).filter(Boolean);
    if (allowed.length && !allowed.includes(ip)) {
      return { ok: false, reason: `ip ${ip} not allowed` };
    }
  }

  return { ok: true };
}
