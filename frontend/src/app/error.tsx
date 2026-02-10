'use client';

/**
 * Route-level error boundary for the App Router.
 *
 * KEY DIFFERENCE from global-error.tsx:
 * - This renders INSIDE layout.tsx (so NO <html>/<body> tags here).
 * - global-error.tsx renders OUTSIDE layout.tsx and must provide its own <html>/<body>.
 *
 * Styled to match Promagen's dark theme.
 * A11y-first markup, clear recovery actions, no PII in copy.
 */

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Hook for analytics once wired (kept silent for now)
    // console.error(error);
  }, [error]);

  return (
    <main role="main" className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-white">
        Something went wrong
      </h1>
      <p className="mt-3 text-sm text-white/75">
        An unexpected error occurred. You can try again or head back to the homepage.
      </p>

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-medium text-white hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/30"
        >
          Try again
        </button>
        <a
          href="/"
          className="inline-flex items-center rounded-2xl border border-white/10 px-4 py-2 text-sm font-medium text-white hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/30"
        >
          Go to homepage
        </a>
      </div>

      {error?.digest ? (
        <p className="mt-6 text-xs text-white/50">Error reference: {error.digest}</p>
      ) : null}
    </main>
  );
}
