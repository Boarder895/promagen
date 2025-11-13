// src/components/cosmic/cosmic-pill.tsx
import React from "react";
import { usePlan } from "@/hooks/usePlan";

export function CosmicPill() {
  const { plan } = usePlan();

  return (
    <span
      className="text-[10px] rounded-full border px-2 py-0.5"
      aria-label={`plan ${plan ?? "unknown"}`}
    >
      {plan ?? "—"}
    </span>
  );
}

export default CosmicPill;
