// C:\Users\Proma\Projects\promagen\gateway\lib\ssot\fx-ribbon.ssot.ts

import fs from 'fs';
import path from 'path';
import type { FxRibbonPair } from '../types';

type FxPairsEntry = {
  id: string;
  isDefaultFree?: boolean;
};

type FxCatalogEntry = {
  id: string;
  base?: string;
  quote?: string;
  label?: string;
};

function findRepoRoot(startDir: string): string {
  let dir = startDir;

  while (true) {
    const candidate = path.join(dir, 'pnpm-workspace.yaml');
    if (fs.existsSync(candidate)) return dir;

    const parent = path.dirname(dir);
    if (parent === dir) return startDir; // fallback
    dir = parent;
  }
}

function readJsonFile<T>(absPath: string): T {
  const raw = fs.readFileSync(absPath, 'utf8');
  return JSON.parse(raw) as T;
}

/**
 * Reads the canonical FX pairs list from frontend SSOT.
 * - base source: frontend/src/data/fx/fx.pairs.json (defaults, longitudes etc)
 * - catalog:      frontend/src/data/fx/pairs.json (labels/base/quote etc)
 */
export function getFxRibbonPairs(): FxRibbonPair[] {
  const repoRoot = findRepoRoot(process.cwd());

  const fxPairsPath = path.join(repoRoot, 'frontend', 'src', 'data', 'fx', 'fx.pairs.json');
  const catalogPath = path.join(repoRoot, 'frontend', 'src', 'data', 'fx', 'pairs.json');

  const fxPairs = readJsonFile<FxPairsEntry[]>(fxPairsPath);
  const catalog = readJsonFile<FxCatalogEntry[]>(catalogPath);

  const byId = new Map<string, FxCatalogEntry>();
  for (const c of catalog) {
    if (c && typeof c.id === 'string') byId.set(String(c.id), c);
  }

  // Ribbon selection is driven by isDefaultFree (SSOT)
  const selected = fxPairs.filter((p) => p?.isDefaultFree === true);

  return selected
    .map((p) => {
      const id = String(p.id);
      const meta = byId.get(id);

      const base = String(meta?.base ?? id.split('-')[0] ?? '').toUpperCase();
      const quote = String(meta?.quote ?? id.split('-')[1] ?? '').toUpperCase();
      const label = typeof meta?.label === 'string' ? meta.label : `${base} / ${quote}`.trim();

      return {
        id,
        base,
        quote,
        label,
        category: 'fx',
      } satisfies FxRibbonPair;
    })
    .filter((p) => p.id && p.base && p.quote);
}

export function assertFxRibbonSsotValid(): void {
  const pairs = getFxRibbonPairs();
  if (!Array.isArray(pairs) || pairs.length === 0) {
    throw new Error('FX SSOT invalid: no default FX ribbon pairs found (isDefaultFree=true).');
  }
}
