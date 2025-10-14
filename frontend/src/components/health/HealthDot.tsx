"use client";
import React from "react";
import type { HealthStatus } from "@/lib/health";

export default function HealthDot({ status }: { status: HealthStatus }) {
  const color =
    status === "ok" ? "bg-green-500" :
    status === "degraded" ? "bg-amber-500" :
    "bg-red-500";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}
