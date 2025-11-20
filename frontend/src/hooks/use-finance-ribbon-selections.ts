// src/hooks/use-finance-ribbon-selections.ts
// -----------------------------------------------------------------------------
// Single hook that encapsulates the 5–7–5 selection logic for the finance ribbon.
// - Knows whether the user is paid (via usePlan).
// - Reads stored selections from localStorage (FX / Commodities / Crypto).
// - Calls the pure helpers in src/lib/ribbon/selection.ts.
// - Exposes prompt messages like “Choose 5 FX pairs to continue.”
// -----------------------------------------------------------------------------

'use client';

import * as React from 'react';

import {
  getFreeFxSelection,
  getPaidFxSelection,
  getFreeCommodities,
  validateCommoditySelection,
  getFreeCryptoSelection,
  getPaidCryptoSelection,
} from '@/lib/ribbon/selection';

import commoditiesCatalog from '@/data/commodities/commodities.catalog.json';

import { usePlan } from '@/hooks/usePlan';

import { loadUserFxSelections, saveUserFxSelections } from '@/lib/state/fx-selections';
import {
  loadUserCommoditySelections,
  saveUserCommoditySelections,
} from '@/lib/state/commodity-selections';
import { loadUserCryptoSelections, saveUserCryptoSelections } from '@/lib/state/crypto-selections';

import type {
  CommodityId,
  CryptoAsset,
  CryptoId,
  FxPair,
  FxPairId,
  SelectionResult,
  CommoditySelectionValidation,
} from '@/types/finance-ribbon';

export type FxSelectionViewModel = {
  selection: SelectionResult<FxPair, FxPairId>;
  /** Non-null when we want to nudge the user to adjust their FX selection. */
  promptMessage: string | null;
};

export type CommoditiesSelectionViewModel = {
  selection: CommoditySelectionValidation;
  /** Non-null when the paid selection is missing/invalid and we fell back to free. */
  promptMessage: string | null;
};

export type CryptoSelectionViewModel = {
  selection: SelectionResult<CryptoAsset, CryptoId>;
  /** Non-null when we want to nudge the user to adjust their crypto selection. */
  promptMessage: string | null;
};

export type FinanceRibbonSelectionState = {
  /** True once we have hydrated localStorage on the client. */
  ready: boolean;
  /** Convenience flag derived from the current plan. */
  isPaid: boolean;
  fx: FxSelectionViewModel;
  commodities: CommoditiesSelectionViewModel;
  crypto: CryptoSelectionViewModel;
  /**
   * Imperative setters so picker UIs can update both state and localStorage.
   * These do not enforce “exactly 5/7” – the helpers + prompts handle that.
   */
  setFxIds: (ids: FxPairId[]) => void;
  setCommodityIds: (ids: CommodityId[]) => void;
  setCryptoIds: (ids: CryptoId[]) => void;
};

export function useFinanceRibbonSelections(): FinanceRibbonSelectionState {
  const { plan } = usePlan();
  const isPaid = plan === 'pro' || plan === 'enterprise';

  const [ready, setReady] = React.useState(false);

  const [fxIds, setFxIdsState] = React.useState<FxPairId[] | null>(null);
  const [commodityIds, setCommodityIdsState] = React.useState<CommodityId[] | null>(null);
  const [cryptoIds, setCryptoIdsState] = React.useState<CryptoId[] | null>(null);

  // Hydrate from localStorage once on the client.
  React.useEffect(() => {
    setFxIdsState(loadUserFxSelections());
    setCommodityIdsState(loadUserCommoditySelections());
    setCryptoIdsState(loadUserCryptoSelections());
    setReady(true);
  }, []);

  const setFxIds = React.useCallback((ids: FxPairId[]) => {
    setFxIdsState(ids);
    saveUserFxSelections(ids);
  }, []);

  const setCommodityIds = React.useCallback((ids: CommodityId[]) => {
    setCommodityIdsState(ids);
    saveUserCommoditySelections(ids);
  }, []);

  const setCryptoIds = React.useCallback((ids: CryptoId[]) => {
    setCryptoIdsState(ids);
    saveUserCryptoSelections(ids);
  }, []);

  // FX — 5 pairs, paid vs free + “Choose 5 to continue”.
  const fx = React.useMemo<FxSelectionViewModel>(() => {
    if (!isPaid) {
      return {
        selection: getFreeFxSelection(),
        promptMessage: null,
      };
    }

    const selection = getPaidFxSelection(fxIds ?? [], { fallbackToFree: true });

    const promptMessage =
      selection.mode === 'freeFallback'
        ? (selection.reason ?? 'Choose 5 FX pairs to continue.')
        : null;

    return { selection, promptMessage };
  }, [isPaid, fxIds]);

  // Commodities — 7 items in 2–3–2, paid vs free + “Choose 7 commodities…”.
  const commodities = React.useMemo<CommoditiesSelectionViewModel>(() => {
    const freeSelection = getFreeCommodities(commoditiesCatalog);

    if (!isPaid) {
      return {
        selection: freeSelection,
        promptMessage: null,
      };
    }

    // No stored selection yet → show free set but prompt the user.
    if (!commodityIds || commodityIds.length === 0) {
      return {
        selection: freeSelection,
        promptMessage: 'Choose 7 commodities: 2 from two groups and 3 from your centre group.',
      };
    }

    const validation = validateCommoditySelection(commoditiesCatalog, commodityIds);

    if (validation.isValid) {
      return {
        selection: validation,
        promptMessage: null,
      };
    }

    // Invalid selection → fall back to free, explain gently.
    let promptMessage = 'Adjust your commodity selection to match the 2–3–2 pattern.';

    if (validation.reason === 'too-few-items') {
      promptMessage = 'Choose 7 commodities: 2 from two groups and 3 from your centre group.';
    }

    return {
      selection: freeSelection,
      promptMessage,
    };
  }, [isPaid, commodityIds]);

  // Crypto — 5 assets, paid vs free + “Choose 5 cryptocurrencies…”.
  const crypto = React.useMemo<CryptoSelectionViewModel>(() => {
    if (!isPaid) {
      return {
        selection: getFreeCryptoSelection(),
        promptMessage: null,
      };
    }

    const selection = getPaidCryptoSelection(cryptoIds ?? [], { fallbackToFree: true });

    const promptMessage =
      selection.mode === 'freeFallback'
        ? (selection.reason ?? 'Choose 5 cryptocurrencies to continue.')
        : null;

    return { selection, promptMessage };
  }, [isPaid, cryptoIds]);

  return {
    ready,
    isPaid,
    fx,
    commodities,
    crypto,
    setFxIds,
    setCommodityIds,
    setCryptoIds,
  };
}

/* Keep both named and default exports to satisfy mixed import styles. */
export default useFinanceRibbonSelections;
