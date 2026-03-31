// src/lib/optimise-prompts/midjourney-deterministic.ts
// ============================================================================
// MIDJOURNEY DETERMINISTIC TRANSFORMER
// ============================================================================
// Pure code. No GPT. Parses a Midjourney prompt into structural units,
// normalises them, and returns a clean result.
//
// Parse units:
//   1. Weighted clauses — prose sections ending with ::weight
//   2. Parameter block — --ar, --v, --s (each exactly once)
//   3. --no term list — comma-separated negatives
//
// Operations:
//   - Deduplicate parameters (keep last occurrence)
//   - Deduplicate --no terms
//   - Enforce parameter order: --ar --v --s --no (always last)
//   - Validate clause weights exist and are well-formed
//   - Preserve all clause prose and weights unchanged
//
// Design principle: this does NOT rewrite prose. It cleans structure.
// If the input needs prose improvement, the decision engine routes to GPT.
//
// Authority: api-3.md, ChatGPT Session 3 spec
// Used by: route.ts via preflight decision engine
// ============================================================================

// ============================================================================
// TYPES
// ============================================================================

/** A single weighted clause from the prompt. */
export interface MjClause {
  /** The prose text of the clause */
  prose: string;
  /** The weight value (e.g., 2.0, 1.5) */
  weight: number;
}

/** Parsed Midjourney prompt structure. */
export interface MjParsedPrompt {
  /** Weighted clauses in order */
  clauses: MjClause[];
  /** --ar value if present (e.g., "16:9") */
  ar: string | null;
  /** --v value if present (e.g., "7") */
  v: string | null;
  /** --s value if present (e.g., "500") */
  s: string | null;
  /** --no terms as deduplicated array */
  noTerms: string[];
  /** Whether the parse was clean (all units identified) */
  isValid: boolean;
  /** Any parse warnings */
  warnings: string[];
}

/** Result of the deterministic normalisation. */
export interface MjNormalisedResult {
  /** The normalised prompt text */
  text: string;
  /** Changes made during normalisation */
  changes: string[];
  /** Whether any changes were made */
  wasChanged: boolean;
}

/** Result of structural validation. */
export interface MjValidationResult {
  /** Whether the structure is valid for Midjourney */
  isValid: boolean;
  /** Specific validation failures (hard — route to GPT) */
  failures: string[];
  /** Soft warnings (acceptable but noted) */
  warnings: string[];
}

// ============================================================================
// PARSER
// ============================================================================

/**
 * Parse a Midjourney prompt into its structural units.
 *
 * Expected format:
 *   clause text::weight, clause text::weight, ... --ar X --v N --s N --no term, term
 *
 * The parser is tolerant of formatting variations but strict about
 * identifying the boundary between clauses and parameters.
 */
