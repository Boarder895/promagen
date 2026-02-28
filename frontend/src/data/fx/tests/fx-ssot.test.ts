// frontend/src/data/fx/tests/fx-ssot.test.ts
//
// FX single-source-of-truth (SSoT) tests.
//
// Guards two invariants:
//
//  1. fx-pairs.json has unique ids and fx.selected.json only references valid ids.
//  2. No FX JSON file except fx-pairs.json defines base/quote/label/precision/demo,
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
  it('ensures fx-pairs.json has unique ids and fx.selected.json only references valid ones', () => {
    const pairs = loadJson<FxPairRow[]>('fx-pairs.json');

    // Every id must be unique
    const ids = pairs.map((row) => normaliseId(row.id));
    const uniqueIds = new Set(ids);
    const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);

    if (duplicates.length > 0) {
      throw new Error(
        `fx-pairs.json contains duplicate ids:\n${[...new Set(duplicates)].map((id) => `- "${id}"`).join('\n')}`,
      );
    }

    expect(uniqueIds.size).toBe(pairs.length);

    // Every id in fx.selected.json must exist in fx-pairs.json
    const selected = loadJson<{ selectedIds: string[] }>('fx.selected.json');
    const missingSelected: string[] = [];
    for (const id of selected.selectedIds) {
      if (!uniqueIds.has(normaliseId(id))) {
        missingSelected.push(id);
      }
    }

    if (missingSelected.length > 0) {
      throw new Error(
        `fx.selected.json references ids not in fx-pairs.json:\n${missingSelected.map((id) => `- "${id}"`).join('\n')}`,
      );
    }
  });

  it('rejects duplicate FX metadata outside fx-pairs.json', () => {
    const files = fs
      .readdirSync(FX_DATA_DIR)
      .filter((file) => file.endsWith('.json') && file !== 'fx-pairs.json');

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
        `FX JSON files other than fx-pairs.json must not define base/quote/label/precision/demo.\n` +
          `Offending keys found:\n${details}`,
      );
    }
  });
});
