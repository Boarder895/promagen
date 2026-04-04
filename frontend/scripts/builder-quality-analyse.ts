#!/usr/bin/env npx tsx
// scripts/builder-quality-analyse.ts
// ============================================================================
// BUILDER QUALITY INTELLIGENCE — Failure Analysis + Fix-Class Nomination
// ============================================================================
// Analyses scoring results for a platform, clusters recurring failures,
// and deterministically nominates a fix class + target section for the
// suggest script.
//
// Usage (from frontend/):
//   npx tsx scripts/builder-quality-analyse.ts --platform bing
//   npx tsx scripts/builder-quality-analyse.ts --all --top 5
//
// Part 12 v1.0.0 (4 Apr 2026). ChatGPT review: 96/100, signed off.
// Authority: docs/authority/builder-quality-intelligence.md v2.5.0 §11
// Build plan: part-12-build-plan v1.1.0
// ============================================================================

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: resolve('.env.local') });
config({ path: resolve('.env') });

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';

// ============================================================================
// TYPES
// ============================================================================

interface CliArgs {
  platform: string | null;
  all: boolean;
  top: number;
  minResults: number;
  scorerVersions: number;
}

interface AnchorDropEntry {
  anchor: string;
  severity: 'critical' | 'important' | 'optional';
  dropCount: number;
  totalRuns: number;
  dropRate: number;
  weight: number;
  weightedImpact: number;
  scenes: string[];
}

interface SceneWeakness {
  sceneId: string;
  meanScore: number;
  minScore: number;
  maxScore: number;
  stddev: number;
  resultCount: number;
}

interface CanonicalDirective {
  canonical: string;
  occurrenceCount: number;
  totalRuns: number;
  occurrenceRate: number;
  category: 'anchor-loss' | 'style' | 'compliance' | 'other';
  rawVariants: string[];
}

type FixClass =
  | 'modifier_preservation'
  | 'spatial_preservation'
  | 'colour_preservation'
  | 'anti_invention'
  | 'length_floor'
  | 'anti_synonym'
  | 'compliance_dependency';

interface FixClassNomination {
  fixClass: FixClass;
  targetSection: string;
  evidence: string;
  weightedScore: number;
}

interface FailureReport {
  platformId: string;
  resultCount: number;
  runCount: number;
  scorerVersionCount: number;
  anchorDrops: AnchorDropEntry[];
  sceneWeakness: SceneWeakness[];
  recurringDirectives: CanonicalDirective[];
  postProcessingReliance: number;
  scoreTrend: { runIndex: number; meanScore: number }[];
  fixClassNomination: FixClassNomination | null;
  generatedAt: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function log(msg: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

function logError(msg: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  console.error(`[${ts}] ✗ ${msg}`);
}

const SEVERITY_WEIGHT: Record<string, number> = { critical: 3, important: 2, optional: 1 };

/** Canonicalise a directive string for deduplication */
function canonicalise(directive: string): string {
  let d = directive.trim().toLowerCase();
  // Strip leading action verbs
  d = d.replace(/^(restore|preserve|ensure|maintain|add|include|keep|use)\s+/i, '');
  // Strip trailing punctuation
  d = d.replace(/[.!;:]+$/, '');
  return d.trim();
}

/** Jaccard similarity of two word sets */
function jaccardSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.split(/\s+/));
  const wordsB = new Set(b.split(/\s+/));
  const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

/** Merge near-duplicate directives (>80% Jaccard overlap) */
function mergeDirectives(
  directives: { canonical: string; count: number; raws: string[] }[],
): { canonical: string; count: number; raws: string[] }[] {
  const merged: typeof directives = [];

  for (const d of directives) {
    let foundMerge = false;
    for (const m of merged) {
      if (jaccardSimilarity(d.canonical, m.canonical) > 0.8) {
        m.count += d.count;
        m.raws.push(...d.raws);
        // Keep the shorter canonical as representative
        if (d.canonical.length < m.canonical.length) {
          m.canonical = d.canonical;
        }
        foundMerge = true;
        break;
      }
    }
    if (!foundMerge) {
      merged.push({ ...d });
    }
  }

  return merged;
}

/** Classify a directive by type */
function classifyDirective(canonical: string): 'anchor-loss' | 'style' | 'compliance' | 'other' {
  const anchorKeywords = ['colour', 'color', 'anchor', 'element', 'preserve', 'original', 'spatial', 'relationship', 'modifier'];
  const styleKeywords = ['style', 'tone', 'mood', 'aesthetic', 'atmosphere', 'creative'];
  const complianceKeywords = ['length', 'character', 'format', 'syntax', 'weight', 'parameter'];

  if (anchorKeywords.some((k) => canonical.includes(k))) return 'anchor-loss';
  if (styleKeywords.some((k) => canonical.includes(k))) return 'style';
  if (complianceKeywords.some((k) => canonical.includes(k))) return 'compliance';
  return 'other';
}

// ============================================================================
// CLI ARGS
// ============================================================================

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {
    platform: null,
    all: false,
    top: 10,
    minResults: 50,
    scorerVersions: 3,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--platform': result.platform = args[++i] || null; break;
      case '--all': result.all = true; break;
      case '--top': result.top = parseInt(args[++i] || '10', 10) || 10; break;
      case '--min-results': result.minResults = parseInt(args[++i] || '50', 10) || 50; break;
      case '--scorer-versions': result.scorerVersions = parseInt(args[++i] || '3', 10) || 3; break;
    }
  }

  if (!result.platform && !result.all) {
    console.error('Usage: npx tsx scripts/builder-quality-analyse.ts --platform <id> | --all [--top 5]');
    process.exit(1);
  }

  return result;
}

