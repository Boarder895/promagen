"use client";
import { cn } from "@/lib/utils";

type Status = "done" | "in-review" | "draft";
export default function StatusChip({ status }: { status: Status }) {
  const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs border";
  const look =
    status === "done"
      ? "border-green-300 bg-green-50"
      : status === "in-review"
      ? "border-amber-300 bg-amber-50"
      : "border-red-300 bg-red-50";
  const label = status === "done" ? "done" : status === "in-review" ? "in-progress" : "not started";
  return <span className={cn(base, look)}>{label}</span>;
}


