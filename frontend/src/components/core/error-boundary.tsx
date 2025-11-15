'use client';

import React from "react";

type Props = {
  children: React.ReactNode;
  /** Optional friendly title for the fallback UI (screen-reader safe). */
  title?: string;
  /** Optional extra content for the fallback UI (e.g. a “Try again” note). */
  hint?: React.ReactNode;
  /** Optional callback when the boundary catches an error. */
  onError?: (error: unknown, info: { componentStack: string }) => void;
  /** Optional reset action to re-render children (e.g. refetch or router.refresh). */
  onReset?: () => void;
};

/**
 * ErrorBoundary — client-only React error boundary with a calm, accessible fallback.
 */
export default class ErrorBoundary extends React.Component<
  Props,
  { hasError: boolean; error?: unknown }
> {
  state = { hasError: false as boolean, error: undefined as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: { componentStack: string }) {
    try {
      this.props.onError?.(error, info);

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("promagen:error", {
            detail: {
              message: (error as Error)?.message ?? String(error),
              stack: (error as Error)?.stack,
              componentStack: info?.componentStack,
              at: new Date().toISOString(),
            },
          }),
        );
      }

      console.error("[ErrorBoundary]", error, info?.componentStack);
    } catch {
      // swallow telemetry errors
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });

    try {
      this.props.onReset?.();
    } catch {
      console.warn("[ErrorBoundary] onReset threw");
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { title = "Something went wrong", hint } = this.props;

    return (
      <section
        aria-label={title}
        className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white/80 shadow-sm"
      >
        <h2 className="mb-2 text-sm font-semibold">{title}</h2>

        {hint ? (
          <p className="mb-3 text-sm">{hint}</p>
        ) : (
          <p className="mb-3 text-sm">
            This section did not load correctly. You can try again using the button below.
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={this.handleReset}
            className="rounded-xl bg-white/10 px-3 py-2 text-sm font-medium outline-none transition-shadow hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            Try again
          </button>

          <details className="ms-auto text-xs opacity-80">
            <summary className="cursor-pointer select-none">Details</summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-[11px] leading-tight">
              {(this.state.error as Error)?.stack ??
                String(this.state.error ?? "Unknown error")}
            </pre>
          </details>
        </div>

        <div aria-live="polite" className="sr-only">
          An error occurred in this section. You can activate “Try again” to reload it.
        </div>
      </section>
    );
  }
}
