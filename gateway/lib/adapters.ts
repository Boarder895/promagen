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
   * For the FX ribbon this will typically contain a list of pairs.
   */
  params: Params | undefined;

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
