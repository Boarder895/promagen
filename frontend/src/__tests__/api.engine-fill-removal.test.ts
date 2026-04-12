// src/__tests__/api.engine-fill-removal.test.ts
// ============================================================================
// REGRESSION GUARD — Engine-fill must never return
// ============================================================================
// Phase A removed the engine auto-fill path (P1: user is the only source of
// creative intent). This test ensures no future change reintroduces it.
//
// Runs in: pnpm run test:api (matched by src/__tests__/api.*.test.ts)
// Authority: prompt-lab-api-architecture-v1.1.md §5.1, P1
// ============================================================================

import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── Files that previously contained engine-fill code ────────────────────
const FILES_TO_GUARD = [
  'src/app/api/generate-tier-prompts/route.ts',
  'src/hooks/use-tier-generation.ts',
  'src/components/prompts/enhanced-educational-preview.tsx',
  'src/components/prompts/playground-workspace.tsx',
] as const;

// ── Patterns that indicate active engine-fill code (not comments) ───────
// Each pattern is tested against non-comment lines only.
const FORBIDDEN_PATTERNS = [
  /fill\s*===?\s*['"]engine['"]/,     // fill === "engine" or fill == "engine"
  /fill\s*:\s*['"]engine['"]/,         // fill: "engine" (object literal)
  /engineFill/,                         // camelCase variable/function name
  /engine-fill/,                        // kebab-case outside comments
  /Let.*engine.*decide/i,              // UI copy
  /add expert-level content/i,          // GPT instruction for engine-fill
] as const;

/**
 * Strip single-line comments and return only active code lines.
 * Block comments are left for simplicity — the patterns above
 * are specific enough to avoid false positives in block comments.
 */
function stripComments(source: string): string[] {
  return source
    .split('\n')
    .filter((line) => {
      const trimmed = line.trimStart();
      return !trimmed.startsWith('//') && !trimmed.startsWith('*');
    });
}

describe('Engine-fill regression guard (P1)', () => {
  for (const relPath of FILES_TO_GUARD) {
    describe(relPath, () => {
      let activeLines: string[];

      beforeAll(() => {
        const fullPath = resolve(process.cwd(), relPath);
        const source = readFileSync(fullPath, 'utf-8');
        activeLines = stripComments(source);
      });

      for (const pattern of FORBIDDEN_PATTERNS) {
        it(`must not contain active code matching ${pattern.source}`, () => {
          const violations = activeLines
            .map((line, i) => ({ line: line.trim(), num: i + 1 }))
            .filter(({ line }) => pattern.test(line));

          if (violations.length > 0) {
            const detail = violations
              .map((v) => `  L${v.num}: ${v.line}`)
              .join('\n');
            fail(
              `Engine-fill code detected in ${relPath}:\n${detail}\n\n` +
              'P1 violation: the user is the only source of creative intent. ' +
              'Engine auto-fill was removed in Phase A and must not return.',
            );
          }
        });
      }
    });
  }
});
