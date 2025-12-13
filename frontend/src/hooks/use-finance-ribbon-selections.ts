// src/hooks/use-finance-ribbon-selections.ts
// -----------------------------------------------------------------------------
// Single hook that encapsulates the FX–7–5 selection logic for the finance ribbon.
// (FX count is SSOT-driven via src/data/fx/fx.pairs.json.)
// - Knows whether the user is on a paid plan (via usePlan).
// - Reads stored selections from localStorage (FX / Commodities / Crypto).
// - Calls the pure helpers in src/lib/ribbon/selection.ts.
// - Exposes prompt messages like “Choose N FX pairs to continue.”
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
  type CommoditySelectionResult,
  type SelectionResult,
} from '@/lib/ribbon/selection';

import { usePlan } from '@/hooks/usePlan';

import { loadUserFxSelections, saveUserFxSelections } from '@/lib/state/fx-selections';

import {
  loadUserCommoditySelections,
  saveUserCommoditySelections,
} from '@/lib/state/commodity-selections';

import { loadUserCryptoSelections, saveUserCryptoSelections } from '@/lib/state/crypto-selections';

import type { CommodityId, CryptoAsset, CryptoId, FxPair, FxPairId } from '@/types/finance-ribbon';

export type FxSelectionViewModel = {
  selection: SelectionResult<FxPair, FxPairId>;
  /**
   * Non-null when the paid selection is missing / invalid and we fell back to free.
   * Used to nudge the user in the UI.
   */
  promptMessage: string | null;
};

export type CommoditiesSelectionViewModel = {
  selection: CommoditySelectionResult;
  /** Non-null when the paid selection is missing / invalid and we fell back to free. */
  promptMessage: string | null;
};

export type CryptoSelectionViewModel = {
  selection: SelectionResult<CryptoAsset, CryptoId>;
  /** Non-null when we want to nudge the user to adjust their crypto selection. */
  promptMessage: string | null;
};

export type FinanceRibbonSelectionState = {
  fx: FxSelectionViewModel;
  commodities: CommoditiesSelectionViewModel;
  crypto: CryptoSelectionViewModel;
};

export function useFinanceRibbonSelections(): FinanceRibbonSelectionState {
  const { plan } = usePlan();

  // Plan is 'free' | 'pro' | 'enterprise'
  const isPaid = plan !== 'free';

  // ---------------------------------------------------------------------------
  // FX
  // ---------------------------------------------------------------------------

  const [fxSelection] = React.useState<FxSelectionViewModel>(() => {
    const stored = loadUserFxSelections();

    const freeSelection = getFreeFxSelection();
    const minItems = Math.max(1, freeSelection.selected.length);

    if (!isPaid || !stored || stored.length === 0) {
      return {
        selection: freeSelection,
        promptMessage: isPaid ? `Choose ${minItems} FX pairs to unlock the paid ribbon.` : null,
      };
    }

    const paidSelection = getPaidFxSelection(stored, {
      fallbackToFree: true,
      minItems,
    });

    if (paidSelection.mode === 'paid') {
      return {
        selection: paidSelection,
        promptMessage: null,
      };
    }

    return {
      selection: paidSelection,
      promptMessage: 'Your FX selection is incomplete – update it to use the paid ribbon.',
    };
  });

  React.useEffect(() => {
    if (!isPaid) return;

    const ids = fxSelection.selection.selected.map((pair) => pair.id);
    if (ids.length > 0) {
      saveUserFxSelections(ids);
    }
  }, [isPaid, fxSelection.selection]);

  // ---------------------------------------------------------------------------
  // Commodities
  // ---------------------------------------------------------------------------

  const [commoditiesSelection] = React.useState<CommoditiesSelectionViewModel>(() => {
    const stored = loadUserCommoditySelections();
    const commodityIds: CommodityId[] = stored ?? [];

    if (!isPaid || commodityIds.length === 0) {
      const freeSelection = getFreeCommodities();

      return {
        selection: freeSelection,
        promptMessage: 'Choose 7 commodities: 2 from two groups and 3 from your centre group.',
      };
    }

    const validation = validateCommoditySelection(undefined, commodityIds);

    if (validation.isValid) {
      return {
        selection: validation,
        promptMessage: null,
      };
    }

    let promptMessage =
      'Adjust your commodity selection to match the 2–3–2 pattern (2–3–2 across groups).';

    if (validation.reason === 'too-few-items') {
      promptMessage = 'Pick exactly 7 commodities to match the 2–3–2 pattern.';
    } else if (validation.reason === 'bad-distribution') {
      promptMessage = 'Spread your 7 commodities as 2–3–2 across the three groups.';
    }

    const freeSelection = getFreeCommodities();

    return {
      selection: freeSelection,
      promptMessage,
    };
  });

  React.useEffect(() => {
    if (!isPaid) return;

    const ids = commoditiesSelection.selection.selected.map((commodity) => commodity.id);

    if (ids.length > 0) {
      saveUserCommoditySelections(ids);
    }
  }, [isPaid, commoditiesSelection.selection]);

  // ---------------------------------------------------------------------------
  // Crypto
  // ---------------------------------------------------------------------------

  const [cryptoSelection] = React.useState<CryptoSelectionViewModel>(() => {
    const stored = loadUserCryptoSelections();

    if (!isPaid || !stored || stored.length === 0) {
      const freeSelection = getFreeCryptoSelection();

      return {
        selection: freeSelection,
        promptMessage: isPaid ? 'Choose 5 crypto assets to unlock the paid ribbon.' : null,
      };
    }

    const paidSelection = getPaidCryptoSelection(stored, {
      fallbackToFree: true,
      minItems: 5,
    });

    if (paidSelection.mode === 'paid') {
      return {
        selection: paidSelection,
        promptMessage: null,
      };
    }

    return {
      selection: paidSelection,
      promptMessage: 'Your crypto selection is incomplete – update it to use the paid ribbon.',
    };
  });

  React.useEffect(() => {
    if (!isPaid) return;

    const ids = cryptoSelection.selection.selected.map((asset) => asset.id);
    if (ids.length > 0) {
      saveUserCryptoSelections(ids);
    }
  }, [isPaid, cryptoSelection.selection]);

  return {
    fx: fxSelection,
    commodities: commoditiesSelection,
    crypto: cryptoSelection,
  };
}
