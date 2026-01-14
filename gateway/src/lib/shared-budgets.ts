/**
 * Promagen Gateway - Shared Budget Managers
 * ==========================================
 * CRITICAL: TwelveData has ONE pool of 800 credits/day shared by FX + Crypto + Commodities.
 * Marketstack has a separate pool of 250 credits/day for Indices.
 * Each feed must use this SHARED manager, not create their own.
 *
 * FIXED (2026-01-13): Lazy initialization to ensure env vars are loaded before
 * creating budget managers. Previous version created instances at module load
 * time, which resulted in 0 limits if env vars weren't ready.
 *
 * @module lib/shared-budgets
 */

import { BudgetManager } from './budget.js';
import { logInfo } from './logging.js';

// =============================================================================
// LAZY INITIALIZATION
// =============================================================================

let twelveDataBudgetInstance: BudgetManager | null = null;
let marketstackBudgetInstance: BudgetManager | null = null;
let noBudgetInstance: BudgetManager | null = null;

/**
 * Get TwelveData daily limit from env or default.
 */
function getTwelveDataDailyLimit(): number {
  const val = process.env['TWELVEDATA_BUDGET_DAILY'] ??
    process.env['FX_RIBBON_BUDGET_DAILY_ALLOWANCE'] ??
    '800';
  const parsed = parseInt(val, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 800;
}

/**
 * Get TwelveData minute limit from env or default.
 */
function getTwelveDataMinuteLimit(): number {
  const val = process.env['TWELVEDATA_BUDGET_MINUTE'] ??
    process.env['FX_RIBBON_BUDGET_MINUTE_ALLOWANCE'] ??
    '8';
  const parsed = parseInt(val, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8;
}

/**
 * Get Marketstack daily limit from env or default.
 */
function getMarketstackDailyLimit(): number {
  const val = process.env['MARKETSTACK_BUDGET_DAILY'] ??
    process.env['INDICES_RIBBON_BUDGET_DAILY_ALLOWANCE'] ??
    '250';
  const parsed = parseInt(val, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 250;
}

/**
 * Get Marketstack minute limit from env or default.
 */
function getMarketstackMinuteLimit(): number {
  const val = process.env['MARKETSTACK_BUDGET_MINUTE'] ??
    process.env['INDICES_RIBBON_BUDGET_MINUTE_ALLOWANCE'] ??
    '3';
  const parsed = parseInt(val, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
}

// =============================================================================
// SHARED INSTANCES (LAZY)
// =============================================================================

/**
 * Get SHARED TwelveData budget manager.
 * Used by: FX, Crypto, Commodities (all share 800/day pool)
 */
function getTwelveDataBudget(): BudgetManager {
  if (!twelveDataBudgetInstance) {
    const dailyLimit = getTwelveDataDailyLimit();
    const minuteLimit = getTwelveDataMinuteLimit();
    
    logInfo('Creating TwelveData shared budget', {
      dailyLimit,
      minuteLimit,
    });
    
    twelveDataBudgetInstance = new BudgetManager({
      id: 'twelvedata-shared',
      dailyLimit,
      minuteLimit,
    });
  }
  return twelveDataBudgetInstance;
}

/**
 * Get SHARED Marketstack budget manager.
 * Used by: Indices only (separate 250/day pool)
 */
function getMarketstackBudget(): BudgetManager {
  if (!marketstackBudgetInstance) {
    const dailyLimit = getMarketstackDailyLimit();
    const minuteLimit = getMarketstackMinuteLimit();
    
    logInfo('Creating Marketstack shared budget', {
      dailyLimit,
      minuteLimit,
    });
    
    marketstackBudgetInstance = new BudgetManager({
      id: 'marketstack-shared',
      dailyLimit,
      minuteLimit,
    });
  }
  return marketstackBudgetInstance;
}

/**
 * Get no-op budget manager for feeds without a provider.
 */
function getNoBudget(): BudgetManager {
  if (!noBudgetInstance) {
    noBudgetInstance = new BudgetManager({
      id: 'none',
      dailyLimit: 0,
      minuteLimit: 0,
    });
  }
  return noBudgetInstance;
}

// =============================================================================
// PROVIDER LOOKUP
// =============================================================================

/**
 * Get the shared budget manager for a provider.
 * Creates the manager lazily on first access to ensure env vars are loaded.
 */
export function getSharedBudget(provider: string): BudgetManager {
  switch (provider) {
    case 'twelvedata':
      return getTwelveDataBudget();
    case 'marketstack':
      return getMarketstackBudget();
    case 'none':
      return getNoBudget();
    default:
      return getNoBudget();
  }
}

// =============================================================================
// RESET (for testing)
// =============================================================================

/**
 * Reset all shared budget instances (for testing only).
 */
export function resetSharedBudgets(): void {
  twelveDataBudgetInstance = null;
  marketstackBudgetInstance = null;
  noBudgetInstance = null;
}
