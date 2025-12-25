/**
 * Jest no-op for Next.js "server-only".
 *
 * In Next.js runtime, importing `server-only` from a Client Component throws.
 * In Jest we treat it as a marker with no side effects.
 */
export {};
