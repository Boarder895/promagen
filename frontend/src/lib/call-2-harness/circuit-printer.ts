/* eslint-disable no-console */
// src/lib/call-2-harness/circuit-printer.ts
// ============================================================================
// Call 2 Quality Harness — Circuit Board Printer (Phase 1)
// ============================================================================
// Prints the full aim circuit board to console after every harness run.
// Format matches api-call-2-v2_1_0.md §14 exactly.
//
// Console output is the user interface for this file. ESLint's no-console
// rule is disabled module-wide.
//
// Authority: api-call-2-v2_1_0.md §14
// Existing features preserved: Yes (new file).
// ============================================================================

import type {
  AimCircuitBoard,
  AimRollup,
  SubAimRollup,
  FaultEntry,
  LampStatus,
} from './aim-rollup';
import type { StabilityReport } from './stability-tracker';
import type { SceneClassBreakdown } from './scene-class-separator';

// ── Formatting constants ───────────────────────────────────────────────────

const DOUBLE_BAR = '═'.repeat(78);
const SINGLE_BAR = '─'.repeat(78);

const LAMP_ICONS: Record<LampStatus, string> = {
  BRIGHT: '● BRIGHT',
  DIM: '◐ DIM',
  OUT: '○ OUT',
  NOT_WIRED: '— NOT WIRED',
};

function lamp(status: LampStatus): string {
  return LAMP_ICONS[status];
}

function padRight(text: string, width: number): string {
  return text.length >= width ? text : text + ' '.repeat(width - text.length);
}

function pct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

// ── Printer ────────────────────────────────────────────────────────────────

/**
 * Print the full circuit board to console.
 *
 * Optional Phase 2 data: stability bands and scene-class breakdown.
 * When provided, these are printed as additional sections per §14.
 */
