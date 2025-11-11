// src/components/ApiStatusBadge.tsx
"use client";

type Props = { compact?: boolean; status?: "ok" | "degraded" | "down" };

export default function ApiStatusBadge({ compact = false, status = "ok" }: Props) {
  const color =
    status === "ok" ? "bg-emerald-500" : status === "degraded" ? "bg-amber-500" : "bg-rose-500";
  const label = status === "ok" ? "API OK" : status === "degraded" ? "Degraded" : "Offline";

  return (
    <span className="inline-flex items-center gap-2 select-none">
      <span className={`h-2.5 w-2.5 rounded-full ${color} shadow-[0_0_10px_rgba(0,0,0,0.3)]`} />
      {!compact && <span className="text-xs text-zinc-400">{label}</span>}
    </span>
  );
}


