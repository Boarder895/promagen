'use client';

import type { ErrorInfo, ReactNode } from 'react';
import { Component } from 'react';

/**
 * ChunkErrorBoundary
 *
 * Catches chunk load failures that occur when users have an old deployment's
 * JS bundles cached but the server has been updated to a new deployment.
 *
 * This is a belt-and-suspenders fallback alongside Vercel Skew Protection.
 * When a ChunkLoadError is detected, the page automatically reloads to
 * fetch the latest deployment's assets.
 *
 * @see docs/authority/best-working-practice.md § Deployment Resilience
 */

interface ChunkErrorBoundaryProps {
  children: ReactNode;
  /** Optional fallback UI shown briefly before reload (default: null) */
  fallback?: ReactNode;
}

interface ChunkErrorBoundaryState {
  hasChunkError: boolean;
}

export class ChunkErrorBoundary extends Component<
  ChunkErrorBoundaryProps,
  ChunkErrorBoundaryState
> {
  state: ChunkErrorBoundaryState = { hasChunkError: false };

  /**
   * Detects chunk load failures from various error signatures:
   * - ChunkLoadError (webpack)
   * - Failed to fetch dynamically imported module (Vite/ESM)
   * - Loading chunk X failed (webpack)
   */
  static getDerivedStateFromError(error: Error): ChunkErrorBoundaryState | null {
    const isChunkError =
      error.name === 'ChunkLoadError' ||
      error.message.includes('Loading chunk') ||
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Failed to load module script') ||
      error.message.includes('error loading dynamically imported module');

    if (isChunkError) {
      return { hasChunkError: true };
    }

    // Not a chunk error - let it propagate to other error boundaries
    return null;
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (this.state.hasChunkError) {
      // Log for observability before reload
      console.warn(
        '[ChunkErrorBoundary] Detected stale deployment, reloading page...',
        {
          error: error.message,
          componentStack: errorInfo.componentStack,
        }
      );

      // Small delay to allow console log to flush
      setTimeout(() => {
        window.location.reload();
      }, 100);
    }
  }

  render(): ReactNode {
    if (this.state.hasChunkError) {
      // Show fallback briefly before reload (or nothing by default)
      return this.props.fallback ?? null;
    }

    return this.props.children;
  }
}

export default ChunkErrorBoundary;
