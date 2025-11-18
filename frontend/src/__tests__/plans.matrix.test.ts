// src/__tests__/plans.matrix.test.ts

import plansMatrixJson from '@/data/plans/plans.matrix.json';
import type { PlanId, PlanConfig, PlanMatrix } from '@/types/plans.d';
import {
  getPlanConfig,
  isPro,
  isGuest,
  canUseStudio,
  getPromptLimit,
  selectPlanId,
  shouldShowUpgradeHintOnHomepage,
  shouldShowUpgradeHintInStudio,
} from '@/lib/plan-matrix';

const PLAN_MATRIX = plansMatrixJson as PlanMatrix;

describe('plans.matrix.json shape', () => {
  it('contains guest, free and pro configurations', () => {
    const keys = Object.keys(PLAN_MATRIX).sort() as PlanId[];
    expect(keys).toEqual(['free', 'guest', 'pro']);
  });

  it('each plan has basic fields populated', () => {
    (Object.values(PLAN_MATRIX) as PlanConfig[]).forEach((plan) => {
      expect(plan.id).toBeDefined();
      expect(plan.label).toBeDefined();
      expect(plan.description).toBeDefined();

      expect(plan.dataFreshness.fx).toBeTruthy();
      expect(plan.dataFreshness.commodities).toBeTruthy();
      expect(plan.dataFreshness.crypto).toBeTruthy();
      expect(plan.dataFreshness.exchanges).toBeTruthy();

      expect(typeof plan.ribbon.showFullRibbon).toBe('boolean');
      expect(typeof plan.ribbon.showMiniWidgetsInStudio).toBe('boolean');

      expect(
        plan.exchanges.alignment === 'global-default' ||
          plan.exchanges.alignment === 'user-location',
      ).toBe(true);
      expect(typeof plan.exchanges.usesUserLocation).toBe('boolean');

      expect(plan.studio.access === 'none' || plan.studio.access === 'full').toBe(true);
      expect(typeof plan.studio.showPromptCounter).toBe('boolean');
      expect(typeof plan.studio.allowOpenInProvider).toBe('boolean');

      expect(typeof plan.upgradeHints.showOnHomepage).toBe('boolean');
      expect(typeof plan.upgradeHints.showInStudio).toBe('boolean');
    });
  });

  it('guest plan matches expected defaults', () => {
    const guest = PLAN_MATRIX.guest;

    expect(guest.id).toBe('guest');
    expect(guest.studio.access).toBe('none');
    expect(guest.studio.monthlyPromptLimit).toBe(0);
    expect(guest.exchanges.usesUserLocation).toBe(false);
  });

  it('free plan has 30 prompt limit and shows upgrade hints', () => {
    const free = PLAN_MATRIX.free;

    expect(free.id).toBe('free');
    expect(free.studio.access).toBe('full');
    expect(free.studio.monthlyPromptLimit).toBe(30);
    expect(free.upgradeHints.showOnHomepage).toBe(true);
    expect(free.upgradeHints.showInStudio).toBe(true);
  });

  it('pro plan uses user location and has no explicit prompt limit', () => {
    const pro = PLAN_MATRIX.pro;

    expect(pro.id).toBe('pro');
    expect(pro.studio.access).toBe('full');
    expect(pro.studio.monthlyPromptLimit).toBeNull();
    expect(pro.exchanges.alignment).toBe('user-location');
    expect(pro.exchanges.usesUserLocation).toBe(true);
  });
});

describe('plan-matrix helpers', () => {
  it('getPlanConfig returns the same config as the raw matrix', () => {
    (['guest', 'free', 'pro'] as PlanId[]).forEach((id) => {
      const raw = PLAN_MATRIX[id];
      const viaHelper = getPlanConfig(id);
      expect(viaHelper).toEqual(raw);
    });
  });

  it('isPro and isGuest behave correctly for each plan id', () => {
    expect(isGuest('guest')).toBe(true);
    expect(isGuest('free')).toBe(false);
    expect(isGuest('pro')).toBe(false);

    expect(isPro('guest')).toBe(false);
    expect(isPro('free')).toBe(false);
    expect(isPro('pro')).toBe(true);
  });

  it('canUseStudio matches the studio access field', () => {
    expect(canUseStudio('guest')).toBe(false);
    expect(canUseStudio('free')).toBe(true);
    expect(canUseStudio('pro')).toBe(true);
  });

  it('getPromptLimit returns the configured limit', () => {
    expect(getPromptLimit('guest')).toBe(0);
    expect(getPromptLimit('free')).toBe(30);
    expect(getPromptLimit('pro')).toBeNull();
  });

  it('selectPlanId derives the expected plan from auth flags', () => {
    expect(selectPlanId(false, false)).toBe('guest');
    expect(selectPlanId(true, false)).toBe('free');
    expect(selectPlanId(true, true)).toBe('pro');
  });

  it('upgrade hint helpers reflect the matrix flags', () => {
    expect(shouldShowUpgradeHintOnHomepage('guest')).toBe(false);
    expect(shouldShowUpgradeHintOnHomepage('free')).toBe(true);
    expect(shouldShowUpgradeHintOnHomepage('pro')).toBe(false);

    expect(shouldShowUpgradeHintInStudio('guest')).toBe(false);
    expect(shouldShowUpgradeHintInStudio('free')).toBe(true);
    expect(shouldShowUpgradeHintInStudio('pro')).toBe(false);
  });
});
