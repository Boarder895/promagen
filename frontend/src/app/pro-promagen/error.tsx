// src/app/pro-promagen/error.tsx
// ============================================================================
// PRO PROMAGEN ERROR BOUNDARY
// ============================================================================
// Error handling for the /pro-promagen route.
// Authority: docs/authority/code-standard.md §8
// ============================================================================

'use client';

import React from 'react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ProPromagenError({ error, reset }: ErrorProps) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full rounded-2xl bg-slate-900/70 ring-1 ring-white/10 p-6 text-center">
        {/* Icon */}
        <div className="text-4xl mb-4">⚠️</div>

        {/* Title */}
        <h1 className="text-lg font-semibold text-white mb-2">
          Something went wrong
        </h1>

        {/* Message */}
        <p className="text-sm text-white/50 mb-4">
          We couldn&apos;t load the Pro Promagen page. This might be a temporary issue.
        </p>

        {/* Error digest (dev only) */}
        {process.env.NODE_ENV === 'development' && error.digest && (
          <p className="text-xs text-white/30 mb-4 font-mono">
            Digest: {error.digest}
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button
            type="button"
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20 transition-colors"
          >
            Try again
          </button>
          <a
            href="/"
            className="px-4 py-2 rounded-lg bg-sky-500/20 text-sky-400 text-sm hover:bg-sky-500/30 transition-colors"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