export function printCircuitBoard(
  board: AimCircuitBoard,
  version: string,
  runClass: string,
  timestamp: string,
  options?: {
    stability?: StabilityReport;
    sceneClasses?: SceneClassBreakdown;
  },
): void {
  console.log('');
  console.log(DOUBLE_BAR);
  console.log(`AIM CIRCUIT BOARD — ${version} ${runClass} — ${timestamp}`);
  console.log(DOUBLE_BAR);

  for (const aim of board.aims) {
    printAim(aim);
  }

  // ── Circuit summary ────────────────────────────────────────────────────
  console.log('');
  console.log(DOUBLE_BAR);
  console.log('CIRCUIT SUMMARY');
  console.log(DOUBLE_BAR);
  console.log('');

  console.log(
    `  ${padRight('Aim', 4)} ${padRight('Name', 44)} ${padRight('Lamp', 14)} ${padRight('Risk', 8)} ${padRight('Score', 6)} Subs`,
  );
  console.log(`  ${'-'.repeat(4)} ${'-'.repeat(44)} ${'-'.repeat(14)} ${'-'.repeat(8)} ${'-'.repeat(6)} ${'-'.repeat(5)}`);

  for (const aim of board.aims) {
    const aimNum = aim.aim_id.replace('aim_', '');
    const wiredSubs = aim.sub_aims.filter((s) => s.status !== 'NOT_WIRED').length;
    const totalSubs = aim.sub_aims.length;
    const scoreStr = aim.harness_score > 0 ? `${aim.harness_score}%` : '—';
    console.log(
      `  ${padRight(aimNum, 4)} ${padRight(aim.name, 44)} [${padRight(lamp(aim.status), 12)}] ${padRight(aim.production_risk, 8)} ${padRight(scoreStr, 6)} ${wiredSubs}/${totalSubs}`,
    );
  }

  console.log('');
  const s = board.summary;
  console.log(`  Totals: ${s.bright_count} BRIGHT, ${s.dim_count} DIM, ${s.out_count} OUT, ${s.not_wired_count} NOT WIRED`);
  console.log(`  Rules:  ${s.total_rules_wired} wired, ${s.total_rules_failing} failing`);

  // ── Power-on dependency order ──────────────────────────────────────────
  console.log('');
  console.log(DOUBLE_BAR);
  console.log('POWER-ON DEPENDENCY ORDER');
  console.log(DOUBLE_BAR);
  console.log('');

  const levels = new Map<number, AimRollup[]>();
  for (const aim of board.aims) {
    const lvl = aim.level;
    if (!levels.has(lvl)) levels.set(lvl, []);
    levels.get(lvl)!.push(aim);
  }

  const sortedLevels = [...levels.keys()].sort((a, b) => a - b);
  for (const lvl of sortedLevels) {
    const label = lvl === -1 ? 'DEFERRED' : `LEVEL ${lvl}`;
    const aims = levels.get(lvl) ?? [];
    const aimLabels = aims
      .map((a) => `${a.aim_id.replace('aim_', 'Aim ')} [${lamp(a.status)}]`)
      .join('  |  ');
    console.log(`  ${padRight(label, 12)} → ${aimLabels}`);
  }

  // ── Scene-class breakdown (Phase 2) ────────────────────────────────────
  if (options?.sceneClasses) {
    console.log('');
    console.log(DOUBLE_BAR);
    console.log('SCENE-CLASS BREAKDOWN');
    console.log(DOUBLE_BAR);
    console.log('');

    const classes = options.sceneClasses.classes;
    console.log(
      `  ${padRight('Class', 16)} ${padRight('Scenes', 8)} ${padRight('Samples', 9)} ${padRight('Fail%', 8)} ${padRight('Fails', 7)} Quality Expectation`,
    );
    console.log(`  ${'-'.repeat(16)} ${'-'.repeat(8)} ${'-'.repeat(9)} ${'-'.repeat(8)} ${'-'.repeat(7)} ${'-'.repeat(30)}`);

    for (const [className, classResult] of Object.entries(classes)) {
      console.log(
        `  ${padRight(className, 16)} ${padRight(String(classResult.scene_count), 8)} ${padRight(String(classResult.sample_count), 9)} ${padRight(pct(classResult.stage_d_fail_rate), 8)} ${padRight(String(classResult.total_rule_failures), 7)} ${classResult.quality_expectation}`,
      );
    }
  }

  // ── Stability bands (Phase 2) ──────────────────────────────────────────
  if (options?.stability) {
    console.log('');
    console.log(DOUBLE_BAR);
    console.log(`STABILITY BANDS (${options.stability.runs_analysed} runs analysed)`);
    console.log(DOUBLE_BAR);
    console.log('');

    const stab = options.stability;
    console.log(`  Stable:            ${stab.stable_count}`);
    console.log(`  Real changes:      ${stab.real_change_count}`);
    console.log(`  Insufficient data: ${stab.insufficient_data_count}`);

    // Show real changes first — these are the actionable items
    const realChanges = Object.values(stab.bands).filter((b) => b.real_change);
    if (realChanges.length > 0) {
      console.log('');
      console.log('  REAL CHANGES (outside ±2% band):');
      for (const band of realChanges) {
        const rates = band.last_runs.map((r) => pct(r)).join(' → ');
        const arrow = band.direction === 'improving' ? '↑' : band.direction === 'regressing' ? '↓' : '→';
        console.log(`    ${arrow} ${padRight(band.rule_id, 38)} ${rates}  band=${pct(band.band_width)}`);
      }
    }

    // Show unstable (wide band) rules
    const unstable = Object.values(stab.bands).filter((b) => !b.stable && !b.real_change);
    if (unstable.length > 0) {
      console.log('');
      console.log('  WIDE BANDS (±2%+ but no single-run spike):');
      for (const band of unstable.slice(0, 10)) {
        const rates = band.last_runs.map((r) => pct(r)).join(' → ');
        console.log(`    ${padRight(band.rule_id, 38)} ${rates}  band=${pct(band.band_width)}`);
      }
    }
  }

  // ── Fault register ─────────────────────────────────────────────────────
  if (board.fault_register.length > 0) {
    console.log('');
    console.log(DOUBLE_BAR);
    console.log(`FAULT REGISTER (${board.fault_register.length} faults)`);
    console.log(DOUBLE_BAR);
    console.log('');

    for (const fault of board.fault_register) {
      printFault(fault);
    }
  } else {
    console.log('');
    console.log(DOUBLE_BAR);
    console.log('FAULT REGISTER — No faults detected');
    console.log(DOUBLE_BAR);
  }

  // ── Priority fix order ─────────────────────────────────────────────────
  if (board.priority_fix_order.length > 0) {
    console.log('');
    console.log(DOUBLE_BAR);
    console.log('PRIORITY FIX ORDER');
    console.log(DOUBLE_BAR);
    console.log('');

    for (let i = 0; i < board.priority_fix_order.length; i++) {
      console.log(`  ${i + 1}. ${board.priority_fix_order[i]}`);
    }
  }

  console.log('');
  console.log(DOUBLE_BAR);
}

// ── Per-aim printer ────────────────────────────────────────────────────────

