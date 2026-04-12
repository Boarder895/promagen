// src/lib/call-2-harness/mechanical-scorer/types.ts
// ============================================================================
// Call 2 Quality Harness — Mechanical Scorer Types (Phase C)
// ============================================================================
// Canonical types and the cluster-schema-v1 taxonomy from architecture §10.1.
//
// Authority: call-2-quality-architecture-v0.3.1.md §10.1, §11
// Existing features preserved: Yes (this is a new module).
// ============================================================================

/**
 * The eight failure-mode clusters from architecture §10.1 (cluster-schema-v1).
 * This taxonomy is FROZEN at v1. Future schema versions can split or extend
 * but never silently retire — see architecture §10.4.
 */
export type Cluster =
  | 'subject_salience_loss'
  | 'interaction_flattening'
  | 'paraphrase_echo_collapse'
  | 'syntax_leak'
  | 'negative_handling_leak'
  | 'value_add_filler'
  | 'tier_drift'
  | 'constraint_collision'
  | 'content_fidelity_loss';

export const ALL_CLUSTERS: readonly Cluster[] = Object.freeze([
  'subject_salience_loss',
  'interaction_flattening',
  'paraphrase_echo_collapse',
  'syntax_leak',
  'negative_handling_leak',
  'value_add_filler',
  'tier_drift',
  'constraint_collision',
  'content_fidelity_loss',
]);

export const CLUSTER_SCHEMA_VERSION = 'v2' as const;

export type Tier = 1 | 2 | 3 | 4;

/**
 * The four route stages from architecture §11.1.
 * a = raw model output, b = post-processed, c = compliance-enforced, d = final.
 */
export type StageId = 'a' | 'b' | 'c' | 'd';

/**
 * Provider context — drives provider-aware rules (e.g. T1 weight syntax).
 * Mirror of the route's ProviderContext, kept local to avoid coupling.
 */
export interface ProviderContext {
  readonly weightingSyntax?: string;
  readonly supportsWeighting?: boolean;
  readonly providerName?: string;
  readonly tier?: number;
}

/**
 * Per-rule run context. `input` is the original user message — required by
 * echo-detection rules that compare T3/T4 first-8-words against the input.
 */
export interface RuleContext {
  readonly input: string;
  readonly providerContext?: ProviderContext;
  readonly expectedElements?: readonly string[];
}

/**
 * The four-tier output bundle (matches the dev endpoint Stage A/B/C/D shape).
 *
 * Note on readonly: the tier1/tier2/tier3/tier4 fields are intentionally
 * NOT marked readonly so test fixtures can construct variants by reassigning
 * one tier object on a baseline. The inner positive/negative fields remain
 * readonly — once a tier object is built, its strings are immutable.
 */
export interface TierBundle {
  tier1: { readonly positive: string; readonly negative: string };
  tier2: { readonly positive: string; readonly negative: string };
  tier3: { readonly positive: string; readonly negative: string };
  tier4: { readonly positive: string; readonly negative: string };
}

/**
 * Output of a single rule check. The coordinator stamps tier+cluster from
 * the rule definition so individual rule functions don't repeat themselves.
 */
export interface RuleCheckOutput {
  readonly passed: boolean;
  readonly details?: string;
}

/**
 * A rule definition: ID, tier, primary cluster, description, and the check
 * function. The check function is pure: same inputs → same output.
 */
export interface RuleDefinition {
  readonly id: string;
  readonly tier: Tier;
  readonly cluster: Cluster;
  readonly description: string;
  check(bundle: TierBundle, ctx: RuleContext): RuleCheckOutput;
}

/**
 * Per-rule result tagged with tier+cluster (stamped by the coordinator).
 */
export interface RuleResult {
  readonly ruleId: string;
  readonly tier: Tier;
  readonly cluster: Cluster;
  readonly passed: boolean;
  readonly details?: string;
}

/**
 * Output of one full mechanical-scorer run against one route stage.
 * `failsByCluster` is the per-cluster fail count — feeds Phase G clustering.
 */
export interface MechanicalResult {
  readonly stage: StageId;
  readonly results: readonly RuleResult[];
  readonly passCount: number;
  readonly failCount: number;
  readonly totalRules: number;
  readonly failsByCluster: Readonly<Record<Cluster, number>>;
  readonly clusterSchemaVersion: typeof CLUSTER_SCHEMA_VERSION;
}
