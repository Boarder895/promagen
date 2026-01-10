// src/components/fx/fx-picker.tsx
// =============================================================================
// FX Picker Component - Pro Promagen pair selection UI
// Authority: docs/authority/paid_tier.md §5.5
// =============================================================================

'use client';

import * as React from 'react';
import { useFxPicker, type FxPairOption } from '@/hooks/use-fx-picker';
import { FX_SELECTION_LIMITS, type FxSyncStatus } from '@/types/fx-selection';
import FxPairLabel from '@/components/ribbon/fx-pair-label';

// =============================================================================
// Types
// =============================================================================

export interface FxPickerProps {
  /** Catalog of all available pairs */
  catalog: FxPairOption[];
  /** Default pair IDs from SSOT */
  defaultPairIds: string[];
  /** Called when picker is closed */
  onClose?: () => void;
  /** Called when selection changes */
  onSelectionChange?: (pairIds: string[]) => void;
}

export interface FxPickerTriggerProps {
  /** Called when trigger is clicked */
  onClick: () => void;
  /** Current selection count */
  selectionCount: number;
  /** Whether user can edit */
  canEdit: boolean;
}

// =============================================================================
// Sync Status Badge
// =============================================================================

const SYNC_STATUS_CONFIG: Record<
  FxSyncStatus,
  { label: string | null; className: string }
> = {
  idle: { label: null, className: '' },
  syncing: { label: 'Syncing...', className: 'text-amber-400' },
  synced: { label: 'Saved', className: 'text-emerald-400' },
  error: { label: 'Sync error', className: 'text-red-400' },
  offline: { label: 'Offline', className: 'text-slate-400' },
};

function SyncStatusBadge({ status }: { status: FxSyncStatus }) {
  const config = SYNC_STATUS_CONFIG[status];

  // Return null if no config or no label
  if (!config || !config.label) return null;

  return (
    <span className={`text-xs ${config.className}`} role="status">
      {config.label}
    </span>
  );
}

// =============================================================================
// Pair Button
// =============================================================================

interface PairButtonProps {
  pair: FxPairOption;
  isSelected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

function PairButton({ pair, isSelected, onToggle, disabled }: PairButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={isSelected}
      className={`
        flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm
        transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400
        ${
          isSelected
            ? 'bg-sky-600/30 ring-1 ring-sky-400/50'
            : 'bg-white/5 hover:bg-white/10'
        }
        ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
      `}
    >
      <FxPairLabel
        base={pair.base}
        baseCountryCode={pair.baseCountryCode}
        quote={pair.quote}
        quoteCountryCode={pair.quoteCountryCode}
      />
      {isSelected && (
        <span className="ml-auto text-sky-400" aria-hidden="true">
          ✓
        </span>
      )}
    </button>
  );
}

// =============================================================================
// Main FX Picker Component
// =============================================================================

