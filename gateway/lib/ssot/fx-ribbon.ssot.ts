// C:\Users\Proma\Projects\promagen\gateway\src\lib\ssot\fx-ribbon.ssot.ts
//
// Gateway SSOT import for FX ribbon pairs.
//
// Single Source of Truth (SSOT) lives here (frontend):
//   frontend/src/data/fx/fx-ribbon.pairs.json
//
// This gateway module reads that same file at runtime, validates it,
// and exposes the ordered list of provider symbols (e.g. ["GBPUSD", ...]).
//
// IMPORTANT:
// - Do not duplicate pair lists in gateway code.
// - Do not reorder pairs in gateway code.
// - If the SSOT file is invalid, fail fast with a clear error.

import fs from 'node:fs';
import path from 'node:path';

export type FxRibbonRole = 'fx_ribbon';

export interface FxRibbonPairMeta {
  id: string; // "GBPUSD"
  base: string; // "GBP"
  quote: string; // "USD"
  label: string;
  category: string;
  emoji?: string;
}

export interface FxRibbonPairsSsot {
  role: FxRibbonRole;
  version: number;
  pairs: FxRibbonPairMeta[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normaliseCode(value: string): string {
  return value.replace(/[^A-Za-z]/g, '').toUpperCase();
}

/**
 * Find the repo root by walking upwards until we find a folder
 * containing both "frontend" and "gateway".
 *
 * This avoids brittle relative paths when running gateway from different CWDs.
 */
function findRepoRoot(startDir: string): string {
  let current = startDir;

  for (let i = 0; i < 15; i += 1) {
    const frontendDir = path.join(current, 'frontend');
    const gatewayDir = path.join(current, 'gateway');

    if (fs.existsSync(frontendDir) && fs.existsSync(gatewayDir)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  throw new Error(
    'FX SSOT: unable to locate repo root (expected folders "frontend" and "gateway"). ' +
      `StartDir="${startDir}".`,
  );
}

function getSsotFilePath(): string {
  const repoRoot = findRepoRoot(process.cwd());
  return path.join(repoRoot, 'frontend', 'src', 'data', 'fx', 'fx-ribbon.pairs.json');
}

function parseJsonFile(filePath: string): unknown {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

export function loadFxRibbonSsot(): FxRibbonPairsSsot {
  const filePath = getSsotFilePath();
  const parsed = parseJsonFile(filePath);

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`FX SSOT: JSON root must be an object. Path="${filePath}".`);
  }

  const ssot = parsed as Partial<FxRibbonPairsSsot>;

  if (ssot.role !== 'fx_ribbon') {
    throw new Error(`FX SSOT: expected role "fx_ribbon" but found "${String(ssot.role)}".`);
  }

  if (typeof ssot.version !== 'number' || !Number.isFinite(ssot.version)) {
    throw new Error('FX SSOT: "version" must be a finite number.');
  }

  if (!Array.isArray(ssot.pairs)) {
    throw new Error('FX SSOT: "pairs" must be an array.');
  }

  if (ssot.pairs.length !== 5) {
    throw new Error(`FX SSOT: ribbon must contain exactly 5 pairs; found ${ssot.pairs.length}.`);
  }

  const seen = new Set<string>();

  for (const p of ssot.pairs) {
    if (!p || typeof p !== 'object') {
      throw new Error('FX SSOT: every pair must be an object.');
    }

    if (!isNonEmptyString(p.id)) {
      throw new Error('FX SSOT: pair.id must be a non-empty string.');
    }
    if (!isNonEmptyString(p.base)) {
      throw new Error(`FX SSOT: pair.base must be a non-empty string for "${p.id}".`);
    }
    if (!isNonEmptyString(p.quote)) {
      throw new Error(`FX SSOT: pair.quote must be a non-empty string for "${p.id}".`);
    }

    const id = normaliseCode(p.id);
    const base = normaliseCode(p.base);
    const quote = normaliseCode(p.quote);

    if (id.length !== 6) {
      throw new Error(`FX SSOT: pair.id must be 6 letters like "GBPUSD"; got "${p.id}".`);
    }
    if (base.length !== 3 || quote.length !== 3) {
      throw new Error(`FX SSOT: base/quote must be 3-letter codes for "${p.id}".`);
    }

    const derived = `${base}${quote}`;
    if (id !== derived) {
      throw new Error(`FX SSOT: id "${id}" does not match base+quote "${derived}".`);
    }

    if (seen.has(id)) {
      throw new Error(`FX SSOT: duplicate pair id "${id}".`);
    }
    seen.add(id);
  }

  return ssot as FxRibbonPairsSsot;
}

/**
 * Ordered provider symbols e.g. ["GBPUSD","EURUSD",...]
 */
export function getFxRibbonProviderSymbols(): string[] {
  const ssot = loadFxRibbonSsot();
  return ssot.pairs.map((p) => normaliseCode(p.id));
}

/**
 * Ordered base/quote pairs e.g. [{base:"GBP", quote:"USD"}, ...]
 */
export function getFxRibbonBaseQuote(): Array<{ base: string; quote: string; id: string }> {
  const ssot = loadFxRibbonSsot();
  return ssot.pairs.map((p) => ({
    id: normaliseCode(p.id),
    base: normaliseCode(p.base),
    quote: normaliseCode(p.quote),
  }));
}
