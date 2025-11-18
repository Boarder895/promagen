// src/lib/plan-matrix.ts

import plansMatrixJson from '@/data/plans/plans.matrix.json';
import type { PlanId, PlanConfig, PlanMatrix } from '@/types/plans.d';

const PLAN_MATRIX = plansMatrixJson as PlanMatrix;

/**
 * Resolve a plan config from its id.
 */
export function getPlanConfig(planId: PlanId): PlanConfig {
  return PLAN_MATRIX[planId];
}

/**
 * Convenience helpers for common checks.
 */

export function isPro(planId: PlanId): boolean {
  return planId === 'pro';
}

export function isGuest(planId: PlanId): boolean {
  return planId === 'guest';
}

export function canUseStudio(planId: PlanId): boolean {
  const plan = getPlanConfig(planId);
  return plan.studio.access === 'full';
}

export function getPromptLimit(planId: PlanId): number | null {
  const plan = getPlanConfig(planId);
  return plan.studio.monthlyPromptLimit;
}

export function shouldShowUpgradeHintOnHomepage(planId: PlanId): boolean {
  const plan = getPlanConfig(planId);
  return plan.upgradeHints.showOnHomepage;
}

export function shouldShowUpgradeHintInStudio(planId: PlanId): boolean {
  const plan = getPlanConfig(planId);
  return plan.upgradeHints.showInStudio;
}

/**
 * Decide a default plan id from auth flags.
 *
 * - Not authenticated  → "guest"
 * - Authenticated with pro flag → "pro"
 * - Authenticated without pro flag → "free"
 *
 * Call this from your auth/session layer rather than components.
 */
export function selectPlanId(isAuthenticated: boolean, hasProSubscription: boolean): PlanId {
  if (!isAuthenticated) return 'guest';
  if (hasProSubscription) return 'pro';
  return 'free';
}
