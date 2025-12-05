// gateway/lib/adapters.ts

import type { ResolvedRole } from './roles';

/**
 * Context passed into a role adapter.
 * This keeps all gateway-specific details in one place.
 */
export interface RoleAdapterContext<Params = unknown> {
  /**
   * The resolved role, including primary/backup providers and cadence.
   */
  resolvedRole: ResolvedRole;

  /**
   * Arbitrary parameters passed from the caller.
   * This lets each role stay strongly typed without leaking into the
   * generic gateway plumbing.
   */
  params: Params;

  /**
   * Wall-clock time for the current execution. Adapters should treat
   * this as the single source of truth for "now" so tests can control
   * time deterministically.
   */
  now: Date;

  /**
   * Optional cache key that higher layers may use when memoising the
   * adapter's result.
   */
  cacheKey?: string;

  /**
   * High-level request identifier used in logs.
   */
  requestId?: string;

  /**
   * Optional trace identifier for correlating logs across systems.
   */
  traceId?: string;
}

/**
 * Generic role adapter function.
 *
 * TData  = normalised payload for the role (what the gateway returns).
 * Params = parameter shape accepted by this adapter.
 */
export type RoleAdapter<TData = unknown, Params = unknown> = (
  context: RoleAdapterContext<Params>,
) => Promise<TData>;
