/**
 * Promagen Gateway - SSOT Snapshot Store
 * ======================================
 *
 * Chunk 1: True SSOT snapshot + Last-Known-Good
 *
 * Design:
 * - Store a parsed, sanitised SSOT snapshot per feed on local disk.
 * - Load snapshot first at init (so gateway can boot without frontend).
 * - Attempt to refresh snapshot from frontend; if it fails validation, keep LKG.
 * - Compute SSOT provenance (hash + fingerprint) deterministically.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type SnapshotSsotSource = 'frontend' | 'fallback';

export interface SsotProvenance {
  readonly ssotVersion: number;
  readonly ssotHash: string;
  readonly ssotFingerprint: string;
  readonly snapshotAt: string;
}

export interface SsotSnapshot<TCatalog> {
  readonly schemaVersion: 1;
  readonly feedId: string;
  readonly ssotUrl: string;
  readonly ssotSource: SnapshotSsotSource;
  readonly provenance: SsotProvenance;
  readonly catalog: readonly TCatalog[];
  readonly defaults: readonly string[];
}

const DEFAULT_DIR = '.ssot';

function getSnapshotDir(): string {
  return process.env['SSOT_SNAPSHOT_DIR']?.trim() || DEFAULT_DIR;
}

function getSnapshotPath(feedId: string): string {
  const dir = getSnapshotDir();
  return path.join(dir, `${feedId}.snapshot.json`);
}

function getBackupPath(feedId: string): string {
  const dir = getSnapshotDir();
  return path.join(dir, `${feedId}.snapshot.prev.json`);
}

/**
 * Create a deterministic canonical string for hashing.
 * Sorts object keys recursively so key-order changes don't change the hash.
 */
export function canonicalStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalStringify(v)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const entries = keys.map((k) => `${JSON.stringify(k)}:${canonicalStringify(obj[k])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(String(value));
}

export function computeSsotHash(payload: unknown): { hash: string; fingerprint: string } {
  const canonical = canonicalStringify(payload);
  const hash = createHash('sha256').update(canonical).digest('hex');
  return { hash, fingerprint: hash.slice(0, 12) };
}

export async function loadSsotSnapshot<TCatalog>(
  feedId: string,
): Promise<SsotSnapshot<TCatalog> | null> {
  const snapshotPath = getSnapshotPath(feedId);

  try {
    const raw = await readFile(snapshotPath, 'utf8');
    const parsed: unknown = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object') return null;
    const obj = parsed as Record<string, unknown>;

    // Basic shape checks
    if (obj['schemaVersion'] !== 1) return null;
    if (obj['feedId'] !== feedId) return null;

    const ssotUrl = obj['ssotUrl'];
    if (typeof ssotUrl !== 'string') return null;

    const ssotSource = obj['ssotSource'];
    if (ssotSource !== 'frontend' && ssotSource !== 'fallback') return null;

    const provenanceRaw = obj['provenance'];
    if (!provenanceRaw || typeof provenanceRaw !== 'object') return null;
    const prov = provenanceRaw as Record<string, unknown>;

    const ssotVersion = prov['ssotVersion'];
    const ssotHash = prov['ssotHash'];
    const ssotFingerprint = prov['ssotFingerprint'];
    const snapshotAt = prov['snapshotAt'];

    if (typeof ssotVersion !== 'number') return null;
    if (typeof ssotHash !== 'string') return null;
    if (typeof ssotFingerprint !== 'string') return null;
    if (typeof snapshotAt !== 'string') return null;

    const catalogRaw = obj['catalog'];
    if (!Array.isArray(catalogRaw)) return null;

    const defaultsRaw = obj['defaults'];
    if (!Array.isArray(defaultsRaw)) return null;
    if (!defaultsRaw.every((v) => typeof v === 'string')) return null;

    // Build a typed snapshot object (no unsafe whole-object cast)
    const snapshot: SsotSnapshot<TCatalog> = {
      schemaVersion: 1,
      feedId,
      ssotUrl,
      ssotSource,
      provenance: {
        ssotVersion,
        ssotHash,
        ssotFingerprint,
        snapshotAt,
      },
      catalog: catalogRaw as readonly TCatalog[],
      defaults: defaultsRaw as readonly string[],
    };

    return snapshot;
  } catch {
    return null;
  }
}

export async function saveSsotSnapshot<TCatalog>(snapshot: SsotSnapshot<TCatalog>): Promise<void> {
  const dir = getSnapshotDir();
  await mkdir(dir, { recursive: true });

  const targetPath = getSnapshotPath(snapshot.feedId);
  const backupPath = getBackupPath(snapshot.feedId);
  const tmpPath = `${targetPath}.tmp`;

  // Best-effort backup: keep previous snapshot as last-known-good on disk.
  try {
    // Only backup if the existing snapshot exists.
    await rename(targetPath, backupPath);
  } catch {
    // ignore
  }

  const json = JSON.stringify(snapshot, null, 2);
  await writeFile(tmpPath, json, 'utf8');
  await rename(tmpPath, targetPath);
}
