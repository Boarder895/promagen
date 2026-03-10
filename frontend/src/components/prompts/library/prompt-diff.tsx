// src/components/prompts/library/prompt-diff.tsx
// ============================================================================
// PROMPT DIFF VIEW (v1.0.0)
// ============================================================================
// Word-level diff between original and reformatted prompt text.
// Shows additions (emerald), removals (red), unchanged (white/70).
// Zero external dependencies — uses a minimal LCS-based diff algorithm.
//
// Human Factors Gate:
// - Feature: Side-by-side diff highlighting what changed during reformat
// - Factor: Curiosity Gap (Loewenstein) — the user wonders "what actually
//   changed?" The diff answers instantly, turning a black box (reformat)
//   into a transparent, educational moment. Users learn how prompts differ
//   across platforms by seeing the delta.
// - Anti-pattern: Showing two full texts without highlighting (user has to
//   visually compare — high cognitive load, most people won't bother)
//
// Authority: saved-page.md §10 (reformat feature)
// Sizing: All clamp() with 9px floor (code-standard.md §6.0.1)
// Animations: Co-located <style jsx> (code-standard.md §6.2)
// Existing features preserved: Yes
// ============================================================================

'use client';

import React, { useMemo } from 'react';

// ============================================================================
// DIFF ALGORITHM (word-level LCS)
// ============================================================================
// Minimal Longest Common Subsequence implementation.
// Tokenises by word boundaries, computes LCS, then marks each word as
// 'same', 'added', or 'removed'. No external library needed.
// ============================================================================

type DiffOp = 'same' | 'added' | 'removed';

interface DiffToken {
  text: string;
  op: DiffOp;
}

/**
 * Tokenise prompt text into words (preserving punctuation attached to words).
 * Splits on whitespace but keeps commas/parens/brackets attached.
 */
function tokenise(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/**
 * Compute LCS table between two word arrays.
 * Returns a 2D table where table[i][j] = LCS length of a[0..i-1] and b[0..j-1].
 */
function lcsTable(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const table: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0)
  );

  for (let i = 1; i <= m; i++) {
    const row = table[i]!;
    const prevRow = table[i - 1]!;
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        row[j] = (prevRow[j - 1] ?? 0) + 1;
      } else {
        row[j] = Math.max(prevRow[j] ?? 0, row[j - 1] ?? 0);
      }
    }
  }

  return table;
}

/**
 * Backtrace LCS table to produce diff tokens.
 */
function computeDiff(original: string, reformatted: string): DiffToken[] {
  const a = tokenise(original);
  const b = tokenise(reformatted);
  const table = lcsTable(a, b);

  let i = a.length;
  let j = b.length;

  // Backtrace from bottom-right — build in reverse, then flip
  const stack: DiffToken[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      stack.push({ text: a[i - 1] ?? '', op: 'same' });
      i--;
      j--;
    } else if (
      j > 0 &&
      (i === 0 || (table[i]?.[j - 1] ?? 0) >= (table[i - 1]?.[j] ?? 0))
    ) {
      stack.push({ text: b[j - 1] ?? '', op: 'added' });
      j--;
    } else {
      stack.push({ text: a[i - 1] ?? '', op: 'removed' });
      i--;
    }
  }

  // Reverse (we built from end)
  const result: DiffToken[] = [];
  while (stack.length) {
    result.push(stack.pop()!);
  }

  return result;
}

/**
 * Compute summary stats from diff tokens.
 */
function diffStats(tokens: DiffToken[]): { added: number; removed: number; unchanged: number } {
  let added = 0;
  let removed = 0;
  let unchanged = 0;

  for (const t of tokens) {
    if (t.op === 'added') added++;
    else if (t.op === 'removed') removed++;
    else unchanged++;
  }

  return { added, removed, unchanged };
}

// ============================================================================
// COMPONENT
// ============================================================================

export interface PromptDiffProps {
  /** Original prompt text */
  original: string;
  /** Reformatted prompt text */
  reformatted: string;
}

