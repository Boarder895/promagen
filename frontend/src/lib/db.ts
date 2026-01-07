// frontend/src/lib/db.ts
//
// Postgres client (server-only), used for Option A (Postgres + Cron).
// Design goals:
// - Never read process.env outside src/lib/env.ts (we use env + requireDatabaseUrl()).
// - Lazy initialisation (tests/dev pages that don't touch DB shouldn't crash).
// - Safe singleton reuse in dev/HMR (avoid creating many connections).
// - Provide small helpers for transactions + health checks.

import 'server-only';

import postgres from 'postgres';

import { env, requireDatabaseUrl } from '@/lib/env';

/**
 * We do not provide a typed DB schema here (API-free edition), so use an empty schema record.
 * Avoid `{}` (eslint: no-empty-object-type) which means "any non-nullish value" in TS.
 */
export type SqlClient = postgres.Sql<Record<string, never>>;

/**
 * `postgres.begin(...)` unwraps tuple/array promise elements.
 *
 * We mirror the upstream type's intent (rather than re-implementing a "more
 * clever" Awaited<T> variant) so TypeScript stays aligned with the library.
 */
export type TxResult<T> = T | { [K in keyof T]: T[K] extends Promise<infer R> ? R : T[K] };

function createSqlClient(): SqlClient {
  const url = requireDatabaseUrl();

  // Sensible defaults for Vercel/serverless:
  // - Keep max connections low.
  // - Enable SSL when in production (most managed Postgres requires it).
  // - Use short-ish timeouts so failures surface quickly and the UI can render blank truthfully.
  return postgres(url, {
    max: env.isProd ? 5 : 3,
    idle_timeout: 20,
    connect_timeout: 10,
    // postgres (porsager) will use TLS automatically for some URLs; we force a conservative stance in prod.
    ssl: env.isProd ? 'require' : undefined,
  });
}

/**
 * Returns a singleton Postgres client.
 * Only throws if you actually call it and DATABASE_URL is missing.
 */
export function db(): SqlClient {
  if (!globalThis.promagenSql) {
    globalThis.promagenSql = createSqlClient();
  }
  return globalThis.promagenSql;
}

/**
 * Useful for feature gating: if there is no DATABASE_URL configured, treat the pipeline as unavailable.
 */
export function hasDatabaseConfigured(): boolean {
  return Boolean(env.db.url && env.db.url.trim().length > 0);
}

/**
 * Small helper for running a function inside a transaction.
 * Uses postgres `begin()` which provides a scoped `tx` client.
 *
 * Note: The transaction client from postgres.begin() is typed as TransactionSql
 * but behaves identically to Sql for query purposes. We cast to SqlClient
 * for ergonomics since callers use the same tagged template syntax.
 */
export async function withTx<T>(fn: (tx: SqlClient) => T): Promise<TxResult<T>> {
  return db().begin((tx) => fn(tx as unknown as SqlClient));
}

/**
 * Health check for DB connectivity.
 * Returns false rather than throwing, so callers can render blank instead of crashing UI.
 */
export async function canReachDatabase(): Promise<boolean> {
  if (!hasDatabaseConfigured()) return false;

  try {
    await db()`select 1 as ok`;
    return true;
  } catch {
    return false;
  }
}

/**
 * Close the DB client (mainly for tests or one-off scripts).
 */
export async function closeDatabase(): Promise<void> {
  const sql = globalThis.promagenSql;
  if (!sql) return;

  globalThis.promagenSql = undefined;
  await sql.end({ timeout: 5 });
}
