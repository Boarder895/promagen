// frontend/src/data/fx/tests/fx-ssot.test.ts
//
// FX single-source-of-truth (SSoT) tests.
//
// Guards two invariants:
//
//  1. Every id in fx.pairs.json exists in pairs.json.
//  2. No FX JSON file except pairs.json defines base/quote/label/precision/demo,
//     with a small, explicit carve-out for non-FX metadata:
//
//       - finance.config.json → provider.base is an HTTP base URL, not FX "base".
//       - currencies.catalog.json → per-currency precision is allowed there.
//
// If any duplication sneaks back in, or an index entry points at a
// non-existent pair, this test fails and blocks the build.

import fs from 'fs';
import path from 'path';

type FxPairRow = {
  id: string;
  base: string;
  quote: string;
  label: string;
  precision: number;
  demo?: boolean;
};

type FxIndexRow = {
  id: string;
  // other fields are ignored for this test
  [key: string]: unknown;
};

type Offender = {
  file: string;
  paths: string[];
};

const FX_DATA_DIR = path.join(__dirname, '..');

const BANNED_KEYS = new Set(['base', 'quote', 'label', 'precision', 'demo']);

function loadJson<T>(relativePath: string): T {
  const fullPath = path.join(FX_DATA_DIR, relativePath);
  const raw = fs.readFileSync(fullPath, 'utf8');
  return JSON.parse(raw) as T;
}

function normaliseId(id: string): string {
  return id.trim().toLowerCase();
}

/**
 * Recursively walk a JSON value and record any banned key paths.
 */
function collectBannedKeyPaths(value: unknown, parentPath: string): string[] {
  const results: string[] = [];

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const nextPath = parentPath ? `${parentPath}[${index}]` : `[${index}]`;
      results.push(...collectBannedKeyPaths(item, nextPath));
    });
    return results;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const [key, child] of Object.entries(record)) {
      const nextPath = parentPath ? `${parentPath}.${key}` : key;

      if (BANNED_KEYS.has(key)) {
        results.push(nextPath);
      }

      results.push(...collectBannedKeyPaths(child, nextPath));
    }
  }

  return results;
}

describe('FX single-source-of-truth (SSoT)', () => {
  it('ensures every id in fx.pairs.json exists in pairs.json', () => {
    const pairs = loadJson<FxPairRow[]>('pairs.json');
    const fxIndex = loadJson<FxIndexRow[]>('fx.pairs.json');

    const pairIds = new Set(pairs.map((row) => normaliseId(row.id)));

    const missing: string[] = [];
    for (const row of fxIndex) {
      const id = normaliseId(row.id);
      if (!pairIds.has(id)) {
        missing.push(row.id);
      }
    }

    if (missing.length > 0) {
      const messageLines = missing.map(
        (id) => `- "${id}" is present in fx.pairs.json but missing from pairs.json`,
      );
      throw new Error(
        `FX index contains ids that do not exist in pairs.json:\n${messageLines.join('\n')}`,
      );
    }
  });

  it('rejects duplicate FX metadata outside pairs.json', () => {
    const files = fs
      .readdirSync(FX_DATA_DIR)
      .filter((file) => file.endsWith('.json') && file !== 'pairs.json');

    const offenders: Offender[] = [];

    for (const file of files) {
      const json = loadJson<unknown>(file);
      const rawPaths = collectBannedKeyPaths(json, '');

      // Explicit carve-outs:
      //  - finance.config.json: provider.base is an HTTP base URL, so we ignore that path.
      //  - currencies.catalog.json: "precision" there is per-currency formatting, not FX pair metadata.
      const filteredPaths = rawPaths.filter((p) => {
        if (
          file === 'finance.config.json' &&
          (p === 'provider.base' || p.startsWith('provider.base.'))
        ) {
          return false;
        }

        if (file === 'currencies.catalog.json' && (p.endsWith('.precision') || p === 'precision')) {
          return false;
        }

        return true;
      });

      if (filteredPaths.length > 0) {
        offenders.push({
          file,
          paths: filteredPaths,
        });
      }
    }

    if (offenders.length > 0) {
      const details = offenders
        .map((entry) => `${entry.file}: ${entry.paths.join(', ')}`)
        .join('\n');

      throw new Error(
        `FX JSON files other than pairs.json must not define base/quote/label/precision/demo.\n` +
          `Offending keys found:\n${details}`,
      );
    }
  });
});
