// src/lib/call-2-harness/system-prompt-loader.ts
// ============================================================================
// Call 2 Quality Harness — System Prompt Snapshot Loader (Phase E runner)
// ============================================================================
// Loads a vendored snapshot of the Call 2 system prompt from disk so the
// harness runner can POST it to /api/dev/generate-tier-prompts without ever
// importing from the production route file. This is the deliberate trade-off
// chosen for the proof-of-life runner: production is NEVER MODIFIED, at the
// cost of one manual snapshot file per Call 2 version.
//
// Default snapshot location:
//   harness-snapshots/call-2-system-prompt-<version>.txt
//
// Override:
//   --system-prompt-file <path>  (CLI flag on the runner)
//
// Drift safeguards (warnings, NOT hard fails — runner stays usable):
//   1. Filename version vs requested version mismatch
//   2. Snapshot mtime older than the production route file
//
// Both warnings can be silenced via env var HARNESS_SUPPRESS_SNAPSHOT_WARNINGS=1
// for CI runs where the snapshot is regenerated from a known commit.
//
// Authority:
//   - call-2-harness-build-plan-v1.md §9 (proof-of-life)
//   - call-2-quality-architecture-v0.3.1.md §3 (production untouched)
// Existing features preserved: Yes (this is a new module).
// ============================================================================

import { stat, readFile } from 'node:fs/promises';
import { basename, isAbsolute, resolve } from 'node:path';

// ── Constants ──────────────────────────────────────────────────────────────

/**
 * Default snapshot directory, relative to the frontend project root
 * (i.e. resolved from process.cwd() when the runner is invoked from there).
 */
export const DEFAULT_SNAPSHOT_DIR = 'harness-snapshots';

/**
 * Path to the production route file. Used for the mtime drift check ONLY —
 * we never read its contents. If the production route is newer than the
 * snapshot, the snapshot is probably stale and the warning fires.
 */
export const PRODUCTION_ROUTE_PATH = 'src/app/api/generate-tier-prompts/route.ts';

/**
 * The minimum length we consider plausibly-complete for a Call 2 system
 * prompt. Anything shorter is almost certainly a mistake (empty file,
 * truncation, copy-paste fragment). Caught early to fail loud.
 *
 * The current v4.5 prompt is roughly 6500 characters; 1000 is a safe floor.
 */
const MIN_PLAUSIBLE_PROMPT_LENGTH = 1000;

// ── Public types ───────────────────────────────────────────────────────────

export interface LoadedSystemPrompt {
  /** The raw prompt text, as it will be POSTed to the dev endpoint. */
  readonly prompt: string;
  /** Absolute filesystem path the prompt was loaded from. */
  readonly absolutePath: string;
  /** ISO timestamp of the snapshot file's mtime. */
  readonly snapshotMtime: string;
  /** Warnings the runner should print loudly before any HTTP traffic. */
  readonly warnings: readonly string[];
}

