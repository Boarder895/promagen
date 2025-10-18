"use client";

// FRONTEND â€¢ components/health/HealthToastWatcher.tsx
import { useEffect, useRef } from "react";
import { useHealth } from "@/components/health/HealthContext";
import { useToast } from "@/components/ui/Toast";

export default function HealthToastWatcher() {
  const { status } = useHealth();
  const { push } = useToast();
  const prev = useRef<"ok" | "degraded" | "down">("ok");

  useEffect(() => {
    if (prev.current !== status) {
      if (status === "degraded") push({ title: "Service degraded", body: "Some features may be slow or unstable." });
      if (status === "down") push({ title: "Service down", body: "Weâ€™re investigating. Check back shortly." });
      if (status === "ok" && prev.current !== "ok") push({ title: "Back to normal", body: "All systems operational." });
      prev.current = status;
    }
  }, [status, push]);

  return null;
}