export default function FxPicker({
  catalog,
  defaultPairIds,
  onClose,
  onSelectionChange,
}: FxPickerProps) {
  const { state, actions, selectedPairs, searchPairs, validationErrors } = useFxPicker({
    catalog,
    defaultPairIds,
  });

  const [searchQuery, setSearchQuery] = React.useState('');
  const [showSelectedOnly, setShowSelectedOnly] = React.useState(false);

  // Filter pairs based on search and showSelectedOnly
  const filteredPairs = React.useMemo(() => {
    let pairs = searchQuery ? searchPairs(searchQuery) : catalog;
    if (showSelectedOnly) {
      const selectedIds = new Set(state.pairIds);
      pairs = pairs.filter((p) => selectedIds.has(p.id.toLowerCase()));
    }
    return pairs;
  }, [searchQuery, searchPairs, catalog, showSelectedOnly, state.pairIds]);

  // Group pairs by base currency
  const groupedPairs = React.useMemo(() => {
    const groups: Record<string, FxPairOption[]> = {};
    for (const pair of filteredPairs) {
      // TS-safe: nullish coalescing assignment ensures array exists before push
      (groups[pair.base] ??= []).push(pair);
    }
    return groups;
  }, [filteredPairs]);

  // Track if selection changed
  const prevPairIdsRef = React.useRef(state.pairIds);
  React.useEffect(() => {
    if (
      onSelectionChange &&
      JSON.stringify(prevPairIdsRef.current) !== JSON.stringify(state.pairIds)
    ) {
      onSelectionChange(state.pairIds);
      prevPairIdsRef.current = state.pairIds;
    }
  }, [state.pairIds, onSelectionChange]);

  // Handle pair toggle
  const handleToggle = React.useCallback(
    (pairId: string) => {
      const isSelected = state.pairIds.includes(pairId.toLowerCase());
      if (isSelected) {
        actions.removePair(pairId);
      } else {
        actions.addPair(pairId);
      }
    },
    [state.pairIds, actions],
  );

  // Check if at selection limit
  const atMaxLimit = state.pairIds.length >= FX_SELECTION_LIMITS.MAX_PAIRS;
  const atMinLimit = state.pairIds.length <= FX_SELECTION_LIMITS.MIN_PAIRS;

  // Render upgrade message for free users
  if (!state.canEdit) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="FX pair picker"
        className="rounded-2xl bg-slate-900/95 p-6 ring-1 ring-white/10"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">FX Pair Selection</h2>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-sm hover:bg-white/10"
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </div>

        <div className="mt-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20">
            <span className="text-2xl">🔒</span>
          </div>
          <h3 className="text-lg font-medium">Pro Promagen Feature</h3>
          <p className="mt-2 text-sm text-white/70">
            Customize your FX ribbon with up to {FX_SELECTION_LIMITS.MAX_PAIRS} pairs from
            our catalog of {catalog.length}+ currency pairs.
          </p>
          <button
            type="button"
            className="mt-4 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-2 font-medium text-white hover:from-amber-400 hover:to-orange-400"
          >
            Upgrade to Pro Promagen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="FX pair picker"
      className="flex max-h-[80vh] flex-col rounded-2xl bg-slate-900/95 ring-1 ring-white/10"
    >
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 p-4">
        <div>
          <h2 className="text-lg font-medium">Select FX Pairs</h2>
          <p className="mt-0.5 text-sm text-white/60">
            {state.pairIds.length} / {FX_SELECTION_LIMITS.MAX_PAIRS} selected
            {state.pairIds.length < FX_SELECTION_LIMITS.MIN_PAIRS && (
              <span className="ml-2 text-amber-400">
                (min {FX_SELECTION_LIMITS.MIN_PAIRS})
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SyncStatusBadge status={state.syncStatus} />
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-sm hover:bg-white/10"
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </div>
      </header>

      {/* Search and filters */}
      <div className="shrink-0 border-b border-white/10 p-4">
        <input
          type="search"
          placeholder="Search pairs (e.g. EUR, USD, JPY)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg bg-white/5 px-4 py-2 text-sm placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-sky-400"
        />
        <div className="mt-3 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={showSelectedOnly}
              onChange={(e) => setShowSelectedOnly(e.target.checked)}
              className="rounded border-white/30 bg-white/5"
            />
            Show selected only
          </label>
          <button
            type="button"
            onClick={actions.resetToDefault}
            className="text-sm text-white/60 hover:text-white"
          >
            Reset to defaults
          </button>
        </div>
      </div>

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div className="shrink-0 border-b border-red-500/30 bg-red-500/10 p-3">
          <ul className="list-inside list-disc text-sm text-red-400">
            {validationErrors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Pair grid */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30">
        {Object.entries(groupedPairs).map(([baseCurrency, pairs]) => (
          <div key={baseCurrency} className="mb-4">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-white/50">
              {baseCurrency}
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {pairs.map((pair) => {
                const isSelected = state.pairIds.includes(pair.id.toLowerCase());
                const canAdd = !isSelected && !atMaxLimit;
                const canRemove = isSelected && !atMinLimit;

                return (
                  <PairButton
                    key={pair.id}
                    pair={pair}
                    isSelected={isSelected}
                    onToggle={() => handleToggle(pair.id)}
                    disabled={isSelected ? !canRemove : !canAdd}
                  />
                );
              })}
            </div>
          </div>
        ))}

        {filteredPairs.length === 0 && (
          <p className="py-8 text-center text-sm text-white/50">
            No pairs match your search
          </p>
        )}
      </div>

      {/* Footer */}
      <footer className="shrink-0 border-t border-white/10 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-white/60">
            {selectedPairs.length} pair{selectedPairs.length !== 1 ? 's' : ''} selected
          </p>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium hover:bg-sky-500"
            >
              Done
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

// =============================================================================
// Trigger Button Export
// =============================================================================

export function FxPickerTrigger({ onClick, selectionCount, canEdit }: FxPickerTriggerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
    >
      <span>FX Pairs</span>
      <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs">{selectionCount}</span>
      {!canEdit && (
        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-400">
          Pro
        </span>
      )}
    </button>
  );
}