function printAim(aim: AimRollup): void {
  const aimNum = aim.aim_id.replace('aim_', '');

  console.log('');
  console.log(DOUBLE_BAR);
  console.log(
    `AIM ${aimNum} — ${aim.name}${' '.repeat(Math.max(1, 50 - aim.name.length - aimNum.length))}[${lamp(aim.status)}]`,
  );
  console.log(DOUBLE_BAR);

  console.log(`PURPOSE: ${aim.purpose}`);
  console.log(`PRODUCTION RISK: ${aim.production_risk}`);

  if (aim.anti_aims.length > 0) {
    console.log('ANTI-AIMS:');
    for (const aa of aim.anti_aims) {
      console.log(`  ✗ ${aa}`);
    }
  }

  console.log(`DONE DEFINITION: ${aim.done_definition}`);

  const passLines: string[] = [];
  if (aim.harness_pass_line) passLines.push(`Harness: ${aim.harness_pass_line}`);
  if (aim.manual_pass_line) passLines.push(`Manual: ${aim.manual_pass_line}`);
  if (passLines.length > 0) {
    console.log(`PASS LINE: ${passLines.join(' | ')}`);
  }
  if (aim.hard_fail) {
    console.log(`HARD FAIL: ${aim.hard_fail}`);
  }

  if (!aim.dependency_satisfied) {
    console.log('⚠ DEPENDENCY NOT SATISFIED — upstream aim(s) failing');
  }

  console.log(SINGLE_BAR);
  console.log('');
  console.log('  SUB-AIMS');
  console.log(`  ${SINGLE_BAR.slice(2)}`);

  for (const sa of aim.sub_aims) {
    printSubAim(sa);
  }
}

function printSubAim(sa: SubAimRollup): void {
  const nameWidth = Math.max(1, 50 - sa.sub_aim_id.length - sa.name.length);
  console.log('');
  console.log(
    `  [${sa.sub_aim_id}] ${sa.name}${' '.repeat(nameWidth)}[${lamp(sa.status)}]`,
  );

  if (sa.manual_only) {
    console.log('      (Manual scoring only — no harness rules wired)');
    return;
  }

  // Harness rules
  if (sa.harness_rules.length > 0) {
    console.log('');
    console.log('      HARNESS RULES');
    for (const rw of sa.harness_rules) {
      const lampStr = padRight(`[${lamp(rw.status)}]`, 16);
      const failStr = padRight(pct(rw.fail_rate), 8);
      console.log(`        ${padRight(rw.rule_id, 38)} ${lampStr} ${failStr} rescue=${pct(rw.rescue)}`);
    }
  }

  // Code enforcement
  if (sa.code_enforcement.length > 0) {
    console.log('');
    console.log('      CODE ENFORCEMENT');
    for (const ce of sa.code_enforcement) {
      const statusIcon = ce.status === 'ACTIVE' ? '● ACTIVE' :
                         ce.status === 'GAP' ? '○ GAP' :
                         ce.status === 'PARTIAL' ? '◐ PARTIAL' : '— N/A';
      console.log(`        ${ce.function_name}()${' '.repeat(Math.max(1, 34 - ce.function_name.length))}[${statusIcon}]`);
    }
  }

  // Stage pipeline
  if (sa.harness_rules.length > 0) {
    console.log('');
    console.log('      STAGE PIPELINE');
    console.log(
      `        A=${pct(sa.stage_pipeline.a_fail_rate)} → ` +
      `B=${pct(sa.stage_pipeline.b_fail_rate)} → ` +
      `C=${pct(sa.stage_pipeline.c_fail_rate)} → ` +
      `D=${pct(sa.stage_pipeline.d_fail_rate)}  ` +
      `rescue=${pct(sa.rescue_dependency)}`,
    );
  }

  // Fault path — only shown when sub-aim is DIM or OUT (§14 format)
  if (sa.fault_path) {
    console.log('');
    console.log('      FAULT PATH');
    console.log(`        Fault class:    ${sa.fault_path.fault_class}`);
    console.log(`        Root cause:     ${sa.fault_path.root_cause}`);
    console.log(`        Symptom at:     ${sa.fault_path.symptom_location}`);
    console.log(`        Fix type:       ${sa.fault_path.fix_type}`);
    console.log(`        Confidence:     ${sa.fault_path.confidence}`);
    console.log(`        Owner:          ${sa.fault_path.owner}`);
    console.log(`        Fix:            ${sa.fault_path.fix}`);
  }
}

function printFault(fault: FaultEntry): void {
  console.log(`  Sub-aim:         ${fault.sub_aim}`);
  console.log(`  Fault:           ${fault.fault}`);
  console.log(`  Class:           ${fault.fault_class}`);
  console.log(`  Root cause:      ${fault.root_cause}`);
  console.log(`  Symptoms at:     ${fault.symptom_locations.join(', ')}`);
  console.log(`  Fix type:        ${fault.fix_type}`);
  console.log(`  Owner:           ${fault.owner}`);
  console.log(`  Confidence:      ${fault.confidence}`);
  console.log(`  Production risk: ${fault.production_risk}`);
  console.log(`  Fix:             ${fault.fix}`);
  console.log('');
}