export function PromptDiff({ original, reformatted }: PromptDiffProps) {
  const tokens = useMemo(() => computeDiff(original, reformatted), [original, reformatted]);
  const stats = useMemo(() => diffStats(tokens), [tokens]);

  const totalChanged = stats.added + stats.removed;
  const totalWords = stats.added + stats.removed + stats.unchanged;
  const changePct = totalWords > 0 ? Math.round((totalChanged / totalWords) * 100) : 0;

  return (
    <div>
      {/* Stats bar */}
      <div
        className="flex items-center flex-wrap"
        style={{
          gap: 'clamp(6px, 0.5vw, 10px)',
          marginBottom: 'clamp(4px, 0.35vw, 6px)',
        }}
      >
        <span
          className="text-white/70"
          style={{ fontSize: 'clamp(0.7rem, 0.8vw, 0.95rem)' }}
        >
          {changePct}% changed
        </span>
        {stats.added > 0 && (
          <span
            className="text-emerald-400/70"
            style={{ fontSize: 'clamp(0.7rem, 0.8vw, 0.95rem)' }}
          >
            +{stats.added} added
          </span>
        )}
        {stats.removed > 0 && (
          <span
            className="text-red-400/70"
            style={{ fontSize: 'clamp(0.7rem, 0.8vw, 0.95rem)' }}
          >
            −{stats.removed} removed
          </span>
        )}
        {stats.unchanged > 0 && (
          <span
            className="text-white/60"
            style={{ fontSize: 'clamp(0.7rem, 0.8vw, 0.95rem)' }}
          >
            {stats.unchanged} kept
          </span>
        )}
      </div>

      {/* Diff body */}
      <div
        className="font-mono bg-slate-900/50 rounded-xl overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30 whitespace-pre-wrap break-words"
        style={{
          padding: 'clamp(8px, 0.7vw, 12px)',
          fontSize: 'clamp(0.75rem, 0.9vw, 1.1rem)',
          maxHeight: 'clamp(140px, 18vw, 260px)',
          lineHeight: '1.7',
        }}
      >
        {tokens.map((token, idx) => {
          if (token.op === 'same') {
            return (
              <span key={idx} className="text-white/60">
                {token.text}{' '}
              </span>
            );
          }

          if (token.op === 'added') {
            return (
              <span
                key={idx}
                className="diff-added text-emerald-400 bg-emerald-500/10 rounded-sm"
                style={{ padding: '0 clamp(2px, 0.15vw, 3px)' }}
              >
                {token.text}{' '}
              </span>
            );
          }

          // removed
          return (
            <span
              key={idx}
              className="diff-removed text-red-400/70 bg-red-500/10 rounded-sm line-through"
              style={{
                padding: '0 clamp(2px, 0.15vw, 3px)',
                textDecorationThickness: '1px',
              }}
            >
              {token.text}{' '}
            </span>
          );
        })}
      </div>

      {/* Legend */}
      <div
        className="flex items-center"
        style={{
          gap: 'clamp(8px, 0.7vw, 12px)',
          marginTop: 'clamp(3px, 0.25vw, 4px)',
        }}
      >
        <span className="flex items-center" style={{ gap: 'clamp(3px, 0.2vw, 4px)' }}>
          <span
            className="inline-block rounded-sm bg-emerald-500/10"
            style={{
              width: 'clamp(8px, 0.7vw, 10px)',
              height: 'clamp(8px, 0.7vw, 10px)',
            }}
          />
          <span className="text-white/60" style={{ fontSize: 'clamp(0.65rem, 0.75vw, 0.9rem)' }}>
            Added
          </span>
        </span>
        <span className="flex items-center" style={{ gap: 'clamp(3px, 0.2vw, 4px)' }}>
          <span
            className="inline-block rounded-sm bg-red-500/10"
            style={{
              width: 'clamp(8px, 0.7vw, 10px)',
              height: 'clamp(8px, 0.7vw, 10px)',
            }}
          />
          <span className="text-white/60" style={{ fontSize: 'clamp(0.65rem, 0.75vw, 0.9rem)' }}>
            Removed
          </span>
        </span>
      </div>
    </div>
  );
}

export default PromptDiff;
