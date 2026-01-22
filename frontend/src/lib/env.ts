// frontend/src/lib/env.ts
//
// Centralised environment access (server-only).
// Rule: new server code must read env via this module (not process.env inline).
// Keep backwards-compatible keys (siteUrl/siteName/siteTagline) because other modules already import them.
//
// Pro posture (Vercel):
// - Prefer "safe mode" switches + provider kill-switches via env vars so you can react instantly from Vercel.
// - Env parsing stays permissive (mostly optional) so local dev never explodes unless a required helper is called.
//
// Updated: January 22, 2026 - Added POSTGRES_URL fallback for Neon/Vercel integration
//
// Existing features preserved: Yes.

import 'server-only';
import { z } from 'zod';

function stripTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, '');
}

function parseBool(v: unknown): boolean {
  if (v === true) return true;
  if (v === false) return false;
  if (typeof v !== 'string') return false;
  const s = v.trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).optional(),

  // Public (safe to expose)
  NEXT_PUBLIC_SITE_URL: z.string().optional(),
  NEXT_PUBLIC_SITE_NAME: z.string().optional(),
  NEXT_PUBLIC_SITE_TAGLINE: z.string().optional(),

  // Option A (Postgres + Cron)
  // DATABASE_URL is the canonical name; POSTGRES_URL is set by Vercel/Neon integration
  DATABASE_URL: z.string().optional(),
  POSTGRES_URL: z.string().optional(),
  PROMAGEN_CRON_SECRET: z.string().optional(),

  // Analytics tuning (server-only)
  PROMAGEN_USERS_WINDOW_DAYS: z.coerce.number().int().positive().max(365).optional(),
  PROMAGEN_USERS_STALE_AFTER_HOURS: z.coerce.number().int().positive().max(168).optional(),

  // Online Now (presence) tuning (server-only)
  PROMAGEN_ONLINE_WINDOW_MINUTES: z.coerce.number().int().positive().max(240).optional(),
  PROMAGEN_ONLINE_HEARTBEAT_SECONDS: z.coerce.number().int().positive().max(600).optional(),

  // Pro safety switches
  PROMAGEN_SAFE_MODE: z.string().optional(),

  // Provider kill-switches (defence in depth; WAF is first line, code is second)
  PROMAGEN_DISABLE_TWELVEDATA: z.string().optional(),

  // Provider secrets (server-only)
  TWELVEDATA_API_KEY: z.string().optional(),
});

type ParsedEnv = z.infer<typeof EnvSchema>;

function parseEnv(): ParsedEnv {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${msg}`);
  }
  return parsed.data;
}

const raw = parseEnv();

const siteUrl = stripTrailingSlashes(raw.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000');

// Resolve database URL: prefer DATABASE_URL, fall back to POSTGRES_URL (Vercel/Neon sets this)
const resolvedDatabaseUrl = raw.DATABASE_URL || raw.POSTGRES_URL || undefined;

export const env = Object.freeze({
  // Backwards-compatible keys already used by robots.ts / seo.ts
  siteUrl,
  siteName: raw.NEXT_PUBLIC_SITE_NAME ?? 'Promagen',
  siteTagline: raw.NEXT_PUBLIC_SITE_TAGLINE ?? 'AI creativity + market mood, elegantly visualised.',

  nodeEnv: raw.NODE_ENV ?? 'development',
  isProd: (raw.NODE_ENV ?? 'development') === 'production',
  isTest: (raw.NODE_ENV ?? 'development') === 'test',

  // Option A (Postgres + Cron)
  db: {
    url: resolvedDatabaseUrl,
  },
  cron: {
    secret: raw.PROMAGEN_CRON_SECRET,
  },

  // Promagen Users (30d by default) + freshness guard (48h by default)
  analytics: {
    usersWindowDays: raw.PROMAGEN_USERS_WINDOW_DAYS ?? 30,
    staleAfterHours: raw.PROMAGEN_USERS_STALE_AFTER_HOURS ?? 48,
  },

  // Online Now definition (30 minutes everywhere)
  onlineNow: {
    windowMinutes: raw.PROMAGEN_ONLINE_WINDOW_MINUTES ?? 30,
    heartbeatSeconds: raw.PROMAGEN_ONLINE_HEARTBEAT_SECONDS ?? 60,
  },

  // Pro control plane switches
  safeMode: {
    enabled: parseBool(raw.PROMAGEN_SAFE_MODE),
    disableTwelveData: parseBool(raw.PROMAGEN_DISABLE_TWELVEDATA),
  },

  // Provider secrets
  providers: {
    twelveDataApiKey: raw.TWELVEDATA_API_KEY?.trim(),
  },
});

export function requireDatabaseUrl(): string {
  const url = env.db.url;
  if (url && url.trim().length > 0) return url.trim();

  throw new Error(
    'DATABASE_URL (or POSTGRES_URL) is missing. Set it in .env for local dev and in Vercel Environment Variables for production.',
  );
}

export function requireCronSecret(): string {
  const secret = env.cron.secret;
  if (secret && secret.trim().length >= 16) return secret.trim();

  throw new Error(
    'PROMAGEN_CRON_SECRET is missing/too short. Set a strong secret (>= 16 chars) to protect cron endpoints.',
  );
}