// ============================================================================
// ANALYSIS
// ============================================================================

async function analysePlatform(
  sql: postgres.Sql,
  platformId: string,
  minResults: number,
  minScorerVersions: number,
): Promise<FailureReport | null> {
  // ── Prerequisite checks ─────────────────────────────────────────
  const countRows = await sql`
    SELECT COUNT(*)::int AS count,
           COUNT(DISTINCT run_id)::int AS run_count
    FROM builder_quality_results
    WHERE platform_id = ${platformId}
      AND source = 'batch'
      AND status = 'complete'
      AND is_holdout = false
  `;
  const resultCount = (countRows[0] as Record<string, unknown>).count as number;
  const runCount = (countRows[0] as Record<string, unknown>).run_count as number;

  if (resultCount < minResults) {
    log(`  ${platformId}: ${resultCount} results (need ${minResults}). Skipping.`);
    return null;
  }

  const versionRows = await sql`
    SELECT COUNT(DISTINCT r.scorer_version)::int AS versions
    FROM builder_quality_results res
    JOIN builder_quality_runs r ON r.run_id = res.run_id
    WHERE res.platform_id = ${platformId}
      AND res.source = 'batch'
      AND res.status = 'complete'
  `;
  const scorerVersionCount = (versionRows[0] as Record<string, unknown>).versions as number;

  if (scorerVersionCount < minScorerVersions) {
    log(`  ${platformId}: ${scorerVersionCount} scorer versions (need ${minScorerVersions}). Skipping.`);
    return null;
  }

  // ── 1. Anchor Drop Frequency ────────────────────────────────────
  const allResults = await sql`
    SELECT scene_id, anchor_audit, gpt_score, gpt_directives,
           post_processing_changed, run_id
    FROM builder_quality_results
    WHERE platform_id = ${platformId}
      AND source = 'batch'
      AND status = 'complete'
      AND is_holdout = false
    ORDER BY created_at DESC
  `;

  const anchorMap = new Map<string, {
    severity: string;
    dropCount: number;
    totalRuns: number;
    scenes: Set<string>;
  }>();

  for (const row of allResults) {
    const r = row as Record<string, unknown>;
    const audit = r.anchor_audit as { anchor: string; severity: string; status: string }[] | null;
    if (!audit) continue;

    for (const entry of audit) {
      const key = `${entry.anchor}|${entry.severity}`;
      const existing = anchorMap.get(key) || {
        severity: entry.severity,
        dropCount: 0,
        totalRuns: 0,
        scenes: new Set<string>(),
      };
      existing.totalRuns++;
      if (entry.status === 'dropped') {
        existing.dropCount++;
        existing.scenes.add(r.scene_id as string);
      }
      anchorMap.set(key, existing);
    }
  }

  const anchorDrops: AnchorDropEntry[] = [];
  for (const [key, data] of anchorMap) {
    const [anchor] = key.split('|');
    const weight = SEVERITY_WEIGHT[data.severity] ?? 1;
    const dropRate = data.totalRuns > 0 ? data.dropCount / data.totalRuns : 0;
    anchorDrops.push({
      anchor,
      severity: data.severity as 'critical' | 'important' | 'optional',
      dropCount: data.dropCount,
      totalRuns: data.totalRuns,
      dropRate: Math.round(dropRate * 100) / 100,
      weight,
      weightedImpact: Math.round(data.dropCount * weight * 100) / 100,
      scenes: [...data.scenes],
    });
  }
  anchorDrops.sort((a, b) => b.weightedImpact - a.weightedImpact);

  // ── 2. Scene Weakness Map ───────────────────────────────────────
  const sceneMap = new Map<string, number[]>();
  for (const row of allResults) {
    const r = row as Record<string, unknown>;
    const sceneId = r.scene_id as string;
    const score = r.gpt_score as number;
    const arr = sceneMap.get(sceneId) || [];
    arr.push(score);
    sceneMap.set(sceneId, arr);
  }

  const sceneWeakness: SceneWeakness[] = [];
  for (const [sceneId, scores] of sceneMap) {
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const variance = scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length;
    sceneWeakness.push({
      sceneId,
      meanScore: Math.round(mean * 100) / 100,
      minScore: min,
      maxScore: max,
      stddev: Math.round(Math.sqrt(variance) * 100) / 100,
      resultCount: scores.length,
    });
  }
  sceneWeakness.sort((a, b) => a.meanScore - b.meanScore);

  // ── 3. Recurring Directives (canonicalised) ─────────────────────
  const directiveCounts = new Map<string, { count: number; raws: string[] }>();
  for (const row of allResults) {
    const r = row as Record<string, unknown>;
    const directives = r.gpt_directives as string[] | null;
    if (!directives) continue;
    for (const d of directives) {
      const canon = canonicalise(d);
      if (canon.length < 5) continue; // Skip trivial
      const existing = directiveCounts.get(canon) || { count: 0, raws: [] };
      existing.count++;
      if (existing.raws.length < 3) existing.raws.push(d); // Keep a few raw examples
      directiveCounts.set(canon, existing);
    }
  }

  const rawDirectives = Array.from(directiveCounts.entries()).map(([canonical, data]) => ({
    canonical,
    count: data.count,
    raws: data.raws,
  }));

  const mergedDirectives = mergeDirectives(rawDirectives);
  mergedDirectives.sort((a, b) => b.count - a.count);

  const recurringDirectives: CanonicalDirective[] = mergedDirectives
    .filter((d) => d.count / runCount >= 0.3) // 30%+ occurrence
    .slice(0, 10)
    .map((d) => ({
      canonical: d.canonical,
      occurrenceCount: d.count,
      totalRuns: runCount,
      occurrenceRate: Math.round((d.count / runCount) * 100) / 100,
      category: classifyDirective(d.canonical),
      rawVariants: d.raws.slice(0, 3),
    }));

  // ── 4. Post-Processing Reliance ─────────────────────────────────
  let ppChanged = 0;
  for (const row of allResults) {
    if ((row as Record<string, unknown>).post_processing_changed) ppChanged++;
  }
  const postProcessingReliance = allResults.length > 0
    ? Math.round((ppChanged / allResults.length) * 100) / 100
    : 0;

  // ── 5. Score Trend (rolling 5-run average) ──────────────────────
  const runScores = new Map<string, number[]>();
  for (const row of allResults) {
    const r = row as Record<string, unknown>;
    const runId = r.run_id as string;
    const arr = runScores.get(runId) || [];
    arr.push(r.gpt_score as number);
    runScores.set(runId, arr);
  }
  const runMeans = Array.from(runScores.entries()).map(([, scores]) => ({
    meanScore: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100,
  }));
  const scoreTrend = runMeans.map((rm, i) => ({ runIndex: i, meanScore: rm.meanScore }));

  // ── Fix-Class Nomination ────────────────────────────────────────
  const fixClassNomination = nominateFixClass(anchorDrops, sceneWeakness, recurringDirectives, postProcessingReliance);

  return {
    platformId,
    resultCount,
    runCount,
    scorerVersionCount,
    anchorDrops: anchorDrops.slice(0, 15),
    sceneWeakness,
    recurringDirectives,
    postProcessingReliance,
    scoreTrend,
    fixClassNomination,
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// FIX-CLASS NOMINATION (deterministic)
// ============================================================================

function nominateFixClass(
  anchorDrops: AnchorDropEntry[],
  sceneWeakness: SceneWeakness[],
  recurringDirectives: CanonicalDirective[],
  postProcessingReliance: number,
): FixClassNomination | null {
  const candidates: FixClassNomination[] = [];

  // Check for colour/modifier anchor drops (critical/important, ≥40%)
  const colourKeywords = ['colour', 'color', 'amber', 'crimson', 'teal', 'golden', 'scarlet', 'azure', 'emerald'];
  const colourDrops = anchorDrops.filter(
    (a) => a.dropRate >= 0.4 && a.severity !== 'optional' &&
      colourKeywords.some((k) => a.anchor.toLowerCase().includes(k)),
  );
  if (colourDrops.length > 0) {
    const top = colourDrops[0];
    candidates.push({
      fixClass: 'colour_preservation',
      targetSection: 'Preservation rules',
      evidence: `Colour anchor "${top.anchor}" (${top.severity}) dropped ${Math.round(top.dropRate * 100)}% of the time in scenes: ${top.scenes.join(', ')}.`,
      weightedScore: top.weightedImpact,
    });
  }

  // Check for modifier-loss (critical/important anchors with modifiers, ≥40%)
  const modifierDrops = anchorDrops.filter(
    (a) => a.dropRate >= 0.4 && a.severity !== 'optional' && a.anchor.includes(' '),
  );
  if (modifierDrops.length > 0 && !colourDrops.length) {
    const top = modifierDrops[0];
    candidates.push({
      fixClass: 'modifier_preservation',
      targetSection: 'Preservation rules',
      evidence: `Multi-word anchor "${top.anchor}" (${top.severity}) dropped ${Math.round(top.dropRate * 100)}% — likely modifier-loss (§3.2 Rule A).`,
      weightedScore: top.weightedImpact,
    });
  }

  // Check for spatial/relationship drops
  const spatialKeywords = ['before', 'behind', 'beyond', 'beneath', 'above', 'between', 'through', 'toward'];
  const spatialDrops = anchorDrops.filter(
    (a) => a.dropRate >= 0.4 && spatialKeywords.some((k) => a.anchor.toLowerCase().includes(k)),
  );
  if (spatialDrops.length > 0) {
    const top = spatialDrops[0];
    candidates.push({
      fixClass: 'spatial_preservation',
      targetSection: 'Composition/relationship rules',
      evidence: `Spatial anchor "${top.anchor}" dropped ${Math.round(top.dropRate * 100)}%.`,
      weightedScore: top.weightedImpact,
    });
  }

  // Check for recurring "invented content" directives
  const inventionDirectives = recurringDirectives.filter(
    (d) => d.canonical.includes('invent') || d.canonical.includes('added') ||
      d.canonical.includes('not in source') || d.canonical.includes('hallucin'),
  );
  if (inventionDirectives.length > 0) {
    const top = inventionDirectives[0];
    candidates.push({
      fixClass: 'anti_invention',
      targetSection: 'Ban list / anti-invention rules',
      evidence: `Directive "${top.canonical}" occurs in ${Math.round(top.occurrenceRate * 100)}% of runs.`,
      weightedScore: top.occurrenceCount * 2,
    });
  }

  // Check for compression-stress scene weakness
  const compressionScene = sceneWeakness.find(
    (s) => s.sceneId.includes('compression') && s.meanScore < 65,
  );
  if (compressionScene) {
    candidates.push({
      fixClass: 'length_floor',
      targetSection: 'Length/compression rules',
      evidence: `Compression scene "${compressionScene.sceneId}" mean score ${compressionScene.meanScore} (range ${compressionScene.minScore}–${compressionScene.maxScore}).`,
      weightedScore: (70 - compressionScene.meanScore) * 3,
    });
  }

  // Check for synonym-churn directives
  const synonymDirectives = recurringDirectives.filter(
    (d) => d.canonical.includes('synonym') || d.canonical.includes('original verb') ||
      d.canonical.includes('original word') || d.canonical.includes('paraphrase'),
  );
  if (synonymDirectives.length > 0) {
    const top = synonymDirectives[0];
    candidates.push({
      fixClass: 'anti_synonym',
      targetSection: 'Fidelity / verb preservation rules',
      evidence: `Directive "${top.canonical}" occurs in ${Math.round(top.occurrenceRate * 100)}% of runs.`,
      weightedScore: top.occurrenceCount * 2,
    });
  }

  // Check for high post-processing reliance
  if (postProcessingReliance > 0.6) {
    candidates.push({
      fixClass: 'compliance_dependency',
      targetSection: 'Core rules',
      evidence: `Post-processing changed output in ${Math.round(postProcessingReliance * 100)}% of runs. Builder is relying on compliance gate to fix its own mistakes.`,
      weightedScore: postProcessingReliance * 20,
    });
  }

  if (candidates.length === 0) return null;

  // Return highest-weighted candidate
  candidates.sort((a, b) => b.weightedScore - a.weightedScore);
  return candidates[0];
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const args = parseArgs();

  if (!DATABASE_URL) {
    logError('DATABASE_URL not configured. Set it in .env.local');
    process.exit(1);
  }

  const sql = postgres(DATABASE_URL, { max: 3, idle_timeout: 20, ssl: 'require', onnotice: () => {} });

  log('═══ BUILDER QUALITY FAILURE ANALYSIS v1.0.0 ═══');
  log('');

  if (args.all) {
    // Analyse all platforms, show worst
    const platformRows = await sql`
      SELECT DISTINCT platform_id FROM builder_quality_results
      WHERE source = 'batch' AND status = 'complete'
    `;
    const platformIds = platformRows.map((r) => (r as Record<string, unknown>).platform_id as string);
    log(`Analysing ${platformIds.length} platforms...`);

    const reports: FailureReport[] = [];
    for (const pid of platformIds) {
      const report = await analysePlatform(sql, pid, args.minResults, args.scorerVersions);
      if (report) reports.push(report);
    }

    reports.sort((a, b) => {
      const aMean = a.sceneWeakness.reduce((sum, s) => sum + s.meanScore, 0) / (a.sceneWeakness.length || 1);
      const bMean = b.sceneWeakness.reduce((sum, s) => sum + s.meanScore, 0) / (b.sceneWeakness.length || 1);
      return aMean - bMean;
    });

    log('');
    log(`═══ TOP ${args.top} WEAKEST PLATFORMS ═══`);
    for (const r of reports.slice(0, args.top)) {
      const overallMean = r.sceneWeakness.reduce((sum, s) => sum + s.meanScore, 0) / (r.sceneWeakness.length || 1);
      const nomination = r.fixClassNomination;
      log(`  ${r.platformId.padEnd(22)} mean=${overallMean.toFixed(1)}  results=${r.resultCount}  fix=${nomination?.fixClass ?? 'none'}`);
    }
  } else {
    // Single platform analysis
    const report = await analysePlatform(sql, args.platform!, args.minResults, args.scorerVersions);

    if (!report) {
      log('Analysis could not be completed. See messages above.');
      await sql.end();
      process.exit(0);
    }

    // ── Print report ──────────────────────────────────────────
    log(`═══ FAILURE REPORT: ${report.platformId} ═══`);
    log(`Results: ${report.resultCount} across ${report.runCount} runs (${report.scorerVersionCount} scorer versions)`);
    log('');

    // Anchor drops
    log('── Anchor Drop Frequency (severity-weighted) ──');
    for (const a of report.anchorDrops.slice(0, 8)) {
      log(`  "${a.anchor}" (${a.severity}, wt ${a.weight}): dropped ${a.dropCount}/${a.totalRuns} (${Math.round(a.dropRate * 100)}%) — impact ${a.weightedImpact}`);
      if (a.scenes.length > 0) log(`    → scenes: ${a.scenes.join(', ')}`);
    }

    // Scene weakness
    log('');
    log('── Scene Weakness (weakest first) ──');
    for (const s of report.sceneWeakness) {
      const flag = s.meanScore < 70 ? ' ⚠' : '';
      log(`  ${s.sceneId.padEnd(38)} mean=${s.meanScore}  range=${s.minScore}–${s.maxScore}  stddev=${s.stddev}${flag}`);
    }

    // Recurring directives
    log('');
    log('── Recurring Directives (canonicalised, ≥30% occurrence) ──');
    for (const d of report.recurringDirectives.slice(0, 5)) {
      log(`  "${d.canonical}" [${d.category}] — ${d.occurrenceCount}/${d.totalRuns} (${Math.round(d.occurrenceRate * 100)}%)`);
    }

    // Post-processing
    log('');
    log(`── Post-Processing Reliance: ${Math.round(report.postProcessingReliance * 100)}% ──`);

    // Fix-class nomination
    log('');
    if (report.fixClassNomination) {
      log('═══ FIX-CLASS NOMINATION ═══');
      log(`Fix class: ${report.fixClassNomination.fixClass}`);
      log(`Target section: ${report.fixClassNomination.targetSection}`);
      log(`Evidence: ${report.fixClassNomination.evidence}`);
    } else {
      log('No fix-class nomination — no clear failure pattern detected.');
    }

    // Save report
    mkdirSync(resolve('reports'), { recursive: true });
    const reportPath = resolve(`reports/failure-report-${report.platformId}.json`);
    writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    log('');
    log(`Report saved: ${reportPath}`);
    log(`Next: npx tsx scripts/builder-quality-suggest.ts --platform ${report.platformId}`);
  }

  await sql.end();
}

main().catch((e) => {
  logError(`Fatal error: ${e}`);
  process.exit(1);
});
