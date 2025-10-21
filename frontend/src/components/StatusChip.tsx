"use client";
import React from "react";
export default function StatusChip({ status }: { status?: "ok" | "degraded" | "down" }) {
  const color =
    status === "ok" ? "bg-green-500" :
    status === "degraded" ? "bg-amber-500" :
    "bg-red-500";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} aria-label={status ?? "unknown"} />;
}