export interface LoadSystemPromptOptions {
  /** Call 2 version being tested, e.g. 'v4.5'. Used for default path + drift check. */
  readonly version: string;
  /** Optional explicit path override (--system-prompt-file). */
  readonly explicitPath?: string;
  /** Project root for resolving relative paths. Defaults to process.cwd(). */
  readonly cwd?: string;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Resolve the snapshot path the loader will read for a given version.
 * Pure function — no I/O. Useful for printing the resolved path before
 * the runner attempts to load it.
 */
export function resolveSnapshotPath(opts: LoadSystemPromptOptions): string {
  const cwd = opts.cwd ?? process.cwd();
  if (opts.explicitPath !== undefined && opts.explicitPath.length > 0) {
    return isAbsolute(opts.explicitPath)
      ? opts.explicitPath
      : resolve(cwd, opts.explicitPath);
  }
  const filename = `call-2-system-prompt-${opts.version}.txt`;
  return resolve(cwd, DEFAULT_SNAPSHOT_DIR, filename);
}

/**
 * Load the Call 2 system prompt snapshot from disk.
 *
 * Throws (with an actionable message) if:
 *   - The file doesn't exist
 *   - The file is shorter than MIN_PLAUSIBLE_PROMPT_LENGTH (likely truncation)
 *   - The file is unreadable
 *
 * Returns warnings (does NOT throw) if:
 *   - The filename version doesn't match the requested version
 *   - The snapshot is older than the production route file
 *
 * The runner is expected to print the warnings loudly at the top of its
 * output — they don't block the run, but they tell Martin the snapshot
 * may be stale before he spends OpenAI credits on a misleading run.
 */
export async function loadSystemPrompt(
  opts: LoadSystemPromptOptions,
): Promise<LoadedSystemPrompt> {
  const absolutePath = resolveSnapshotPath(opts);
  const cwd = opts.cwd ?? process.cwd();
  const warnings: string[] = [];

  // ── Read the file (or fail loudly) ──────────────────────────────────────
  let snapshotStat: Awaited<ReturnType<typeof stat>>;
  try {
    snapshotStat = await stat(absolutePath);
  } catch (err) {
    const isENOENT =
      err instanceof Error && (err as NodeJS.ErrnoException).code === 'ENOENT';
    if (isENOENT) {
      throw new Error(
        [
          `[system-prompt-loader] Snapshot not found at: ${absolutePath}`,
          '',
          'The proof-of-life runner needs a vendored copy of the Call 2',
          `system prompt for version ${opts.version}. To create it:`,
          '',
          '  1. Open src/app/api/generate-tier-prompts/route.ts',
          '  2. Find buildSystemPrompt() and copy the returned template',
          '     literal (without provider context — pass null to get the',
          '     baseline prompt the harness should test against)',
          `  3. Save it as: ${DEFAULT_SNAPSHOT_DIR}/call-2-system-prompt-${opts.version}.txt`,
          '',
          'Alternatively, point the runner at any file with',
          '  --system-prompt-file <path>',
        ].join('\n'),
      );
    }
    throw err;
  }

  if (!snapshotStat.isFile()) {
    throw new Error(
      `[system-prompt-loader] ${absolutePath} exists but is not a regular file.`,
    );
  }

  const prompt = await readFile(absolutePath, 'utf8');

  if (prompt.length < MIN_PLAUSIBLE_PROMPT_LENGTH) {
    throw new Error(
      `[system-prompt-loader] Snapshot at ${absolutePath} is only ${prompt.length} characters — ` +
        `expected at least ${MIN_PLAUSIBLE_PROMPT_LENGTH}. Likely truncated or empty. ` +
        `Refusing to run with a corrupt snapshot.`,
    );
  }

  // ── Drift warning 1: filename version vs requested version ──────────────
  const filenameVersion = extractVersionFromFilename(basename(absolutePath));
  if (
    filenameVersion !== null &&
    filenameVersion !== opts.version &&
    !shouldSuppressWarnings()
  ) {
    warnings.push(
      `Snapshot filename declares version "${filenameVersion}" but the runner ` +
        `was invoked with --version ${opts.version}. The harness will RUN, but ` +
        `the inventory will be tagged ${opts.version} while testing the ${filenameVersion} ` +
        `prompt. Verify this is intentional before trusting the result.`,
    );
  }

  // ── Drift warning 2: snapshot older than production route file ──────────
  const productionRoutePath = resolve(cwd, PRODUCTION_ROUTE_PATH);
  try {
    const productionStat = await stat(productionRoutePath);
    if (
      productionStat.mtimeMs > snapshotStat.mtimeMs &&
      !shouldSuppressWarnings()
    ) {
      const snapshotAge = humanAge(snapshotStat.mtimeMs);
      const productionAge = humanAge(productionStat.mtimeMs);
      warnings.push(
        `Snapshot mtime is OLDER than the production route file. ` +
          `Snapshot last modified ${snapshotAge}; production route last modified ${productionAge}. ` +
          `If buildSystemPrompt() has changed since the snapshot was taken, this run is testing ` +
          `a stale prompt. Regenerate the snapshot or set HARNESS_SUPPRESS_SNAPSHOT_WARNINGS=1 ` +
          `if the production route change does not affect the prompt body.`,
      );
    }
  } catch {
    // Production route not found at expected path — not a hard error here.
    // The runner is designed to be runnable from non-frontend cwd in CI.
    // We just skip the mtime check silently.
  }

  return {
    prompt,
    absolutePath,
    snapshotMtime: new Date(snapshotStat.mtimeMs).toISOString(),
    warnings: Object.freeze(warnings),
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extract a "vN.M" version token from a filename. Returns null if no
 * recognisable version pattern is found. Used by the drift check, NOT for
 * any kind of validation gate.
 */
function extractVersionFromFilename(filename: string): string | null {
  // Match v1, v1.2, v10, v10.20 — anywhere in the filename.
  // Anchored to a word boundary on the left so "vendored" doesn't match.
  const match = filename.match(/\bv\d+(?:\.\d+)?/);
  return match ? match[0] : null;
}

function shouldSuppressWarnings(): boolean {
  return process.env.HARNESS_SUPPRESS_SNAPSHOT_WARNINGS === '1';
}

/**
 * Human-readable "X minutes/hours/days ago" for warning messages.
 * Avoids importing a date library — this module has zero deps.
 */
function humanAge(mtimeMs: number): string {
  const ageMs = Date.now() - mtimeMs;
  if (ageMs < 0) return 'in the future (clock skew?)';
  const seconds = Math.floor(ageMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
