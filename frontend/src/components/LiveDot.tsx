// @/components/LiveDot.tsx
"use client";
import { useClockDrift } from "@/hooks/useClockDrift";

export function LiveDot() {
  const { liveOk } = useClockDrift();
  return (
    <span
      aria-label={liveOk ? "Live" : "Clock out of sync"}
      className={`inline-block h-2.5 w-2.5 rounded-full align-middle ${
        liveOk ? "bg-green-500 animate-pulse" : "bg-amber-500"
      }`}
    />
  );
}

