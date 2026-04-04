#!/usr/bin/env npx tsx
// scripts/builder-quality-suggest.ts
// ============================================================================
// BUILDER QUALITY INTELLIGENCE — GPT-Constrained Patch Suggestion
// ============================================================================
// Takes a failure report (from builder-quality-analyse.ts) and the current
// builder file, asks GPT to write ONE targeted edit for the nominated
// fix class and target section. GPT does NOT diagnose — that's deterministic.
//
// Usage (from frontend/):
//   npx tsx scripts/builder-quality-suggest.ts --platform bing
//   npx tsx scripts/builder-quality-suggest.ts --platform bing --dry-run
//
// Part 12 v1.0.0 (4 Apr 2026). ChatGPT review: 96/100, signed off.
// Authority: docs/authority/builder-quality-intelligence.md v2.5.0 §11
// Build plan: part-12-build-plan v1.1.0
// ============================================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';

config({ path: resolve('.env.local') });
config({ path: resolve('.env') });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// ============================================================================
// TYPES
// ============================================================================

interface CliArgs {
  platform: string;
  failureReport: string | null;
  dryRun: boolean;
}

interface FixClassNomination {
  fixClass: string;
  targetSection: string;
  evidence: string;
  weightedScore: number;
}

interface FailureReport {
  platformId: string;
  anchorDrops: { anchor: string; severity: string; dropRate: number; scenes: string[] }[];
  sceneWeakness: { sceneId: string; meanScore: number }[];
  recurringDirectives: { canonical: string; occurrenceRate: number; category: string }[];
  postProcessingReliance: number;
  fixClassNomination: FixClassNomination | null;
}

interface PatchSuggestion {
  fixClass: string;
  targetSection: string;
  editType: string;
  suggestion: string;
  wrongExample: string;
  rightExample: string;
  rationale: string;
  expectedImpact: string;
  risk: string;
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

// ============================================================================
// CLI ARGS
// ============================================================================

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = { platform: '', failureReport: null, dryRun: false };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--platform': result.platform = args[++i] || ''; break;
      case '--failure-report': result.failureReport = args[++i] || null; break;
      case '--dry-run': result.dryRun = true; break;
    }
  }

  if (!result.platform) {
    console.error('Usage: npx tsx scripts/builder-quality-suggest.ts --platform <id> [--dry-run]');
    process.exit(1);
  }

  return result;
}

// ============================================================================
// BUILDER FILE EXTRACTION
// ============================================================================

