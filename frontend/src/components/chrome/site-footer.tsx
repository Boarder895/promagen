// Footer with build provenance: commit, CI run id, UTC timestamp.
// Reads NEXT_PUBLIC_COMMIT / NEXT_PUBLIC_CI / NEXT_PUBLIC_BUILT_UTC.

export default function SiteFooter() {
  const commit = process.env.NEXT_PUBLIC_COMMIT ?? "dev";
  const runId = process.env.NEXT_PUBLIC_CI ?? "local";
  const builtUtc = process.env.NEXT_PUBLIC_BUILT_UTC ?? new Date().toISOString();

  return (
    <footer className="mt-10 border-t border-gray-200/70 bg-white/70">
      <div className="mx-auto max-w-7xl px-4 py-3 text-xs text-gray-600 flex items-center justify-between">
        <span>© {new Date().getFullYear()} Promagen</span>
        <span data-testid="build-provenance" className="tabular-nums">
          Build {commit} · {runId} · {new Date(builtUtc).toUTCString()}
        </span>
      </div>
    </footer>
  );
}
