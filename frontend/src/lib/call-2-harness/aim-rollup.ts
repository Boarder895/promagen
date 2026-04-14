// src/lib/call-2-harness/aim-rollup.ts
// ============================================================================
// Call 2 Quality Harness — Aim Rollup Engine (Phase 1)
// ============================================================================
// Reads the aim registry + mechanical scorer results and computes the lamp
// status (BRIGHT / DIM / OUT / NOT_WIRED) for each aim and sub-aim.
//
// The rollup respects the power-on dependency map: a downstream aim cannot
// be BRIGHT if its upstream dependency is failing.
//
// Fault diagnosis uses the stage pipeline per §3.2:
//   Stage A fail → Stage D pass = code rescued GPT (prompt_failure)
//   Stage A pass → Stage D fail = code damaged it (code_enforcement_failure)
//   Stage D fail + high rescue = fragile rescue (code_enforcement_failure)
//   Movement within ±2% across runs = run_variance (noise)
//
// Authority: api-call-2-v2_1_0.md §3, §4, §5, §13
// Existing features preserved: Yes (new file).
// ============================================================================

import aimRegistryData from '@/data/call-2-aims/aim-registry.json';
import type { RuleInventoryEntry } from './inventory-writer';

// ── Types ──────────────────────────────────────────────────────────────────

export type LampStatus = 'BRIGHT' | 'DIM' | 'OUT' | 'NOT_WIRED';

/** Fault class enum from §4 */
export type FaultClass =
  | 'prompt_failure'
  | 'code_enforcement_failure'
  | 'code_enforcement_gap'
  | 'measurement_failure'
  | 'measurement_gap'
  | 'scene_definition_failure'
  | 'accepted_constraint_loss'
  | 'run_variance'
  | 'dependency_regression'
  | 'input_quality_limit';

/** Strict fix type enum from §4.2 */
export type FixType =
  | 'prompt_edit'
  | 'code_enforcer'
  | 'harness_rule'
  | 'scene_annotation'
  | 'manual_rubric'
  | 'accepted_no_action';

/** Production risk from §4.3 */
export type ProductionRisk = 'none' | 'low' | 'medium' | 'high';

export interface SubAimRollup {
  readonly sub_aim_id: string;
  readonly name: string;
  readonly description: string;
  readonly status: LampStatus;
  readonly harness_rules: readonly RuleWireStatus[];
  readonly code_enforcement: readonly CodeWireStatus[];
  readonly stage_pipeline: StagePipeline;
  readonly rescue_dependency: number;
  readonly manual_only: boolean;
  readonly fault_path: FaultPath | null;
}

export interface StagePipeline {
  readonly a_fail_rate: number;
  readonly b_fail_rate: number;
  readonly c_fail_rate: number;
  readonly d_fail_rate: number;
}

/**
 * Per-sub-aim fault diagnosis. Only populated when the sub-aim is DIM or OUT.
 * Implements §3.2 fault-finding protocol and §4.1 root cause vs symptom.
 */
export interface FaultPath {
  readonly fault_class: FaultClass;
  readonly root_cause: string;
  readonly symptom_location: string;
  readonly fix_type: FixType;
  readonly confidence: 'high' | 'medium' | 'low';
  readonly owner: string;
  readonly fix: string;
  readonly stage_diagnosis: string;
}

export interface RuleWireStatus {
  readonly rule_id: string;
  readonly status: LampStatus;
  readonly fail_rate: number;
  readonly rescue: number;
}

export interface CodeWireStatus {
  readonly function_name: string;
  readonly status: 'ACTIVE' | 'GAP' | 'PARTIAL' | 'N_A';
}

