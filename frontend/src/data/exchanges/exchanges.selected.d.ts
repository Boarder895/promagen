// frontend/src/data/exchanges/exchanges.selected.d.ts

/**
 * Typed declaration for exchanges.selected.json
 *
 * This file makes sure imports of the JSON are strongly typed
 * instead of falling back to `any`.
 */

export type SelectedExchangeIds = {
  /**
   * Stable ids of exchanges that form the default
   * free-tier homepage set.
   */
  ids: string[];
};

declare const selected: SelectedExchangeIds;

export default selected;
