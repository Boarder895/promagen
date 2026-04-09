/**
 * Sentinel Snapshot Diff Viewer (Extra)
 *
 * When a forensic snapshot (Extra A) exists for a regression,
 * this module computes a structured diff between the "before"
 * (previous week's page) and "after" (current week's page).
 *
 * Uses lightweight text-based diffing on extracted metadata,
 * not full DOM comparison. This keeps dependencies at zero
 * (code-standard rule 9) while producing actionable output.
 *
 * Output: a structured diff object showing exactly what changed
 * in each metadata field, suitable for inclusion in the report
 * or a future /admin/sentinel dashboard.
 *
 * Authority: sentinel.md v1.2.0 (Extra addition)
 * Existing features preserved: Yes
 */

import { gunzip } from 'node:zlib';
import { promisify } from 'node:util';

import 'server-only';

import { db } from '@/lib/db';
import type { SentinelSnapshotRow } from '@/types/sentinel';

const gunzipAsync = promisify(gunzip);

// =============================================================================
// TYPES
// =============================================================================

export interface FieldDiff {
  field: string;
  before: string | null;
  after: string | null;
  changed: boolean;
  severity: 'added' | 'removed' | 'modified' | 'unchanged';
}

export interface SnapshotDiff {
  url: string;
  regressionId: string;
  regressionType: string;
  fields: FieldDiff[];
  hasForensicHtml: boolean;
  forensicHtmlSize: number | null;
}

// =============================================================================
// DIFF COMPUTATION
// =============================================================================

/**
 * Compute a structured diff for a specific regression.
 *
 * Compares the snapshot fields from the current week and previous week.
 * If forensic HTML exists, reports its presence and size.
 */
export async function computeSnapshotDiff(
  regressionId: string,
): Promise<SnapshotDiff | null> {
  const sql = db();

  // Get the regression record
  const regressions = await sql<{
    id: string;
    run_id: string;
    url: string;
    regression_type: string;
    crawl_date: string;
    forensic_html_gz: Buffer | null;
  }[]>`
    SELECT id, run_id, url, regression_type, crawl_date, forensic_html_gz
    FROM sentinel_regressions WHERE id = ${regressionId}
  `;

  if (regressions.length === 0) return null;
  const reg = regressions[0]!;

  // Get current snapshot (from the run that detected the regression)
  const currentSnaps = await sql<SentinelSnapshotRow[]>`
    SELECT * FROM sentinel_snapshots
    WHERE run_id = ${reg.run_id} AND url = ${reg.url}
    LIMIT 1
  `;

  // Get previous snapshot (from the run before)
  const prevSnaps = await sql<SentinelSnapshotRow[]>`
    SELECT s.* FROM sentinel_snapshots s
    JOIN sentinel_runs r ON r.id = s.run_id
    WHERE s.url = ${reg.url}
      AND s.crawl_date < ${reg.crawl_date}
      AND r.run_type = 'weekly'
    ORDER BY s.crawl_date DESC LIMIT 1
  `;

  const current = currentSnaps[0] ?? null;
  const prev = prevSnaps[0] ?? null;

  // Build field-by-field diff
  const fields: FieldDiff[] = [];

  fields.push(diffField('status_code', String(prev?.status_code ?? ''), String(current?.status_code ?? '')));
  fields.push(diffField('title', prev?.title ?? null, current?.title ?? null));
  fields.push(diffField('meta_desc', prev?.meta_desc ?? null, current?.meta_desc ?? null));
  fields.push(diffField('h1', prev?.h1 ?? null, current?.h1 ?? null));
  fields.push(diffField('canonical', prev?.canonical ?? null, current?.canonical ?? null));
  fields.push(diffField('word_count', String(prev?.word_count ?? ''), String(current?.word_count ?? '')));
  fields.push(diffField('schema_types',
    (prev?.schema_types ?? []).join(', '),
    (current?.schema_types ?? []).join(', '),
  ));
  fields.push(diffField('internal_links_out', String(prev?.internal_links_out ?? ''), String(current?.internal_links_out ?? '')));
  fields.push(diffField('faq_count', String(prev?.faq_count ?? ''), String(current?.faq_count ?? '')));
  fields.push(diffField('response_ms', String(prev?.response_ms ?? ''), String(current?.response_ms ?? '')));
  fields.push(diffField('ssot_version', prev?.ssot_version ?? null, current?.ssot_version ?? null));

  return {
    url: reg.url,
    regressionId: reg.id,
    regressionType: reg.regression_type,
    fields,
    hasForensicHtml: reg.forensic_html_gz !== null,
    forensicHtmlSize: reg.forensic_html_gz?.length ?? null,
  };
}

/**
 * Decompress forensic HTML from a regression record.
 * Returns the raw HTML string, or null if no forensic data exists.
 */
export async function decompressForensicHtml(
  regressionId: string,
): Promise<string | null> {
  const sql = db();

  const rows = await sql<{ forensic_html_gz: Buffer | null }[]>`
    SELECT forensic_html_gz FROM sentinel_regressions
    WHERE id = ${regressionId}
  `;

  const gz = rows[0]?.forensic_html_gz;
  if (!gz) return null;

  const decompressed = await gunzipAsync(gz);
  return decompressed.toString('utf-8');
}

/**
 * Format a snapshot diff as plain text for the report.
 */
export function formatSnapshotDiff(diff: SnapshotDiff): string {
  const changed = diff.fields.filter((f) => f.changed);
  if (changed.length === 0) return `  ${diff.url}: No metadata changes detected`;

  const lines = [`  ${diff.url} (${diff.regressionType}):`];
  for (const f of changed) {
    const icon = f.severity === 'removed' ? '🔴' : f.severity === 'added' ? '🟢' : '🟡';
    lines.push(`    ${icon} ${f.field}: "${f.before ?? '(empty)'}" → "${f.after ?? '(empty)'}"`);
  }

  if (diff.hasForensicHtml) {
    const sizeKb = diff.forensicHtmlSize
      ? `${(diff.forensicHtmlSize / 1024).toFixed(1)}KB`
      : 'unknown size';
    lines.push(`    📸 Forensic HTML snapshot preserved (${sizeKb} gzipped)`);
  }

  return lines.join('\n');
}

// =============================================================================
// HELPERS
// =============================================================================

function diffField(field: string, before: string | null, after: string | null): FieldDiff {
  const beforeNorm = (before ?? '').trim();
  const afterNorm = (after ?? '').trim();
  const changed = beforeNorm !== afterNorm;

  let severity: FieldDiff['severity'] = 'unchanged';
  if (changed) {
    if (!beforeNorm && afterNorm) severity = 'added';
    else if (beforeNorm && !afterNorm) severity = 'removed';
    else severity = 'modified';
  }

  return { field, before, after, changed, severity };
}