function findBuilderFile(platformId: string): string | null {
  const basePath = resolve('src/lib/optimise-prompts');
  const candidates = [
    `${basePath}/group-nl-${platformId}.ts`,
    `${basePath}/group-mj.ts`,
    `${basePath}/group-dalle-api.ts`,
    `${basePath}/group-sd-clip-parenthetical.ts`,
  ];

  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

function extractSystemPrompt(fileContent: string): string {
  // Extract the system prompt string from builder file
  // Builders typically have: const SYSTEM_PROMPT = `...` or buildSystemPrompt()
  // Try to find the template literal or string assignment
  const match = fileContent.match(/(?:const\s+(?:SYSTEM_PROMPT|systemPrompt)\s*=\s*`)([\s\S]*?)(?:`\s*;)/);
  if (match?.[1]) return match[1].trim();

  // Fallback: look for the function that builds it
  const funcMatch = fileContent.match(/function\s+build\w*SystemPrompt[\s\S]*?return\s*`([\s\S]*?)`/);
  if (funcMatch?.[1]) return funcMatch[1].trim();

  return '[Could not extract system prompt — provide manually]';
}

// ============================================================================
// PATTERN LIBRARY
// ============================================================================

const PATTERN_LIBRARY = `
PROVEN FIX PATTERNS (from Phase 2/3 builder rewrites):

1. MODIFIER PRESERVATION: "If the source prompt names a specific [modifier] (e.g. amber, weathered, narrow), that word MUST appear in the output. Do not replace named modifiers with generic alternatives."
   WRONG: "Her warm lantern throws a soft pool" (replaced "amber" with "warm")
   RIGHT: "Her paper lantern throws a soft amber pool" (preserved "amber")

2. SPATIAL PRESERVATION: "Preserve spatial relationships exactly: [subject] [preposition] [object]. Do not reorganise spatial structure."
   WRONG: "A shrine in a forest with a woman" (lost "kneels before" and "beyond the steps")
   RIGHT: "A woman kneels before a shrine... the stream beyond the steps" (preserved spatial chain)

3. ANTI-INVENTION: "Do NOT add visual elements, textures, materials, or camera angles not present in the source. If in doubt, omit rather than invent."
   WRONG: "salt-crusted iron railings framed as a low-angle wide shot" (invented)
   RIGHT: Keep only what was in the source prompt.

4. ANTI-SYNONYM: "Use the source verb exactly. Do not substitute synonyms."
   WRONG: "The lantern casts a pool" (source said "throws")
   RIGHT: "The lantern throws a pool"

5. LENGTH FLOOR: "Output must be at least [N]% of the input character count. Do not compress."

6. COMPLIANCE DEPENDENCY: If the builder relies on the compliance gate to fix its output, the rule belongs in the system prompt, not in post-processing.
`;

// ============================================================================
// BUILD GPT PROMPT
// ============================================================================

function buildGptPrompt(
  report: FailureReport,
  systemPromptText: string,
  nomination: FixClassNomination,
): string {
  // Top 3 anchor drops
  const topAnchors = report.anchorDrops
    .slice(0, 3)
    .map((a) => `  - "${a.anchor}" (${a.severity}): dropped ${Math.round(a.dropRate * 100)}% in scenes: ${a.scenes.join(', ')}`)
    .join('\n');

  // Top 2 weak scenes
  const topScenes = report.sceneWeakness
    .slice(0, 2)
    .map((s) => `  - ${s.sceneId}: mean ${s.meanScore}`)
    .join('\n');

  // Top 3 recurring directives
  const topDirectives = report.recurringDirectives
    .slice(0, 3)
    .map((d) => `  - "${d.canonical}" [${d.category}]: ${Math.round(d.occurrenceRate * 100)}% occurrence`)
    .join('\n');

  return `You are a system prompt editor for an AI image prompt optimisation platform.

TASK: Write exactly ONE rule to add to the "${nomination.targetSection}" section of this builder's system prompt. This rule must address the specific failure described below.

FIX CLASS: ${nomination.fixClass}
TARGET SECTION: ${nomination.targetSection}
FAILURE EVIDENCE: ${nomination.evidence}

TOP ANCHOR DROPS:
${topAnchors}

WEAKEST SCENES:
${topScenes}

RECURRING SCORER DIRECTIVES:
${topDirectives}

POST-PROCESSING RELIANCE: ${Math.round(report.postProcessingReliance * 100)}%

${PATTERN_LIBRARY}

CURRENT SYSTEM PROMPT (for context — do NOT rewrite it, only add one rule):
---
${systemPromptText.slice(0, 4000)}
---

CONSTRAINTS:
- Write exactly ONE new rule. Not two, not three. One.
- The rule must target the "${nomination.targetSection}" section.
- Include a WRONG example and a RIGHT example.
- Reference specific failure data (anchor name, drop rate, scene) in your rationale.
- The rule must be additive — do not modify or remove existing rules.
- Do not use vague language: no "add more detail", "be more creative", "ensure quality".
- Keep the rule under 200 words.

Respond with ONLY a JSON object (no markdown, no backticks):
{
  "fixClass": "${nomination.fixClass}",
  "targetSection": "${nomination.targetSection}",
  "editType": "add_rule",
  "suggestion": "The new rule text to add",
  "wrongExample": "An example of the BAD output this rule prevents",
  "rightExample": "An example of the CORRECT output this rule produces",
  "rationale": "Why this rule addresses the failure, citing specific data",
  "expectedImpact": "Expected score improvement and which scenes benefit",
  "risk": "Risk assessment: low/medium/high and why"
}`;
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const args = parseArgs();

  log('═══ BUILDER QUALITY PATCH SUGGESTION v1.0.0 ═══');
  log(`Platform: ${args.platform}`);
  log('');

  // ── Load failure report ─────────────────────────────────────────
  const reportPath = args.failureReport || resolve(`reports/failure-report-${args.platform}.json`);

  if (!existsSync(reportPath)) {
    log('No failure report found. Running analysis first...');
    log('');
    // Auto-run analyse — import dynamically to avoid circular deps
    const { execSync } = await import('node:child_process');
    try {
      execSync(`npx tsx scripts/builder-quality-analyse.ts --platform ${args.platform}`, {
        stdio: 'inherit',
        cwd: resolve('.'),
      });
    } catch {
      logError('Analysis failed. Cannot generate suggestion without a failure report.');
      process.exit(1);
    }
  }

  if (!existsSync(reportPath)) {
    logError(`Failure report not found at ${reportPath}`);
    process.exit(1);
  }

  const report = JSON.parse(readFileSync(reportPath, 'utf8')) as FailureReport;

  if (!report.fixClassNomination) {
    log('No fix-class nomination in the failure report — no clear pattern to address.');
    log('The platform may not have a dominant failure pattern, or may need more data.');
    process.exit(0);
  }

  const nomination = report.fixClassNomination;
  log(`Fix class: ${nomination.fixClass}`);
  log(`Target section: ${nomination.targetSection}`);
  log(`Evidence: ${nomination.evidence}`);
  log('');

  // ── Load builder file ───────────────────────────────────────────
  const builderPath = findBuilderFile(args.platform);
  if (!builderPath) {
    logError(`Could not find builder file for platform "${args.platform}"`);
    process.exit(1);
  }

  const builderContent = readFileSync(builderPath, 'utf8');
  const systemPromptText = extractSystemPrompt(builderContent);
  log(`Builder file: ${builderPath}`);
  log(`System prompt: ${systemPromptText.length} chars`);
  log('');

  // ── Build GPT prompt ────────────────────────────────────────────
  const gptPrompt = buildGptPrompt(report, systemPromptText, nomination);

  if (args.dryRun) {
    log('═══ DRY RUN — GPT prompt follows ═══');
    log('');
    console.log(gptPrompt);
    log('');
    log('No API call made. Remove --dry-run to generate a suggestion.');
    return;
  }

  // ── Call GPT ────────────────────────────────────────────────────
  if (!OPENAI_API_KEY) {
    logError('OPENAI_API_KEY not set in .env.local');
    process.exit(1);
  }

  log('Calling GPT for suggestion...');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-5.4-mini',
      temperature: 0.3,
      max_completion_tokens: 800,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a precise system prompt editor. Respond only with valid JSON.' },
        { role: 'user', content: gptPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'unknown');
    logError(`GPT call failed (${res.status}): ${errText.slice(0, 300)}`);
    process.exit(1);
  }

  const data = await res.json();
  const rawContent = data.choices?.[0]?.message?.content ?? '';

  let suggestion: PatchSuggestion;
  try {
    suggestion = JSON.parse(rawContent.replace(/```json|```/g, '').trim());
  } catch {
    logError('GPT returned invalid JSON:');
    console.error(rawContent.slice(0, 500));
    process.exit(1);
  }

  // ── Validate response ───────────────────────────────────────────
  const warnings: string[] = [];
  if (suggestion.fixClass !== nomination.fixClass) {
    warnings.push(`Fix class mismatch: expected "${nomination.fixClass}", got "${suggestion.fixClass}"`);
  }
  if (!suggestion.wrongExample) warnings.push('Missing WRONG example');
  if (!suggestion.rightExample) warnings.push('Missing RIGHT example');
  if (!suggestion.rationale) warnings.push('Missing rationale');

  // ── Display suggestion ──────────────────────────────────────────
  log('');
  log('═══ PATCH SUGGESTION ═══');
  log(`Fix class: ${suggestion.fixClass}`);
  log(`Target section: ${suggestion.targetSection}`);
  log(`Edit type: ${suggestion.editType}`);
  log('');
  log('SUGGESTED RULE:');
  log(`  ${suggestion.suggestion}`);
  log('');
  log('WRONG:');
  log(`  ${suggestion.wrongExample}`);
  log('RIGHT:');
  log(`  ${suggestion.rightExample}`);
  log('');
  log('RATIONALE:');
  log(`  ${suggestion.rationale}`);
  log('');
  log(`Expected impact: ${suggestion.expectedImpact}`);
  log(`Risk: ${suggestion.risk}`);

  if (warnings.length > 0) {
    log('');
    log('⚠ VALIDATION WARNINGS:');
    for (const w of warnings) log(`  - ${w}`);
  }

  // ── Save suggestion ─────────────────────────────────────────────
  mkdirSync(resolve('reports'), { recursive: true });
  const suggestPath = resolve(`reports/patch-suggestion-${args.platform}.json`);
  writeFileSync(suggestPath, JSON.stringify(suggestion, null, 2), 'utf8');
  log('');
  log(`Suggestion saved: ${suggestPath}`);
  log('');
  log('Next steps:');
  log(`  1. Copy builder: copy ${builderPath} ${builderPath}.patched`);
  log(`  2. Edit the .patched file — add the suggested rule to "${nomination.targetSection}"`);
  log(`  3. Test: npx tsx scripts/builder-quality-test-patch.ts --platform ${args.platform} --patched-file ${builderPath}.patched`);
}

main().catch((e) => {
  logError(`Fatal error: ${e}`);
  process.exit(1);
});