export interface AimRollup {
  readonly aim_id: string;
  readonly name: string;
  readonly level: number;
  readonly priority: string;
  readonly production_risk: ProductionRisk;
  readonly status: LampStatus;
  readonly purpose: string;
  readonly anti_aims: readonly string[];
  readonly done_definition: string;
  readonly harness_pass_line: string | null;
  readonly manual_pass_line: string | null;
  readonly hard_fail: string | null;
  readonly dependency_satisfied: boolean;
  readonly sub_aims: readonly SubAimRollup[];
  readonly harness_score: number;
  readonly wired_rule_count: number;
  readonly failing_rule_count: number;
}

export interface AimCircuitBoard {
  readonly aims: readonly AimRollup[];
  readonly fault_register: readonly FaultEntry[];
  readonly priority_fix_order: readonly string[];
  readonly summary: CircuitSummary;
}

export interface FaultEntry {
  readonly fault: string;
  readonly fault_class: FaultClass;
  readonly root_cause: string;
  readonly symptom_locations: readonly string[];
  readonly fix_type: FixType;
  readonly owner: string;
  readonly confidence: 'high' | 'medium' | 'low';
  readonly sub_aim: string;
  readonly fix: string;
  readonly production_risk: ProductionRisk;
  readonly stage_diagnosis: string;
}

export interface CircuitSummary {
  readonly bright_count: number;
  readonly dim_count: number;
  readonly out_count: number;
  readonly not_wired_count: number;
  readonly total_aims: number;
  readonly total_sub_aims: number;
  readonly total_rules_wired: number;
  readonly total_rules_failing: number;
}

// ── Registry types (matching aim-registry.json shape) ──────────────────────

interface RegistrySubAim {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly harness_rules: readonly string[];
  readonly code_enforcement: readonly string[];
  readonly prompt_rules: readonly string[];
  readonly manual_only?: boolean;
  readonly composite?: boolean;
  readonly system_level?: boolean;
  readonly not_started?: boolean;
  readonly notes?: string;
  readonly code_enforcement_status?: string;
  readonly scene_types?: readonly string[];
}

interface RegistryAim {
  readonly id: string;
  readonly name: string;
  readonly level: number;
  readonly priority: string;
  readonly production_risk: string;
  readonly depends_on: readonly string[];
  readonly purpose: string;
  readonly anti_aims: readonly string[];
  readonly done_definition: string;
  readonly harness_pass_line: string | null;
  readonly manual_pass_line: string | null;
  readonly hard_fail: string | null;
  readonly deferred?: boolean;
  readonly sub_aims: readonly RegistrySubAim[];
}

