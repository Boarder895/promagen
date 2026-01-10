// src/components/fx/picker-toggle.tsx
// =============================================================================
// FX Picker Toggle - Modal wrapper for FX Picker
// Authority: docs/authority/paid_tier.md §5.5
// =============================================================================

'use client';

import * as React from 'react';
import { useCanAccessFxPicker } from '@/hooks/use-fx-picker';
import type { FxPairOption } from '@/hooks/use-fx-picker';

// Import createPortal with explicit type definition to avoid TS/ESM resolution issues
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createPortal } = require('react-dom') as {
  createPortal: (
    children: React.ReactNode,
    container: Element | DocumentFragment,
  ) => React.ReactPortal;
};

// =============================================================================
// Types
// =============================================================================

export interface FxPickerToggleProps {
  /** Catalog of all available pairs */
  catalog: FxPairOption[];
  /** Default pair IDs from SSOT */
  defaultPairIds: string[];
  /** Called when selection changes */
  onSelectionChange?: (pairIds: string[]) => void;
  /** Custom trigger element */
  trigger?: React.ReactNode;
}

// =============================================================================
// Lazy load the picker component
// =============================================================================

const FxPicker = React.lazy(() => import('./fx-picker'));

// =============================================================================
// Main Toggle Component
// =============================================================================

export default function FxPickerToggle({
  catalog,
  defaultPairIds,
  onSelectionChange: _onSelectionChange,
  trigger,
}: FxPickerToggleProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isMounted, setIsMounted] = React.useState(false);
  const { canAccess, isLoading, tier } = useCanAccessFxPicker();

  // Track if component is mounted (for portal)
  React.useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Close on escape key
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Lock body scroll when open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle backdrop click - only close if clicking the backdrop itself
  const handleBackdropClick = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        setIsOpen(false);
      }
    },
    [],
  );

  // Handle backdrop keyboard - only close if pressing Enter/Space on backdrop
  const handleBackdropKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        setIsOpen(false);
      }
    },
    [],
  );

  // Handle trigger click/keyboard
  const handleTriggerClick = React.useCallback(() => {
    setIsOpen(true);
  }, []);

  const handleTriggerKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
    },
    [],
  );

  // Default trigger button
  const defaultTrigger = (
    <button
      type="button"
      onClick={() => setIsOpen(true)}
      disabled={isLoading}
      className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10 disabled:opacity-50"
    >
      <span>FX Pairs</span>
      <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs">
        {defaultPairIds.length}
      </span>
      {!canAccess && tier === 'free' && (
        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-400">
          Pro
        </span>
      )}
    </button>
  );

  // Modal content
  const modalContent = isOpen ? (
    <div
      role="button"
      tabIndex={0}
      aria-label="Close modal backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={handleBackdropClick}
      onKeyDown={handleBackdropKeyDown}
    >
      <div role="dialog" aria-modal="true" className="w-full max-w-2xl">
        <React.Suspense
          fallback={
            <div className="flex h-64 items-center justify-center rounded-2xl bg-slate-900/95 ring-1 ring-white/10">
              <span className="text-white/60">Loading...</span>
            </div>
          }
        >
          <FxPicker
            catalog={catalog}
            defaultPairIds={defaultPairIds}
            onClose={() => setIsOpen(false)}
          />
        </React.Suspense>
      </div>
    </div>
  ) : null;

  return (
    <>
      {trigger ? (
        <div
          role="button"
          tabIndex={0}
          onClick={handleTriggerClick}
          onKeyDown={handleTriggerKeyDown}
        >
          {trigger}
        </div>
      ) : (
        defaultTrigger
      )}
      {isMounted && modalContent && createPortal(modalContent, document.body)}
    </>
  );
}

// =============================================================================
// Compact Toggle (for ribbon)
// =============================================================================

export function FxPickerCompactToggle({
  catalog,
  defaultPairIds,
  onSelectionChange: _onSelectionChange,
}: FxPickerToggleProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isMounted, setIsMounted] = React.useState(false);
  const { canAccess } = useCanAccessFxPicker();

  // Track if component is mounted (for portal)
  React.useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Close on escape key
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Lock body scroll when open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle backdrop click - only close if clicking the backdrop itself
  const handleBackdropClick = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        setIsOpen(false);
      }
    },
    [],
  );

  // Handle backdrop keyboard - only close if pressing Enter/Space on backdrop
  const handleBackdropKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        setIsOpen(false);
      }
    },
    [],
  );

  const modalContent = isOpen ? (
    <div
      role="button"
      tabIndex={0}
      aria-label="Close modal backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={handleBackdropClick}
      onKeyDown={handleBackdropKeyDown}
    >
      <div role="dialog" aria-modal="true" className="w-full max-w-2xl">
        <React.Suspense
          fallback={
            <div className="flex h-64 items-center justify-center rounded-2xl bg-slate-900/95 ring-1 ring-white/10">
              <span className="text-white/60">Loading...</span>
            </div>
          }
        >
          <FxPicker
            catalog={catalog}
            defaultPairIds={defaultPairIds}
            onClose={() => setIsOpen(false)}
          />
        </React.Suspense>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded p-1 hover:bg-white/10"
        title={canAccess ? 'Customize FX pairs' : 'Pro Promagen: Customize FX pairs'}
        aria-label="Open FX pair picker"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4"
        >
          <path d="M10 3.75a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5a.75.75 0 01.75-.75zM10 13.25a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5a.75.75 0 01.75-.75zM16.25 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5a.75.75 0 01.75.75zM5 10a.75.75 0 01-.75.75H2.75a.75.75 0 010-1.5h1.5A.75.75 0 015 10zM13.89 6.11a.75.75 0 010 1.06l-1.06 1.06a.75.75 0 01-1.06-1.06l1.06-1.06a.75.75 0 011.06 0zM7.17 12.83a.75.75 0 010 1.06l-1.06 1.06a.75.75 0 11-1.06-1.06l1.06-1.06a.75.75 0 011.06 0zM13.89 13.89a.75.75 0 01-1.06 0l-1.06-1.06a.75.75 0 011.06-1.06l1.06 1.06a.75.75 0 010 1.06zM7.17 7.17a.75.75 0 01-1.06 0L5.05 6.11a.75.75 0 011.06-1.06l1.06 1.06a.75.75 0 010 1.06z" />
        </svg>
      </button>
      {isMounted && modalContent && createPortal(modalContent, document.body)}
    </>
  );
}
