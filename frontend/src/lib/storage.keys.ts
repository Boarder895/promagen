// frontend/src/lib/storage.keys.ts
// -----------------------------------------------------------------------------
// Single source of truth for localStorage keys (versioned, namespaced).
// SSR-safe helpers with no I/O at module top-level.
// -----------------------------------------------------------------------------

export const KEYS = {
  providers: {
    /** Stores the last visited provider id (string) under schema v1. */
    lastV1: 'promagen.providers.last.v1',
  },
  ux: {
    /** Stores user's preference to return to the last provider on entry. */
    returnToLastOptInV1: 'promagen.ux.returnToLast.optIn.v1',
  },
  user: {
    /**
     * Lightweight client-side hint of the current plan ("free" | "paid").
     * Real source of truth will eventually be your auth/session layer.
     */
    planV1: 'promagen.user.plan.v1',
  },
} as const;

/** Legacy keys retained solely for forward migration. */
export const LEGACY_LAST_PROVIDER_KEYS = [
  'promagen.lastProvider',
  'promagen.lastProviderAt',
] as const;

// Tiny SSR-safe helpers
export function getLocal(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setLocal(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* noop */
  }
}