interface Registry {
  readonly aims: readonly RegistryAim[];
  readonly rule_to_aim_map: Record<string, readonly string[]>;
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Health thresholds matching rescue-dependency.ts */
const HEALTHY_THRESHOLD = 0.02;
const BORDERLINE_THRESHOLD = 0.10;

/** Rescue dependency thresholds for fault classification */
const HIGH_RESCUE_THRESHOLD = 0.50;
const MODERATE_RESCUE_THRESHOLD = 0.20;

// ── Rollup engine ──────────────────────────────────────────────────────────

const registry = aimRegistryData as unknown as Registry;

function rateToLamp(failRate: number): LampStatus {
  if (failRate <= HEALTHY_THRESHOLD) return 'BRIGHT';
  if (failRate <= BORDERLINE_THRESHOLD) return 'DIM';
  return 'OUT';
}

function toProductionRisk(raw: string): ProductionRisk {
  if (raw === 'high' || raw === 'medium' || raw === 'low' || raw === 'none') return raw;
  return 'none';
}

/**
 * Diagnose fault class from stage pipeline data per §3.2.
 *
 * The stage pipeline tells you WHERE the fault is:
 *   Stage A high fail + Stage D low fail = code rescued GPT → prompt owns it
 *   Stage A low fail + Stage D high fail = code damaged it → code owns it
 *   High rescue dependency = fragile rescue → code owns it
 *   All stages similar fail rate = no rescue happening → prompt owns it
 */
function diagnoseFault(
  pipeline: StagePipeline,
  rescueDep: number,
  hasCodeEnforcement: boolean,
): { faultClass: FaultClass; fixType: FixType; owner: string; stageDiagnosis: string; confidence: 'high' | 'medium' | 'low' } {
  const aFail = pipeline.a_fail_rate;
  const dFail = pipeline.d_fail_rate;
  const rescueGap = aFail - dFail;

  // Stage A fail → Stage D pass: code rescued GPT
  if (aFail > BORDERLINE_THRESHOLD && dFail <= HEALTHY_THRESHOLD && rescueGap > 0.05) {
    return {
      faultClass: 'prompt_failure',
      fixType: 'prompt_edit',
      owner: 'Prompt',
      stageDiagnosis: `A=${pct(aFail)} → D=${pct(dFail)}: code rescuing GPT`,
      confidence: 'high',
    };
  }

  // Stage A pass → Stage D fail: code damaged it
  if (aFail <= HEALTHY_THRESHOLD && dFail > HEALTHY_THRESHOLD) {
    return {
      faultClass: 'code_enforcement_failure',
      fixType: 'code_enforcer',
      owner: 'Code',
      stageDiagnosis: `A=${pct(aFail)} → D=${pct(dFail)}: code introducing failure`,
      confidence: 'high',
    };
  }

  // High rescue dependency: fragile — prompt failing, code compensating
  if (rescueDep > HIGH_RESCUE_THRESHOLD) {
    return {
      faultClass: 'prompt_failure',
      fixType: 'prompt_edit',
      owner: 'Prompt',
      stageDiagnosis: `rescue=${pct(rescueDep)}: high rescue dependency, structurally fragile`,
      confidence: 'high',
    };
  }

  // Code enforcement gap: no enforcer exists for this case
  if (!hasCodeEnforcement && dFail > HEALTHY_THRESHOLD) {
    return {
      faultClass: 'code_enforcement_gap',
      fixType: 'code_enforcer',
      owner: 'Code',
      stageDiagnosis: `D=${pct(dFail)}: no code enforcement exists for this rule`,
      confidence: 'medium',
    };
  }

  // Moderate rescue: prompt is weak but code is compensating partially
  if (rescueDep > MODERATE_RESCUE_THRESHOLD) {
    return {
      faultClass: 'prompt_failure',
      fixType: 'prompt_edit',
      owner: 'Prompt',
      stageDiagnosis: `rescue=${pct(rescueDep)}: moderate rescue dependency`,
      confidence: 'medium',
    };
  }

  // Low fail rate in borderline range: likely run variance
  if (dFail <= BORDERLINE_THRESHOLD && dFail > HEALTHY_THRESHOLD) {
    return {
      faultClass: 'run_variance',
      fixType: 'accepted_no_action',
      owner: 'Nobody (noise)',
      stageDiagnosis: `D=${pct(dFail)}: borderline, likely run variance`,
      confidence: 'low',
    };
  }

  // Default: prompt failure
  return {
    faultClass: 'prompt_failure',
    fixType: 'prompt_edit',
    owner: 'Prompt',
    stageDiagnosis: `A=${pct(aFail)} → D=${pct(dFail)}: prompt not producing compliant output`,
    confidence: 'medium',
  };
}

function pct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

/**
 * Roll up a single sub-aim's status from its wired harness rules.
 */
function rollUpSubAim(
  subAim: RegistrySubAim,
  byRule: Readonly<Record<string, RuleInventoryEntry>>,
): SubAimRollup {
  const isManualOnly = subAim.manual_only === true;
  const isNotStarted = subAim.not_started === true;
  const isSystemLevel = subAim.system_level === true;

  if (subAim.harness_rules.length === 0) {
    const status: LampStatus =
      isNotStarted ? 'NOT_WIRED' :
      isManualOnly ? 'NOT_WIRED' :
      isSystemLevel ? 'BRIGHT' :
      'NOT_WIRED';

    return {
      sub_aim_id: subAim.id,
      name: subAim.name,
      description: subAim.description,
      status,
      harness_rules: [],
      code_enforcement: subAim.code_enforcement.map((fn) => ({
        function_name: fn,
        status: (subAim.code_enforcement_status as 'ACTIVE' | 'GAP' | 'PARTIAL' | 'N_A') ?? 'ACTIVE',
      })),
      stage_pipeline: { a_fail_rate: 0, b_fail_rate: 0, c_fail_rate: 0, d_fail_rate: 0 },
      rescue_dependency: 0,
      manual_only: isManualOnly,
      fault_path: null,
    };
  }

  const ruleWires: RuleWireStatus[] = [];
  let worstLamp: LampStatus = 'BRIGHT';
  let totalDFailRate = 0;
  let totalAFailRate = 0;
  let totalBFailRate = 0;
  let totalCFailRate = 0;
  let totalRescue = 0;
  let wiredCount = 0;

  for (const ruleId of subAim.harness_rules) {
    const entry = byRule[ruleId];
    if (!entry) {
      ruleWires.push({ rule_id: ruleId, status: 'NOT_WIRED', fail_rate: 0, rescue: 0 });
      continue;
    }

    wiredCount += 1;
    const ruleLamp = rateToLamp(entry.stage_d_fail_rate);
    ruleWires.push({
      rule_id: ruleId,
      status: ruleLamp,
      fail_rate: entry.stage_d_fail_rate,
      rescue: entry.rescue_dependency,
    });

    totalDFailRate += entry.stage_d_fail_rate;
    totalAFailRate += entry.stage_a_fail_rate;
    totalBFailRate += entry.stage_b_fail_rate;
    totalCFailRate += entry.stage_c_fail_rate;
    totalRescue += entry.rescue_dependency;

    // Worst-case determines sub-aim status — use numeric comparison
    // to avoid TS2367 narrowing issue with string literal break patterns
    const lampSeverity: Record<LampStatus, number> = {
      'BRIGHT': 0, 'NOT_WIRED': 0, 'DIM': 1, 'OUT': 2,
    };
    if ((lampSeverity[ruleLamp] ?? 0) > (lampSeverity[worstLamp] ?? 0)) {
      worstLamp = ruleLamp;
    }
  }

  const divisor = Math.max(wiredCount, 1);
  const pipeline: StagePipeline = {
    a_fail_rate: totalAFailRate / divisor,
    b_fail_rate: totalBFailRate / divisor,
    c_fail_rate: totalCFailRate / divisor,
    d_fail_rate: totalDFailRate / divisor,
  };
  const avgRescue = totalRescue / divisor;
  const finalStatus: LampStatus = wiredCount === 0 ? 'NOT_WIRED' : worstLamp;

  // Build fault path if not BRIGHT
  let faultPath: FaultPath | null = null;
  if (finalStatus !== 'BRIGHT' && finalStatus !== 'NOT_WIRED') {
    const hasCodeEnforcement = subAim.code_enforcement.length > 0 &&
      subAim.code_enforcement_status !== 'GAP';
    const diagnosis = diagnoseFault(pipeline, avgRescue, hasCodeEnforcement);

    // Find the worst-performing rule for the fix description
    const worstRule = ruleWires
      .filter((r) => r.status !== 'NOT_WIRED' && r.status !== 'BRIGHT')
      .sort((a, b) => b.fail_rate - a.fail_rate)[0];

    faultPath = {
      fault_class: diagnosis.faultClass,
      root_cause: diagnosis.stageDiagnosis,
      symptom_location: subAim.id,
      fix_type: diagnosis.fixType,
      confidence: diagnosis.confidence,
      owner: diagnosis.owner,
      fix: worstRule
        ? `${diagnosis.fixType === 'prompt_edit' ? 'Prompt rule' : 'Code function'} for ${worstRule.rule_id} (${pct(worstRule.fail_rate)} fail, ${pct(worstRule.rescue)} rescue)`
        : `Investigate ${subAim.id}`,
      stage_diagnosis: diagnosis.stageDiagnosis,
    };
  }

  return {
    sub_aim_id: subAim.id,
    name: subAim.name,
    description: subAim.description,
    status: finalStatus,
    harness_rules: ruleWires,
    code_enforcement: subAim.code_enforcement.map((fn) => ({
      function_name: fn,
      status: (subAim.code_enforcement_status as 'ACTIVE' | 'GAP' | 'PARTIAL' | 'N_A') ?? 'ACTIVE',
    })),
    stage_pipeline: pipeline,
    rescue_dependency: avgRescue,
    manual_only: isManualOnly,
    fault_path: faultPath,
  };
}

/**
 * Roll up a full aim from its sub-aims. Respects dependency map.
 */
function rollUpAim(
  aim: RegistryAim,
  byRule: Readonly<Record<string, RuleInventoryEntry>>,
  aimStatuses: Map<string, LampStatus>,
): AimRollup {
  const subAimRollups = aim.sub_aims.map((sa) => rollUpSubAim(sa, byRule));

  let dependencySatisfied = true;
  for (const depId of aim.depends_on) {
    const depStatus = aimStatuses.get(depId);
    if (depStatus === 'OUT' || depStatus === undefined) {
      dependencySatisfied = false;
      break;
    }
  }

  // Determine aim status from sub-aims using numeric severity
  // (avoids TS2367 with break-based narrowing)
  const severityMap: Record<LampStatus, number> = {
    'BRIGHT': 0, 'NOT_WIRED': -1, 'DIM': 1, 'OUT': 2,
  };
  let maxSeverity = -1;
  let hasWired = false;

  for (const sa of subAimRollups) {
    if (sa.status === 'NOT_WIRED') continue;
    hasWired = true;
    const sev = severityMap[sa.status] ?? 0;
    if (sev > maxSeverity) maxSeverity = sev;
  }

  let aimStatus: LampStatus = !hasWired ? 'NOT_WIRED' :
    maxSeverity >= 2 ? 'OUT' :
    maxSeverity >= 1 ? 'DIM' : 'BRIGHT';

  if (aim.deferred === true) aimStatus = 'NOT_WIRED';

  // Dependency contamination: if upstream is OUT, cap at DIM
  if (!dependencySatisfied && aimStatus === 'BRIGHT') {
    aimStatus = 'DIM';
  }

  let wiredRuleCount = 0;
  let failingRuleCount = 0;
  for (const sa of subAimRollups) {
    for (const rw of sa.harness_rules) {
      if (rw.status !== 'NOT_WIRED') {
        wiredRuleCount += 1;
        if (rw.status !== 'BRIGHT') failingRuleCount += 1;
      }
    }
  }
  const harnessScore = wiredRuleCount > 0
    ? Math.round(((wiredRuleCount - failingRuleCount) / wiredRuleCount) * 100)
    : 0;

  return {
    aim_id: aim.id,
    name: aim.name,
    level: aim.level,
    priority: aim.priority,
    production_risk: toProductionRisk(aim.production_risk),
    status: aimStatus,
    purpose: aim.purpose,
    anti_aims: aim.anti_aims,
    done_definition: aim.done_definition,
    harness_pass_line: aim.harness_pass_line,
    manual_pass_line: aim.manual_pass_line,
    hard_fail: aim.hard_fail,
    dependency_satisfied: dependencySatisfied,
    sub_aims: subAimRollups,
    harness_score: harnessScore,
    wired_rule_count: wiredRuleCount,
    failing_rule_count: failingRuleCount,
  };
}

/**
 * Build the full aim circuit board from a harness inventory's by_rule data.
 */
export function buildAimCircuitBoard(
  byRule: Readonly<Record<string, RuleInventoryEntry>>,
): AimCircuitBoard {
  const sortedAims = [...registry.aims].sort((a, b) => {
    if (a.deferred && !b.deferred) return 1;
    if (!a.deferred && b.deferred) return -1;
    if (a.level !== b.level) return a.level - b.level;
    return a.priority.localeCompare(b.priority);
  });

  const aimStatuses = new Map<string, LampStatus>();
  const aimRollups: AimRollup[] = [];

  for (const aim of sortedAims) {
    const rollup = rollUpAim(aim, byRule, aimStatuses);
    aimStatuses.set(aim.id, rollup.status);
    aimRollups.push(rollup);
  }

  // Build fault register from sub-aim fault paths — deduplicated by root cause
  const faults: FaultEntry[] = [];
  const seenRootCauses = new Set<string>();

  for (const aim of aimRollups) {
    if (aim.status === 'BRIGHT' || aim.status === 'NOT_WIRED') continue;

    for (const sa of aim.sub_aims) {
      if (!sa.fault_path) continue;

      // Deduplicate: if the same root cause already registered, add this
      // as a symptom location to the existing entry instead of duplicating
      const rootKey = `${sa.fault_path.fault_class}:${sa.fault_path.root_cause}`;
      const existing = faults.find((f) => `${f.fault_class}:${f.root_cause}` === rootKey);

      if (existing && !seenRootCauses.has(rootKey + sa.sub_aim_id)) {
        // Add symptom location to existing entry
        (existing.symptom_locations as string[]).push(sa.sub_aim_id);
        seenRootCauses.add(rootKey + sa.sub_aim_id);
        continue;
      }

      if (seenRootCauses.has(rootKey + sa.sub_aim_id)) continue;
      seenRootCauses.add(rootKey + sa.sub_aim_id);

      faults.push({
        fault: `${sa.sub_aim_id} ${sa.name} [${sa.status}]`,
        fault_class: sa.fault_path.fault_class,
        root_cause: sa.fault_path.root_cause,
        symptom_locations: [sa.sub_aim_id],
        fix_type: sa.fault_path.fix_type,
        owner: sa.fault_path.owner,
        confidence: sa.fault_path.confidence,
        sub_aim: sa.sub_aim_id,
        fix: sa.fault_path.fix,
        production_risk: aim.production_risk,
        stage_diagnosis: sa.fault_path.stage_diagnosis,
      });
    }
  }

  // Priority fix order: high-risk P0 first, then by level, then by priority
  const riskOrder: Record<string, number> = { high: 0, medium: 1, low: 2, none: 3 };
  const failingAims = aimRollups
    .filter((a) => a.status === 'OUT' || a.status === 'DIM')
    .sort((a, b) => {
      const riskDiff = (riskOrder[a.production_risk] ?? 3) - (riskOrder[b.production_risk] ?? 3);
      if (riskDiff !== 0) return riskDiff;
      if (a.level !== b.level) return a.level - b.level;
      return a.priority.localeCompare(b.priority);
    });

  const priorityFixes = failingAims.map(
    (aim) => `${aim.aim_id}: ${aim.name} [${aim.status}] risk=${aim.production_risk} score=${aim.harness_score}`,
  );

  let bright = 0, dim = 0, out = 0, notWired = 0;
  let totalSubAims = 0, totalWired = 0, totalFailing = 0;
  for (const aim of aimRollups) {
    switch (aim.status) {
      case 'BRIGHT': bright += 1; break;
      case 'DIM': dim += 1; break;
      case 'OUT': out += 1; break;
      case 'NOT_WIRED': notWired += 1; break;
    }
    totalSubAims += aim.sub_aims.length;
    totalWired += aim.wired_rule_count;
    totalFailing += aim.failing_rule_count;
  }

  return {
    aims: aimRollups,
    fault_register: faults,
    priority_fix_order: priorityFixes,
    summary: {
      bright_count: bright,
      dim_count: dim,
      out_count: out,
      not_wired_count: notWired,
      total_aims: aimRollups.length,
      total_sub_aims: totalSubAims,
      total_rules_wired: totalWired,
      total_rules_failing: totalFailing,
    },
  };
}
