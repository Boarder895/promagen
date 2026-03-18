// src/lib/prompt-colours.ts
// SSOT for prompt category colour mapping
// Version 1.0.0 — Shared constant used across all prompt-rendering surfaces
//
// Human factor: Von Restorff Effect (isolation effect) — each category colour
// is perceptually distinct on a dark background, making individual terms
// scannable instead of a monochrome wall of text.
//
// Colour selection rationale (§17 — Colour Psychology in Dark Interfaces):
// On dark backgrounds colour carries 3× more psychological weight.
// All 13 colours are chosen at the 300–400 saturation band for maximum
// contrast against slate-950 backgrounds without competing with each other.
//
// Structural colour: slate-400 (#94A3B8) — quiet but readable on dark
// backgrounds. Stays intentionally muted so category colours pop via
// Von Restorff isolation effect.
//
// Consumers:
//   - prompt-showcase.tsx (homepage Prompt of the Moment)
//   - prompt-builder.tsx (provider prompt builder — Pro-only colour coding)
//   - enhanced-prompt-builder.tsx (Prompt Lab — Pro-only colour coding)
//   - pro-promagen-client.tsx (Pro page preview)
//
// Admin page (vocab-submissions) uses its own { bg, text, ring } structure
// and is intentionally excluded from this SSOT.

import type { PromptCategory } from '@/types/prompt-builder';

/**
 * Category → hex colour mapping for prompt anatomy rendering.
 * 12 prompt categories + 1 structural (commas, glue text).
 */
export const CATEGORY_COLOURS: Record<string, string> = {
  subject: '#FCD34D',     // yellow-300 — gold, the star of the show
  action: '#A3E635',      // lime-400 — movement, energy
  style: '#C084FC',       // purple-400 — artistic reference
  environment: '#38BDF8', // sky-400 — place, setting
  composition: '#34D399', // emerald-400 — framing, structure
  camera: '#FB923C',      // orange-400 — lens, angle
  lighting: '#FBBF24',    // amber-400 — light source, direction
  colour: '#F472B6',      // pink-400 — colour grade
  atmosphere: '#22D3EE',  // cyan-400 — fog, haze, particles
  materials: '#2DD4BF',   // teal-400 — surface, texture
  fidelity: '#93C5FD',    // blue-300 — quality boosters (8K, etc.)
  negative: '#F87171',    // red-400 — constraints, exclusions
  structural: '#94A3B8',  // slate-400 — commas, glue text, readable but quiet
};

/**
 * Category display labels matching the prompt builder headings.
 */
export const CATEGORY_LABELS: Record<string, string> = {
  subject: 'Subject',
  action: 'Action',
  style: 'Style',
  environment: 'Environment',
  composition: 'Composition',
  camera: 'Camera',
  lighting: 'Lighting',
  colour: 'Colour',
  atmosphere: 'Atmosphere',
  materials: 'Materials',
  fidelity: 'Fidelity',
  negative: 'Negative',
};

/**
 * Category emoji icons for legend display.
 */
export const CATEGORY_EMOJIS: Record<string, string> = {
  subject: '📍',
  action: '💨',
  style: '🎨',
  environment: '🏛️',
  composition: '📐',
  camera: '📷',
  lighting: '💡',
  colour: '🌡️',
  atmosphere: '☁️',
  materials: '🧱',
  fidelity: '✨',
  negative: '🚫',
};

// ============================================================================
// Prompt Anatomy Parser — Shared logic for colour-coding prompt text
// ============================================================================

/** A segment of parsed prompt text tagged with its source category. */
export interface AnatomySegment {
  text: string;
  category: PromptCategory | 'structural';
  weight: number;
}

/** Common fidelity keywords auto-detected when not matched by term index. */
const FIDELITY_TERMS = [
  'masterpiece', 'best quality', 'highly detailed', 'sharp focus',
  '8k', '4k', 'intricate textures', 'intricate details', 'ultra detailed',
  'high resolution', 'fine details',
];

/**
 * Build a term → category lookup from PromptSelections (builder path).
 * This is more accurate than the text-matching approach used by PotM
 * because it uses the builder's own selection data as ground truth.
 */
export function buildTermIndexFromSelections(
  selections: Partial<Record<PromptCategory, string[]>>,
): Map<string, PromptCategory> {
  const index = new Map<string, PromptCategory>();
  for (const [cat, terms] of Object.entries(selections)) {
    if (!terms) continue;
    for (const term of terms) {
      const key = term.toLowerCase().trim();
      if (key) index.set(key, cat as PromptCategory);
    }
  }
  return index;
}

/**
 * Parse prompt text into colour-coded segments using a term→category index.
 * Keeps the original text byte-for-byte intact — colours terms in-place
 * via longest-first substring matching. Commas, spaces, and punctuation
 * are tagged as 'structural'. CLIP weight syntax `(term:1.2)` detected
 * for weight values.
 */
export function parsePromptIntoSegments(
  promptText: string,
  termIndex: Map<string, PromptCategory>,
): AnatomySegment[] {
  // Build sorted list of terms (longest first for greedy matching)
  const termEntries = Array.from(termIndex.entries()).sort(
    (a, b) => b[0].length - a[0].length,
  );

  type Match = { start: number; end: number; category: PromptCategory; weight: number };
  const matches: Match[] = [];
  const lowerPrompt = promptText.toLowerCase();

  for (const [term, category] of termEntries) {
    let searchFrom = 0;
    while (searchFrom < lowerPrompt.length) {
      const idx = lowerPrompt.indexOf(term, searchFrom);
      if (idx === -1) break;
      const overlaps = matches.some((m) => idx < m.end && idx + term.length > m.start);
      if (!overlaps) {
        let weight = 1.0;
        const beforeChar = idx > 0 ? promptText[idx - 1] : '';
        const afterText = promptText.slice(idx + term.length);
        if (beforeChar === '(' && /^:\d+\.?\d*\)/.test(afterText)) {
          const wMatch = afterText.match(/^:(\d+\.?\d*)\)/);
          if (wMatch) weight = parseFloat(wMatch[1]!);
        }
        matches.push({ start: idx, end: idx + term.length, category, weight });
      }
      searchFrom = idx + 1;
    }
  }

  // Also find fidelity keywords not already matched
  for (const fTerm of FIDELITY_TERMS) {
    let searchFrom = 0;
    while (searchFrom < lowerPrompt.length) {
      const idx = lowerPrompt.indexOf(fTerm, searchFrom);
      if (idx === -1) break;
      const overlaps = matches.some((m) => idx < m.end && idx + fTerm.length > m.start);
      if (!overlaps) {
        matches.push({ start: idx, end: idx + fTerm.length, category: 'fidelity', weight: 1.0 });
      }
      searchFrom = idx + 1;
    }
  }

  matches.sort((a, b) => a.start - b.start);

  const segments: AnatomySegment[] = [];
  let cursor = 0;

  for (const match of matches) {
    if (match.start > cursor) {
      segments.push({
        text: promptText.slice(cursor, match.start),
        category: 'structural',
        weight: 0.5,
      });
    }
    segments.push({
      text: promptText.slice(match.start, match.end),
      category: match.category,
      weight: match.weight,
    });
    cursor = match.end;
  }

  if (cursor < promptText.length) {
    segments.push({
      text: promptText.slice(cursor),
      category: 'structural',
      weight: 0.5,
    });
  }

  if (segments.length === 0) {
    segments.push({ text: promptText, category: 'structural', weight: 0.5 });
  }

  return segments;
}
