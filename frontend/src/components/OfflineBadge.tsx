"use client";

import { WifiOff } from "lucide-react";

type OfflineBadgeProps = {
  retryInMs: number;
};

export function OfflineBadge({ retryInMs }: OfflineBadgeProps) {
  const secs = Math.max(1, Math.round(retryInMs / 1000));
  const pct = Math.min(100, Math.round((1 - 1 / secs) * 100)); // cheap progress feel

  return (
    <div className="inline-flex items-center gap-2 rounded-md border bg-rose-50 px-2 py-1 text-rose-900">
      <WifiOff className="h-4 w-4" />
      <span className="text-xs">Offline Ã‚Â· retry in {secs}s</span>
      <span aria-hidden className="ml-1 h-1 w-12 overflow-hidden rounded bg-white/60">
        <span className="block h-full bg-rose-400" style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}