export function parseMjPrompt(text: string): MjParsedPrompt {
  const warnings: string[] = [];

  // ── Step 1: Split parameters from prose ──────────────────────────────
  // Parameters start at the first -- that's followed by ar|v|s|no|stylize
  const paramBoundary = text.search(/\s+--(?:ar|v|s|no|stylize)\b/);

  let proseSection: string;
  let paramSection: string;

  if (paramBoundary > 0) {
    proseSection = text.slice(0, paramBoundary).trim();
    paramSection = text.slice(paramBoundary).trim();
  } else {
    proseSection = text.trim();
    paramSection = '';
    warnings.push('No parameter block found');
  }

  // ── Step 1.5: Convert leaked parenthetical weights to :: syntax ──────
  // If Call 2 or a previous stage left (term:weight) syntax in the prompt,
  // convert clean matches to Midjourney :: format before parsing.
  // Only convert when the match is clean and local. Ambiguous mixed syntax
  // is left for the validator to catch and route to GPT.
  const PAREN_WEIGHT_RE = /\(([^()]{3,80}):(\d+\.?\d*)\)/g;
  const hasParenWeights = PAREN_WEIGHT_RE.test(proseSection);
  if (hasParenWeights) {
    // Reset regex after test
    PAREN_WEIGHT_RE.lastIndex = 0;
    const hasDCWeights = /\w::[\d.]+/.test(proseSection);

    if (!hasDCWeights) {
      // Only parenthetical weights present — clean conversion
      proseSection = proseSection.replace(PAREN_WEIGHT_RE, '$1::$2');
      warnings.push('Converted parenthetical weights to :: syntax');
    } else {
      // Mixed syntax — ambiguous, flag it
      warnings.push('Mixed parenthetical and :: weight syntax detected — may need GPT');
    }
  }

  // ── Step 2: Parse weighted clauses ───────────────────────────────────
  // Split on ::weight patterns. Each clause ends with ::N.N
  const clauses: MjClause[] = [];

  // Match all clause::weight segments
  // Pattern: anything followed by ::number (possibly with decimal)
  const clauseRegex = /([^]*?)::(\d+\.?\d*)/g;
  let clauseMatch: RegExpExecArray | null;
  let lastIndex = 0;

  // Reset regex
  clauseRegex.lastIndex = 0;

  while ((clauseMatch = clauseRegex.exec(proseSection)) !== null) {
    const prose = clauseMatch[1]?.trim().replace(/^,\s*/, '').replace(/,\s*$/, '').trim() ?? '';
    const weight = parseFloat(clauseMatch[2] ?? '1.0');

    if (prose.length > 0) {
      clauses.push({ prose, weight });
    }
    lastIndex = clauseRegex.lastIndex;
  }

  // Check for trailing prose after last weight (shouldn't be there but handle gracefully)
  const trailing = proseSection.slice(lastIndex).trim().replace(/^,\s*/, '').trim();
  if (trailing.length > 0 && clauses.length > 0) {
    // Append to last clause's prose
    clauses[clauses.length - 1]!.prose += ', ' + trailing;
    warnings.push('Trailing unweighted prose appended to last clause');
  } else if (trailing.length > 0 && clauses.length === 0) {
    // No weighted clauses at all — the whole thing is unweighted prose
    warnings.push('No weighted clauses found — prompt is unweighted');
  }

  // ── Step 3: Parse parameters ──────────────────────────────────────
  let ar: string | null = null;
  let v: string | null = null;
  let s: string | null = null;
  const noTerms: string[] = [];

  if (paramSection) {
    // --ar (keep last occurrence)
    const arMatches = [...paramSection.matchAll(/--ar\s+(\d+:\d+)/g)];
    if (arMatches.length > 0) {
      ar = arMatches[arMatches.length - 1]?.[1] ?? null;
      if (arMatches.length > 1) warnings.push(`Duplicate --ar (${arMatches.length}x) — kept last`);
    }

    // --v (keep last occurrence)
    const vMatches = [...paramSection.matchAll(/--v\s+(\d+)/g)];
    if (vMatches.length > 0) {
      v = vMatches[vMatches.length - 1]?.[1] ?? null;
      if (vMatches.length > 1) warnings.push(`Duplicate --v (${vMatches.length}x) — kept last`);
    }

    // --s / --stylize (keep last occurrence)
    const sMatches = [...paramSection.matchAll(/--(?:s|stylize)\s+(\d+)/g)];
    if (sMatches.length > 0) {
      s = sMatches[sMatches.length - 1]?.[1] ?? null;
      if (sMatches.length > 1) warnings.push(`Duplicate --s (${sMatches.length}x) — kept last`);
    }

    // --no (merge all, deduplicate)
    const noBlocks = [...paramSection.matchAll(/--no\s+([^-]+?)(?=\s+--|$)/g)];
    const seen = new Set<string>();
    for (const block of noBlocks) {
      const terms = (block[1] ?? '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
      for (const term of terms) {
        if (!seen.has(term)) {
          seen.add(term);
          noTerms.push(term);
        }
      }
    }
    if (noBlocks.length > 1) {
      warnings.push(`Merged ${noBlocks.length} --no blocks into one`);
    }
  }

  const hasMixedSyntax = warnings.some(w => w.includes('Mixed parenthetical'));
  const isValid = clauses.length >= 2 && clauses.length <= 6 && !hasMixedSyntax;
  if (clauses.length < 2) warnings.push(`Only ${clauses.length} weighted clauses (need 2-6)`);
  if (clauses.length > 6) warnings.push(`${clauses.length} weighted clauses (max 6)`);

  return { clauses, ar, v, s, noTerms, isValid, warnings };
}

// ============================================================================
// VALIDATOR
// ============================================================================

/**
 * Validate that a parsed MJ prompt has good structural integrity.
 * Used by the preflight engine to decide if deterministic cleanup is enough
 * or if GPT is needed to restructure.
 */
export function validateMjStructure(parsed: MjParsedPrompt): MjValidationResult {
  const failures: string[] = [];
  const warnings: string[] = [];

  // Must have 2–6 weighted clauses
  if (parsed.clauses.length < 2) {
    failures.push(`Too few weighted clauses (${parsed.clauses.length}, need 2+)`);
  }
  if (parsed.clauses.length > 6) {
    failures.push(`Too many weighted clauses (${parsed.clauses.length}, max 6)`);
  }

  // Clause prose quality check
  for (let i = 0; i < parsed.clauses.length; i++) {
    const clause = parsed.clauses[i]!;
    const wordCount = clause.prose.split(/\s+/).filter(Boolean).length;

    // Empty prose — hard fail (hollow clause shell)
    if (clause.prose.trim().length === 0) {
      failures.push(`Clause ${i + 1} has empty prose`);
    }
    // Under 3 words — hard fail (too weak for deterministic trust)
    else if (wordCount < 3) {
      failures.push(`Clause ${i + 1} has only ${wordCount} word(s) — too weak ("${clause.prose.slice(0, 40)}")`);
    }
    // Under 5 words — warn but don't fail
    else if (wordCount < 5) {
      warnings.push(`Clause ${i + 1} is short (${wordCount} words) — acceptable but thin`);
    }
  }

  // First clause should have highest weight
  if (parsed.clauses.length >= 2) {
    const firstWeight = parsed.clauses[0]?.weight ?? 0;
    const maxWeight = Math.max(...parsed.clauses.map(c => c.weight));
    if (firstWeight < maxWeight) {
      failures.push(`First clause weight (${firstWeight}) is not the highest (${maxWeight})`);
    }
  }

  // Weights should be in descending order (roughly)
  if (parsed.clauses.length >= 2) {
    const weights = parsed.clauses.map(c => c.weight);
    let descending = true;
    for (let i = 1; i < weights.length; i++) {
      if ((weights[i] ?? 0) > (weights[i - 1] ?? 0)) {
        descending = false;
        break;
      }
    }
    if (!descending) {
      failures.push('Clause weights are not in descending order');
    }
  }

  // Should have at least --ar
  if (!parsed.ar) {
    failures.push('Missing --ar parameter');
  }

  return {
    isValid: failures.length === 0,
    failures,
    warnings,
  };
}

// ============================================================================
// NORMALISER
// ============================================================================

/**
 * Normalise a parsed Midjourney prompt.
 * Does NOT change prose or weights — only cleans structure.
 *
 * Operations:
 *   1. Rebuild clauses with consistent formatting
 *   2. Apply default params where missing
 *   3. Enforce parameter order: --ar --v --s --no
 *   4. Deduplicate (already done in parser, but belt-and-braces)
 */
export function normaliseMjPrompt(parsed: MjParsedPrompt): MjNormalisedResult {
  const changes: string[] = [];

  // ── Rebuild clause section ───────────────────────────────────────────
  // Strip any remaining parenthetical weights from clause prose
  // (belt-and-braces — pre-parse should have caught them)
  const clauseTexts = parsed.clauses.map(c => {
    const cleaned = c.prose.replace(/\(([^()]{3,80}):(\d+\.?\d*)\)/g, '$1');
    if (cleaned !== c.prose) {
      changes.push('Stripped residual parenthetical weight from clause prose');
    }
    return `${cleaned}::${c.weight}`;
  });
  const proseBlock = clauseTexts.join(', ');

  // ── Build parameter block ────────────────────────────────────────────
  const ar = parsed.ar ?? '16:9';
  const v = parsed.v ?? '7';
  const s = parsed.s ?? '500';

  if (!parsed.ar) changes.push('Added default --ar 16:9');
  if (!parsed.v) changes.push('Added default --v 7');
  if (!parsed.s) changes.push('Added default --s 500');

  // --no: ensure at least generic quality negatives
  let noTerms = [...parsed.noTerms];
  const genericFloor = ['blurry', 'text', 'watermark'];
  for (const term of genericFloor) {
    if (!noTerms.includes(term)) {
      noTerms.push(term);
      changes.push(`Added missing --no term: ${term}`);
    }
  }

  // Deduplicate (should already be done by parser, but safety)
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const term of noTerms) {
    const lower = term.toLowerCase().trim();
    if (lower && !seen.has(lower)) {
      seen.add(lower);
      deduped.push(lower);
    }
  }
  if (deduped.length < noTerms.length) {
    changes.push(`Removed ${noTerms.length - deduped.length} duplicate --no terms`);
  }
  noTerms = deduped;

  // ── Assemble ─────────────────────────────────────────────────────────
  const paramBlock = `--ar ${ar} --v ${v} --s ${s} --no ${noTerms.join(', ')}`;
  const text = `${proseBlock} ${paramBlock}`;

  // Track parser-level changes
  if (parsed.warnings.length > 0) {
    for (const w of parsed.warnings) {
      if (w.includes('Duplicate')) changes.push(w);
      if (w.includes('Merged')) changes.push(w);
      if (w.includes('Converted parenthetical')) changes.push(w);
    }
  }

  if (changes.length === 0) {
    changes.push('Midjourney structure validated — no changes needed');
  }

  return {
    text,
    changes,
    wasChanged: changes.length > 0 && changes[0] !== 'Midjourney structure validated — no changes needed',
  };
}

// ============================================================================
// FULL PIPELINE
// ============================================================================

/**
 * Run the full Midjourney deterministic pipeline:
 *   1. Parse → 2. Validate → 3. Normalise
 *
 * Returns the normalised prompt + validation status.
 * The caller (route.ts) decides whether to accept this or fall through to GPT.
 */
export function runMjDeterministic(text: string): {
  result: MjNormalisedResult;
  validation: MjValidationResult;
  parsed: MjParsedPrompt;
} {
  const parsed = parseMjPrompt(text);
  const validation = validateMjStructure(parsed);
  const result = normaliseMjPrompt(parsed);

  return { result, validation, parsed };
}
