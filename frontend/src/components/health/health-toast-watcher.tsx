"use client";
import { useEffect } from "react";
import { useToast } from "@/components/ui/toast";

export default function HealthToastWatcher() {
  const { push } = useToast();
  useEffect(() => {
    // In Stage-1/2 this doesn't fire; wiring comes later.
    // Keep component mounted for future hooks.
  }, [push]);
  return null;
}





