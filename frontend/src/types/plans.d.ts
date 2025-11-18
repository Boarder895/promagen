// src/types/plans.d.ts

export type PlanId = 'guest' | 'free' | 'pro';

export type DataFreshnessInterval = string; // e.g. "6h", "15m", "5m"

export interface PlanDataFreshnessConfig {
  fx: DataFreshnessInterval;
  commodities: DataFreshnessInterval;
  crypto: DataFreshnessInterval;
  exchanges: DataFreshnessInterval;
}

export type ExchangeAlignmentMode = 'global-default' | 'user-location';

export type StudioAccessMode = 'none' | 'full';

export interface PlanRibbonConfig {
  showFullRibbon: boolean;
  showMiniWidgetsInStudio: boolean;
}

export interface PlanExchangesConfig {
  alignment: ExchangeAlignmentMode;
  usesUserLocation: boolean;
}

export interface PlanStudioConfig {
  /**
   * Whether the prompt builder is available.
   * - "none"  → no access
   * - "full"  → full UI available
   */
  access: StudioAccessMode;

  /**
   * Monthly prompt limit. Use `null` to represent
   * "unlimited" or a very high fair-use cap.
   */
  monthlyPromptLimit: number | null;

  /**
   * Whether to show a remaining prompts counter in the UI.
   */
  showPromptCounter: boolean;

  /**
   * Whether "Open in [Provider]" affiliate links are enabled.
   */
  allowOpenInProvider: boolean;
}

export interface PlanUpgradeHintsConfig {
  /**
   * Whether to show upgrade hints on the homepage
   * (e.g. under the ribbon).
   */
  showOnHomepage: boolean;

  /**
   * Whether to show upgrade hints inside the studio
   * (prompt builder).
   */
  showInStudio: boolean;
}

export interface PlanConfig {
  id: PlanId;
  label: string;
  description: string;
  dataFreshness: PlanDataFreshnessConfig;
  ribbon: PlanRibbonConfig;
  exchanges: PlanExchangesConfig;
  studio: PlanStudioConfig;
  upgradeHints: PlanUpgradeHintsConfig;
}

/**
 * Mapping of plan id → configuration.
 */
export type PlanMatrix = Record<PlanId, PlanConfig>;
