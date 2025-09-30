"use client";

import React from "react";
import { providers, type Provider } from "@/lib/providers";

export default function ProvidersIndex() {
  const list: Provider[] = providers;

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((p) => (
        <div key={p.id} className="rounded-lg border p-3">
          <div className="font-medium">{p.name}</div>
          <div className="text-xs opacity-70">{p.hasApi ? "API" : "Manual"}</div>
        </div>
      ))}
    </section>
  );
}