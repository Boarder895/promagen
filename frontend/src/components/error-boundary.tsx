"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    // No PII; safe console only
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <section role="alert" aria-live="assertive" className="m-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
          <h2 className="font-semibold">Something went wrong</h2>
          <p className="text-sm">Try reloading the page. If this continues, it’s on us.</p>
        </section>
      );
    }
    return this.props.children;
  }
}
