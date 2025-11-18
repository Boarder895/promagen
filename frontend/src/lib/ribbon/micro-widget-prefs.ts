// frontend/src/lib/ribbon/micro-widget-prefs.ts
// -----------------------------------------------------------------------------
// Finance mini-widget preferences for the Prompt Builder studio.
// Backed by versioned localStorage using the shared storage helpers.
// -----------------------------------------------------------------------------

import { KEYS } from '@/lib/storage.keys';
import { readSchema, writeSchema } from '@/lib/storage';

export type FinanceWidgetPrefs = {
  fx: boolean;
  commodities: boolean;
  crypto: boolean;
};

const STORAGE_KEY = KEYS.studio.financeWidgetsV1;
const SCHEMA_VERSION = 1;

export const DEFAULT_FINANCE_WIDGET_PREFS: FinanceWidgetPrefs = {
  fx: true,
  commodities: true,
  crypto: true,
};

/**
 * Load the user's widget visibility preferences.
 * Falls back to the default config if nothing is stored or parsing fails.
 */
export function loadFinanceWidgetPrefs(): FinanceWidgetPrefs {
  if (typeof window === 'undefined') {
    return DEFAULT_FINANCE_WIDGET_PREFS;
  }

  return readSchema<FinanceWidgetPrefs>(STORAGE_KEY, SCHEMA_VERSION, DEFAULT_FINANCE_WIDGET_PREFS);
}

/**
 * Persist the widget preferences, with a size guard built into writeSchema.
 */
export function saveFinanceWidgetPrefs(prefs: FinanceWidgetPrefs): void {
  if (typeof window === 'undefined') return;
  writeSchema<FinanceWidgetPrefs>(STORAGE_KEY, SCHEMA_VERSION, prefs);
}
